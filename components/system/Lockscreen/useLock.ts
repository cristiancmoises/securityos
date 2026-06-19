import { useCallback, useEffect, useSyncExternalStore } from "react";

/**
 * Lock-screen state for SecurityOS.
 *
 * This is an amnesic OS with no real accounts, so "locking" is a UI gate, not a
 * security boundary. State lives in a tiny module-level store (no Context wiring
 * required — just render <Lockscreen /> once and call lockScreen() anywhere):
 *
 *  - `isLocked` persists in sessionStorage so a page reload stays locked (and
 *    clears when the tab closes — amnesic).
 *  - An OPTIONAL unlock PIN is stored as a salted SHA-256 hash in localStorage.
 *    If no PIN is set, any unlock gesture (Enter / click / swipe-up) unlocks.
 *  - Optional idle auto-lock interval (minutes) is stored in localStorage;
 *    default off (0).
 *
 * Everything is dependency-free and CSP-clean (crypto.subtle, Web Storage).
 */

const LOCKED_KEY = "securityos:locked";
const PIN_KEY = "securityos:lockPinHash";
const IDLE_KEY = "securityos:lockIdleMinutes";

// Fixed salt — this is obfuscation, not authentication (amnesic OS, client-only).
const PIN_SALT = "securityos:lock:v1";

type LockState = {
  isLocked: boolean;
};

type Listener = () => void;

const listeners = new Set<Listener>();

const readPersistedLocked = (): boolean => {
  try {
    return window.sessionStorage.getItem(LOCKED_KEY) === "1";
  } catch {
    return false;
  }
};

let state: LockState = {
  // SSR-safe: window is undefined on the server, so start unlocked and let the
  // first client subscribe re-sync from sessionStorage.
  isLocked: typeof window === "undefined" ? false : readPersistedLocked(),
};

const emit = (): void => {
  listeners.forEach((listener) => listener());
};

const setState = (next: Partial<LockState>): void => {
  state = { ...state, ...next };
  emit();
};

const persistLocked = (locked: boolean): void => {
  try {
    if (locked) window.sessionStorage.setItem(LOCKED_KEY, "1");
    else window.sessionStorage.removeItem(LOCKED_KEY);
  } catch {
    // Ignore storage failures (private mode / disabled storage).
  }
};

const subscribe = (listener: Listener): (() => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = (): boolean => state.isLocked;

const getServerSnapshot = (): boolean => false;

/** Lock the desktop. Safe to call from any button/handler (imperative). */
export const lockScreen = (): void => {
  if (state.isLocked) return;
  persistLocked(true);
  setState({ isLocked: true });
};

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

/** SHA-256 of (salt + pin). Returns "" if Web Crypto is unavailable. */
export const hashPin = async (pin: string): Promise<string> => {
  if (typeof crypto === "undefined" || !crypto.subtle) return "";

  const data = new TextEncoder().encode(`${PIN_SALT}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);

  return toHex(digest);
};

export const hasPin = (): boolean => {
  try {
    return Boolean(window.localStorage.getItem(PIN_KEY));
  } catch {
    return false;
  }
};

/** Set/replace the unlock PIN. Pass "" to remove it. */
export const setPin = async (pin: string): Promise<void> => {
  try {
    if (!pin) {
      window.localStorage.removeItem(PIN_KEY);

      return;
    }

    const digest = await hashPin(pin);

    if (digest) window.localStorage.setItem(PIN_KEY, digest);
  } catch {
    // Ignore storage failures.
  }
};

const verifyPin = async (pin: string): Promise<boolean> => {
  let stored = "";

  try {
    stored = window.localStorage.getItem(PIN_KEY) || "";
  } catch {
    stored = "";
  }

  if (!stored) return true; // No PIN configured => any attempt unlocks.

  const digest = await hashPin(pin);

  // Constant-ish comparison; both are fixed-length hex when crypto is present.
  return Boolean(digest) && digest === stored;
};

export const getIdleMinutes = (): number => {
  try {
    return Number(window.localStorage.getItem(IDLE_KEY)) || 0;
  } catch {
    return 0;
  }
};

export const setIdleMinutes = (minutes: number): void => {
  try {
    const value = Math.max(0, Math.floor(minutes));

    if (value > 0) window.localStorage.setItem(IDLE_KEY, String(value));
    else window.localStorage.removeItem(IDLE_KEY);
  } catch {
    // Ignore storage failures.
  }
};

export type UseLock = {
  hasPin: () => boolean;
  isLocked: boolean;
  lock: () => void;
  unlock: (pin?: string) => Promise<boolean>;
};

const useLock = (): UseLock => {
  const isLocked = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  // After hydration, re-sync from sessionStorage (in case the SSR snapshot was
  // unlocked but the tab was reloaded while locked).
  useEffect(() => {
    const persisted = readPersistedLocked();

    if (persisted !== state.isLocked) setState({ isLocked: persisted });
  }, []);

  const lock = useCallback(() => lockScreen(), []);

  const unlock = useCallback(async (pin = ""): Promise<boolean> => {
    const ok = await verifyPin(pin);

    if (ok) {
      persistLocked(false);
      setState({ isLocked: false });
    }

    return ok;
  }, []);

  return { hasPin, isLocked, lock, unlock };
};

export default useLock;
