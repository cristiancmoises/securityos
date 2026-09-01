import { useCallback, useEffect, useState } from "react";
import type {
  ProxyProfile,
  ProxyRoute,
  ProxyScriptPolicy,
} from "utils/proxyCapability";

type CapabilityState = {
  capability: string;
  error: boolean;
  retry: () => void;
};

type CapabilityResponse = {
  capability?: unknown;
  expiresIn?: unknown;
  route?: unknown;
};

type CachedCapability = { expiresAt: number; token: string };
type CapabilityViewState = {
  error: boolean;
  key: string;
  token: string;
};
const capabilityCache = new Map<string, CachedCapability>();

const cacheKey = (
  route: ProxyRoute,
  profile: ProxyProfile,
  iso: string,
  scriptPolicy: ProxyScriptPolicy
): string => `${route}:${profile}:${iso}:${scriptPolicy}`;

const cachedTokenFor = (key: string): string => {
  const cached = capabilityCache.get(key);

  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  capabilityCache.delete(key);

  return "";
};

export const fetchProxyCapability = async (
  route: ProxyRoute,
  profile: ProxyProfile,
  iso: string,
  scriptPolicy: ProxyScriptPolicy = "all"
): Promise<string> => {
  const key = cacheKey(route, profile, iso, scriptPolicy);
  const cachedToken = cachedTokenFor(key);

  if (cachedToken) return cachedToken;

  const response = await fetch("/api/proxy-capability", {
    body: JSON.stringify({ iso, profile, route, scriptPolicy }),
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-SecurityOS-Client": "desktop",
    },
    method: "POST",
  });

  if (!response.ok) throw new Error("Could not authorize proxy route");

  const result = (await response.json()) as CapabilityResponse;

  if (
    result.route !== route ||
    typeof result.capability !== "string" ||
    result.capability.length < 32 ||
    typeof result.expiresIn !== "number" ||
    result.expiresIn <= 60
  ) {
    throw new Error("Invalid proxy capability response");
  }

  capabilityCache.set(key, {
    expiresAt: Date.now() + result.expiresIn * 1000,
    token: result.capability,
  });

  return result.capability;
};

const useProxyCapability = (
  route: ProxyRoute,
  profile: ProxyProfile,
  iso: string,
  scriptPolicy: ProxyScriptPolicy = "all"
): CapabilityState => {
  const key = cacheKey(route, profile, iso, scriptPolicy);
  const [viewState, setViewState] = useState<CapabilityViewState>(() => ({
    error: false,
    key,
    token: cachedTokenFor(key),
  }));
  const [attempt, setAttempt] = useState(0);
  const capability = viewState.key === key ? viewState.token : "";
  const error = viewState.key === key ? viewState.error : false;
  const retry = useCallback(() => {
    capabilityCache.delete(key);
    setViewState({ error: false, key, token: "" });
    setAttempt((value) => value + 1);
  }, [key]);

  useEffect(() => {
    let active = true;

    setViewState({ error: false, key, token: cachedTokenFor(key) });

    fetchProxyCapability(route, profile, iso, scriptPolicy)
      .then((token) => {
        if (active) setViewState({ error: false, key, token });
      })
      .catch(() => {
        if (active) setViewState({ error: true, key, token: "" });
      });

    return () => {
      active = false;
    };
  }, [attempt, iso, key, profile, route, scriptPolicy]);

  return { capability, error, retry };
};

export default useProxyCapability;
