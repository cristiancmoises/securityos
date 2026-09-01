//! SecurityOS privacy-proxy sidecar — a memory-safe (Rust) reimplementation of the
//! security-critical fetch + rewrite path of `pages/api/proxy.ts`.
//!
//! Why this exists: the proxy is the one server-side component that handles fully
//! untrusted input (remote HTTP streams, hostile HTML, redirect chains). Doing that
//! in a memory-safe language with a real streaming HTML parser (`lol_html`) removes
//! the buffer/parsing class of bugs and the regex-DoS risk of string rewriting.
//!
//! Behaviour (matches the Node proxy so the OS can delegate transparently):
//!   GET /proxy?url=<absolute>&nojs=1
//!   - routes every fetch through TOR_PROXY (socks5h://… → DNS + .onion at Tor),
//!   - follows redirects manually, re-checking SSRF on every hop,
//!   - forwards only an allowlist of response headers; forces no-store/no-referrer,
//!   - rewrites href/src/action/poster to route back through /proxy and injects
//!     <base href>, so sub-resources and links stay on Tor,
//!   - in nojs mode sets CSP script-src 'none',
//!   - logs NOTHING (amnesic).
//!
//! It is opt-in: the Next proxy delegates here only when PROXY_SIDECAR_URL is set.

use std::net::{IpAddr, Ipv6Addr, SocketAddr};
use std::time::Duration;

use axum::{
    extract::Query,
    http::{header, HeaderMap, HeaderName, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use lol_html::{
    element, html_content::Element, rewrite_str, ElementContentHandlers, RewriteStrSettings,
    Selector,
};
use percent_encoding::{utf8_percent_encode, NON_ALPHANUMERIC};
use serde::Deserialize;
use std::borrow::Cow;
use url::{Host, Url};

const MAX_REDIRECTS: u8 = 5;
const FETCH_TIMEOUT: Duration = Duration::from_secs(30);
const MAX_RESPONSE_BYTES: u64 = 25 * 1024 * 1024;
const UA: &str = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Only these upstream response headers are ever forwarded to the caller.
const FORWARD_HEADERS: &[&str] = &["content-type", "content-language", "content-disposition"];

#[derive(Deserialize)]
struct ProxyQuery {
    url: String,
    #[serde(default)]
    nojs: Option<String>,
}

#[tokio::main]
async fn main() {
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8077);

    let app = Router::new()
        .route("/proxy", get(handle))
        .route("/healthz", get(|| async { "ok" }));

    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port))
        .await
        .expect("bind");

    // No request logging on purpose (amnesia).
    axum::serve(listener, app).await.expect("serve");
}

fn tor_enabled() -> bool {
    std::env::var("TOR_PROXY")
        .map(|v| !v.is_empty())
        .unwrap_or(false)
}

fn build_client(pin: Option<(&str, &[SocketAddr])>) -> reqwest::Result<reqwest::Client> {
    let mut builder = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none()) // followed manually (SSRF re-check)
        .timeout(FETCH_TIMEOUT)
        .user_agent(UA);

    // Pin the validated IP(s) so reqwest can't independently re-resolve the host to
    // a private address between our check and the fetch (DNS-rebinding / TOCTOU).
    if let Some((host, addrs)) = pin {
        builder = builder.resolve_to_addrs(host, addrs);
    }

    if let Ok(proxy) = std::env::var("TOR_PROXY") {
        if !proxy.is_empty() {
            builder = builder.proxy(reqwest::Proxy::all(&proxy)?);
        }
    }

    builder.build()
}

