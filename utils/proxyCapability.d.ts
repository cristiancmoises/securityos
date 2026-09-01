export type ProxyRoute = "direct" | "tor";
export type ProxyProfile =
  | "browser"
  | "godseye"
  | "irc"
  | "keywave"
  | "wiki"
  | "zupt";
export type ProxyScriptPolicy = "all" | "noscript" | "off";

export type ProxyCapabilityClaims = {
  exp: number;
  iat: number;
  iso: string;
  nonce: string;
  profile: ProxyProfile;
  route: ProxyRoute;
  scriptPolicy: ProxyScriptPolicy;
};

export type ProxyCapabilityConstraints = Partial<
  Pick<ProxyCapabilityClaims, "iso" | "profile" | "scriptPolicy">
>;

export const CAPABILITY_TTL_SECONDS: number;

export const issueProxyCapability: (
  route: ProxyRoute,
  claims?: ProxyCapabilityConstraints,
  now?: number
) => string;

export const readProxyCapability: (
  token: unknown,
  now?: number
) => ProxyCapabilityClaims | undefined;

export const verifyProxyCapability: (
  token: unknown,
  expectedRoute: ProxyRoute,
  constraints?: ProxyCapabilityConstraints,
  now?: number
) => boolean;
