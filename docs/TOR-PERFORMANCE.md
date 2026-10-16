# Tor loading: measurements and reproduction

## What changed

Tor Browser uses the existing proxy ad filter by default, with a reversible
toolbar control. The added onion rule matches only the identified Tordex host's
`/banners/` path. The search engine root, unrelated paths and lookalike hosts
remain allowed. No JavaScript, circuit, DNS, guard or direct-routing policy was
relaxed. Existing per-tab SOCKS connections remain reusable within their own
isolation pool.

The shared Evelin health check also preserves healthy forwarding streams during
a partial application failure. Previously a failed Segfault probe restarted the
shared tunnel used by SecurityOS approximately every minute. The corrected
monitor still exits 1 and logs that partial failure. Its regression checks and
operator guidance are in [deploy/evelin](../deploy/evelin/README.md).

## Measurement protocol

Date: 2026-10-16. Destination: Torch home page, through `https://os.securityops.co`.
Browser: Chromium 153.0.8010.47, a fresh private test profile with normal TLS
validation. Tor Browser app JavaScript policy: Off. Each series has one new-tab
navigation followed by two uses of **Home** in the same tab. Verify the isolation
token stays the same, but do not publish its value.

Record navigation timing from the actual sandbox frame, resolving its frame ID
after each navigation. Record TTFB, DOMContentLoaded, first contentful paint,
stylesheet/logo completion, advertising-resource requests, and window `load`.
Observe each page for 45 seconds after the searchable DOM first appears. A
missing `load` is censored at that point; it is **not** a completed load time.
Do not combine timings from failed automation attempts or different sessions.

Functional checks: submit Torch's native GET search, verify the result document
is HTTP 200, and visit Tor Project's IP check through the same Tor app. The latter
must return `IsTor: true`. Confirm scripts remain disabled and no iframe resource
escapes the SecurityOS proxy origin. Check the advertising toggle in both
directions, including keyboard operation and narrow viewports.

For an independent reproduction, repeat this series with **Ads: Allowed** and
**Ads: Blocked**. Keep the destination and policy identical, record timestamps,
separate cold from warm requests, and report incomplete requests. Onion traffic,
site content, circuits and remote load vary over time: this small diagnostic
sample cannot establish a general speedup for the Tor network.

Raw browser captures must remain private: proxy URLs contain short-lived signed
capabilities and isolation values. Publish only a reviewed, explicitly selected
summary without query URLs, exit IPs, tokens or local paths.

## Baseline

Source revision: `e2b0c8139232fe41d562f7787aa85857390812db`.

| Navigation       |    TTFB | DOMContentLoaded | First contentful paint | Full load                       |
| ---------------- | ------: | ---------------: | ---------------------: | ------------------------------- |
| New tab          | 4.197 s |          4.213 s |                7.000 s | Not observed in the tail window |
| Same tab, warm 1 | 2.307 s |          2.333 s |                5.236 s | Not observed in the tail window |
| Same tab, warm 2 | 2.566 s |          2.588 s |                4.388 s | Not observed in the tail window |

All three documents contained 17 advertising images and the Torch logo.
Only 3, 7 and 7 of the 18 images had completed by the respective observation
ends. The loading indicator remained active, but did not block pointer input.
The native search and Tor IP check passed. These measurements were taken after
the shared watchdog correction, so they isolate the remaining page-resource
problem from repeated tunnel restarts.

The watchdog was separately observed for 155 seconds, spanning two new timer
cycles: its shared tunnel PID stayed unchanged; all 14 SecurityOS home/Tor-status
probes returned HTTP 200. The unrelated failed probe remained visibly failed.

## Português

O ajuste reduz o trabalho necessário para carregar o Torch: bloqueia recursos
publicitários conhecidos antes de iniciar suas transferências. O botão permite
desativar o filtro sem ativar JavaScript ou trocar o isolamento da aba.
O monitor do túnel também passou a preservar conexões saudáveis quando apenas
um serviço falha, mantendo o alerta dessa falha.

Para reproduzir a comparação, use uma sessão nova, uma navegação inicial e duas
recargas pelo botão **Home** na mesma aba. Compare **Ads: Allowed** com
**Ads: Blocked**, mantendo destino e JavaScript iguais. Aguarde 45 segundos após
o formulário de busca aparecer e informe se o carregamento completo não ocorreu.
Verifique a busca e `IsTor: true`. Não publique URLs do proxy nem capturas brutas:
elas contêm valores temporários de isolamento e autorização. Os resultados desta
pequena amostra não representam uma garantia de velocidade para toda a rede Tor.