fn is_disallowed_ip(ip: &IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            v4.is_loopback()
                || v4.is_private()
                || v4.is_link_local()
                || v4.is_broadcast()
                || v4.is_documentation()
                || v4.is_unspecified()
                || v4.octets()[0] == 0
                // 169.254.169.254 (cloud metadata) is link-local, already covered;
                // 100.64.0.0/10 (CGNAT):
                || (v4.octets()[0] == 100 && (v4.octets()[1] & 0xC0) == 64)
        }
        IpAddr::V6(v6) => {
            v6.is_loopback()
                || v6.is_unspecified()
                || is_unique_local(v6)
                || is_v6_link_local(v6)
                // IPv4-mapped (::ffff:a.b.c.d) — unwrap and re-check.
                || v6.to_ipv4_mapped().map(|m| is_disallowed_ip(&IpAddr::V4(m))).unwrap_or(false)
        }
    }
}

fn is_unique_local(ip: &Ipv6Addr) -> bool {
    (ip.segments()[0] & 0xfe00) == 0xfc00 // fc00::/7
}

fn is_v6_link_local(ip: &Ipv6Addr) -> bool {
    (ip.segments()[0] & 0xffc0) == 0xfe80 // fe80::/10
}

enum Ssrf {
    Blocked,
    Allow,
    Pinned(Vec<SocketAddr>),
}

/// Decide whether the URL is safe to fetch and, for non-Tor domain fetches, return
/// the validated IPs to PIN so reqwest can't re-resolve the host to a private
/// address (DNS rebinding). .onion is always allowed; in Tor mode DNS happens AT
/// Tor (no local rebind) so we allow without pinning; literal IPs are checked
/// directly (no DNS, so no TOCTOU).
async fn check_ssrf(target: &Url) -> Ssrf {
    if target.scheme() != "http" && target.scheme() != "https" {
        return Ssrf::Blocked;
    }

    match target.host() {
        Some(Host::Domain(domain)) => {
            let lower = domain.to_ascii_lowercase();
            if lower == "localhost" || lower.ends_with(".localhost") {
                return Ssrf::Blocked;
            }
            if lower.ends_with(".onion") || tor_enabled() {
                return Ssrf::Allow;
            }

            let port = target.port_or_known_default().unwrap_or(80);
            match tokio::net::lookup_host((domain.to_string(), port)).await {
                Ok(addrs) => {
                    let resolved: Vec<SocketAddr> = addrs.collect();
                    if resolved.is_empty() || resolved.iter().any(|a| is_disallowed_ip(&a.ip())) {
                        Ssrf::Blocked
                    } else {
                        Ssrf::Pinned(resolved)
                    }
                }
                Err(_) => Ssrf::Blocked,
            }
        }
        Some(Host::Ipv4(v4)) => {
            if is_disallowed_ip(&IpAddr::V4(v4)) {
                Ssrf::Blocked
            } else {
                Ssrf::Allow
            }
        }
        Some(Host::Ipv6(v6)) => {
            if is_disallowed_ip(&IpAddr::V6(v6)) {
                Ssrf::Blocked
            } else {
                Ssrf::Allow
            }
        }
        None => Ssrf::Blocked,
    }
}

fn proxify(raw: &str, base: &Url, nojs: bool) -> String {
    let trimmed = raw.trim();
    let lower = trimmed.to_ascii_lowercase();
    if trimmed.is_empty()
        || lower.starts_with("data:")
        || lower.starts_with("blob:")
        || lower.starts_with("javascript:")
        || lower.starts_with("about:")
        || lower.starts_with("mailto:")
        || lower.starts_with("tel:")
        || trimmed.starts_with('#')
        || trimmed.starts_with("/api/proxy?url=")
    {
        return raw.to_string();
    }

    match base.join(trimmed) {
        Ok(abs) if abs.scheme() == "http" || abs.scheme() == "https" => {
            let enc = utf8_percent_encode(abs.as_str(), NON_ALPHANUMERIC).to_string();
            // Root-relative path to the browser-facing endpoint. We resolved the URL
            // to absolute above, so NO <base> is needed (and injecting one pointing
            // at the target origin would make these root-relative links resolve
            // against the target — e.g. an .onion the browser can't even DNS-resolve).
            if nojs {
                format!("/api/proxy?url={enc}&nojs=1")
            } else {
                format!("/api/proxy?url={enc}")
            }
        }
        _ => raw.to_string(),
    }
}

