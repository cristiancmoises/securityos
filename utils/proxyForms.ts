export type ProxyFormFlags = {
  adblock: boolean;
  app: boolean;
  capability: string;
  injectExt: boolean;
  isDirect: boolean;
  iso: string;
  keywave: boolean;
  libreJs: boolean;
  noJs: boolean;
  profile: string;
  zupt: boolean;
};

const escapeAttribute = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

const hiddenInput = (name: string, value = "1"): string =>
  `<input type="hidden" name="${name}" value="${escapeAttribute(value)}">`;

/**
 * Keep GET forms inside the privacy proxy.
 *
 * Browsers replace an action URL's query string with GET fields. Proxy routing
 * and policy flags therefore have to be represented as hidden fields. Missing,
 * empty, and fragment-only actions mean "the current upstream page" and must be
 * made explicit too; otherwise the browser submits against `/api/proxy` itself.
 */
export const rewriteProxyGetForms = (
  html: string,
  base: string,
  origin: string,
  flags: ProxyFormFlags
): string =>
  html.replace(/<form\b([^>]*)>/gi, (whole: string, attrs: string) => {
    const methodMatch = /\smethod\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(
      attrs
    );
    const method = (
      methodMatch?.[2] ??
      methodMatch?.[3] ??
      methodMatch?.[4] ??
      "get"
    )
      .trim()
      .toLowerCase();

    if (method !== "get") return whole;

    // The generic URL-attribute pass has normalized present action values to a
    // quoted proxy URL. An omitted action still needs an explicit current-page
    // target, while empty/#fragment actions resolve against the upstream base.
    const actionMatch = /\saction\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs);
    const action = actionMatch?.[2] ?? actionMatch?.[3] ?? "";
    let proxyTarget = "";

    try {
      const resolved = new URL(action || base, base);
      const proxyOrigin = new URL(origin);

      if (
        resolved.origin === proxyOrigin.origin &&
        resolved.pathname.endsWith("/api/proxy")
      ) {
        proxyTarget = resolved.searchParams.get("url") || "";
      } else {
        resolved.hash = "";
        proxyTarget = resolved.href;
      }
    } catch {
      return whole;
    }

    if (!proxyTarget) return whole;

    const proxyAction = ` action="${origin}/api/proxy"`;
    const nextAttrs = actionMatch
      ? attrs.replace(/\saction\s*=\s*("[^"]*"|'[^']*')/i, proxyAction)
      : `${attrs}${proxyAction}`;
    const hidden =
      hiddenInput("__pxurl", proxyTarget) +
      (flags.noJs ? hiddenInput("nojs") : "") +
      (flags.injectExt ? hiddenInput("ext") : "") +
      (flags.libreJs ? hiddenInput("librejs") : "") +
      (flags.adblock ? hiddenInput("adblock") : "") +
      (flags.isDirect ? hiddenInput("direct") : "") +
      (flags.app ? hiddenInput("app") : "") +
      (flags.keywave ? hiddenInput("keywave") : "") +
      (flags.zupt ? hiddenInput("zupt") : "") +
      (flags.iso ? hiddenInput("iso", flags.iso) : "") +
      (flags.profile ? hiddenInput("profile", flags.profile) : "") +
      (flags.capability ? hiddenInput("cap", flags.capability) : "");

    return `<form${nextAttrs}>${hidden}`;
  });