// Escape a string for safe use inside a double-quoted HTML attribute value.
fn html_attr_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('"', "&quot;")
        .replace('<', "&lt;")
}

fn rewrite_html(html: &str, base: &Url, nojs: bool) -> Result<String, ()> {
    let attr_rewriter = |attrs: &[&str]| {
        attrs
            .iter()
            .map(|attr| {
                let attr = attr.to_string();
                let base = base.clone();
                let handler: (Cow<Selector>, ElementContentHandlers) = (
                    Cow::Owned(format!("[{attr}]").parse().unwrap()),
                    ElementContentHandlers::default().element(move |el: &mut Element| {
                        if let Some(val) = el.get_attribute(&attr) {
                            let _ = el.set_attribute(&attr, &proxify(&val, &base, nojs));
                        }
                        Ok(())
                    }),
                );
                handler
            })
            .collect::<Vec<_>>()
    };

    // `action` is intentionally NOT in this list — forms are handled below. We also
    // inject NO <base>: every URL is rewritten to an absolute target carried in the
    // proxy's ?url=, so a <base> pointing at the (e.g. .onion) origin would only
    // break the root-relative /api/proxy links and leak/DNS-fail on misses.
    let mut element_content_handlers =
        attr_rewriter(&["href", "src", "poster", "formaction", "data-src"]);

    // Forms: a GET submit makes the browser REPLACE the action's query string with
    // the form fields, dropping our ?url= target. So point the action at the proxy
    // and carry the real target (+ nojs) in hidden inputs; the proxy merges the
    // remaining form fields back into the target (see the handler's __pxurl path).
    let form_base = base.clone();
    element_content_handlers.push(element!("form", move |el| {
        let action_raw = el.get_attribute("action").unwrap_or_default();
        let method = el
            .get_attribute("method")
            .unwrap_or_default()
            .to_ascii_lowercase();
        let action_abs = form_base
            .join(if action_raw.is_empty() {
                "./"
            } else {
                &action_raw
            })
            .map(|u| u.to_string())
            .unwrap_or_else(|_| form_base.to_string());

        if method == "post" {
            // POST proxying is unsupported; best-effort point it at the proxy target.
            let _ = el.set_attribute("action", &proxify(&action_raw, &form_base, nojs));
        } else {
            let _ = el.set_attribute("action", "/api/proxy");
            let mut hidden = format!(
                r#"<input type="hidden" name="__pxurl" value="{}">"#,
                html_attr_escape(&action_abs)
            );
            if nojs {
                hidden.push_str(r#"<input type="hidden" name="nojs" value="1">"#);
            }
            el.prepend(&hidden, lol_html::html_content::ContentType::Html);
        }
        Ok(())
    }));

    // Keep "new tab" links inside the in-OS browser: force any target to _self so
    // links navigate this iframe instead of opening a real browser tab.
    element_content_handlers.push(element!("[target]", |el| {
        let _ = el.set_attribute("target", "_self");
        Ok(())
    }));

    // Fail CLOSED: if rewriting errors we must NOT return the original HTML (its
    // links/resources would point straight at the origin, bypassing the proxy/Tor).
    rewrite_str(
        html,
        RewriteStrSettings {
            element_content_handlers,
            ..RewriteStrSettings::default()
        },
    )
    .map_err(|_| ())
}

fn error_response(tor_down: bool) -> Response {
    let body = if tor_down {
        "<!doctype html><meta charset=utf-8><body style=\"background:#150f1b;color:#e8e2ee;font:14px system-ui;text-align:center;padding-top:20vh\"><h1>🧅 Tor is unreachable</h1><p>The tor service may be down. Onion routing resumes once it is back.</p>"
    } else {
        "<!doctype html><meta charset=utf-8><body style=\"background:#150f1b;color:#e8e2ee;font:14px system-ui;text-align:center;padding-top:20vh\"><h1>🧅 Couldn't load that address through the privacy proxy</h1>"
    };
    (
        StatusCode::BAD_GATEWAY,
        [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
        body,
    )
        .into_response()
}

async fn handle(Query(q): Query<ProxyQuery>) -> Response {
    let nojs = q.nojs.as_deref() == Some("1");

    let mut current = match Url::parse(&q.url) {
        Ok(u) => u,
        Err(_) => {
            return (StatusCode::BAD_REQUEST, "Invalid url").into_response();
        }
    };

    let mut response = None;

    for hop in 0..=MAX_REDIRECTS {
        // Re-check SSRF on every hop, and pin the validated IP for the fetch so a
        // rebind between check and fetch can't reach a private address.
        let pin = match check_ssrf(&current).await {
            Ssrf::Blocked => return (StatusCode::FORBIDDEN, "Blocked target").into_response(),
            Ssrf::Allow => None,
            Ssrf::Pinned(addrs) => Some(addrs),
        };

        let host = current.host_str().unwrap_or_default().to_string();
        let client = match build_client(pin.as_ref().map(|a| (host.as_str(), a.as_slice()))) {
            Ok(c) => c,
            Err(_) => return error_response(true),
        };

        let resp = match client.get(current.clone()).send().await {
            Ok(r) => r,
            Err(_) => {
                let onion = matches!(current.host(), Some(Host::Domain(d)) if d.to_ascii_lowercase().ends_with(".onion"));
                return error_response(tor_enabled() || onion);
            }
        };

        let status = resp.status();
        if status.is_redirection() {
            if hop == MAX_REDIRECTS {
                return error_response(false);
            }
            if let Some(loc) = resp
                .headers()
                .get(header::LOCATION)
                .and_then(|v| v.to_str().ok())
            {
                match current.join(loc) {
                    Ok(next) => {
                        current = next;
                        continue;
                    }
                    Err(_) => return error_response(false),
                }
            }
        }

        response = Some(resp);
        break;
    }

    let resp = match response {
        Some(r) => r,
        None => return error_response(false),
    };

    let status = resp.status();
    let content_type = resp
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    // Build the allowlisted, hardened response headers.
    let mut out_headers = HeaderMap::new();
    for (name, value) in resp.headers().iter() {
        if FORWARD_HEADERS.contains(&name.as_str().to_ascii_lowercase().as_str()) {
            out_headers.insert(name.clone(), value.clone());
        }
    }
    out_headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("no-store, no-cache, must-revalidate"),
    );
    out_headers.insert(
        header::REFERRER_POLICY,
        HeaderValue::from_static("no-referrer"),
    );
    out_headers.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );

    let is_html =
        content_type.contains("text/html") || content_type.contains("application/xhtml+xml");

    // Cap the body size.
    if let Some(len) = resp.content_length() {
        if len > MAX_RESPONSE_BYTES {
            return error_response(false);
        }
    }

    let body_bytes = match resp.bytes().await {
        Ok(b) if (b.len() as u64) <= MAX_RESPONSE_BYTES => b,
        _ => return error_response(false),
    };

    if is_html {
        out_headers.insert(
            header::CONTENT_TYPE,
            HeaderValue::from_static("text/html; charset=utf-8"),
        );
        if nojs {
            if let Ok(v) = HeaderValue::from_str("script-src 'none'; object-src 'none'") {
                out_headers.insert(HeaderName::from_static("content-security-policy"), v);
            }
        }
        let html = String::from_utf8_lossy(&body_bytes);
        match rewrite_html(&html, &current, nojs) {
            Ok(rewritten) => (status, out_headers, rewritten).into_response(),
            // Fail closed — never serve un-rewritten HTML (would bypass the proxy).
            Err(_) => error_response(false),
        }
    } else {
        (status, out_headers, body_bytes).into_response()
    }
}
