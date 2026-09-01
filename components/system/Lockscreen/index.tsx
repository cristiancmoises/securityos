import StyledLockscreen from "components/system/Lockscreen/StyledLockscreen";
import useLock, {
  getIdleMinutes,
  hasPin as hasPinStored,
  lockScreen,
  setIdleMinutes,
  setPin,
} from "components/system/Lockscreen/useLock";
import useLockClock from "components/system/Lockscreen/useLockClock";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PREVENT_SCROLL } from "utils/constants";
import { haltEvent, label } from "utils/functions";

const SWIPE_THRESHOLD = 60;

/**
 * Read the live wallpaper that useWallpaper applied to the document element so
 * the lock screen shows the SAME blurred background. Falls back to the solid
 * theme background (set on .backdrop in CSS) when no image wallpaper is set.
 */
const useWallpaperBackground = (active: boolean): string => {
  const [background, setBackground] = useState("");

  useEffect(() => {
    if (active) {
      setBackground(document.documentElement.style.background || "");
    }
  }, [active]);

  return background;
};

/**
 * Idle auto-lock. Called once by <Lockscreen />. Watches user activity and locks
 * after the configured idle interval; default off (0 minutes).
 */
const useIdleAutoLock = (isLocked: boolean): void => {
  useEffect(() => {
    if (isLocked) return undefined;

    const minutes = getIdleMinutes();

    if (minutes <= 0) return undefined;

    const timeoutMs = minutes * 60 * 1000;
    let timer = window.setTimeout(lockScreen, timeoutMs);

    const reset = (): void => {
      window.clearTimeout(timer);
      timer = window.setTimeout(lockScreen, timeoutMs);
    };

    const events: (keyof DocumentEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "wheel",
    ];

    events.forEach((event) =>
      document.addEventListener(event, reset, { passive: true })
    );

    return () => {
      window.clearTimeout(timer);
      events.forEach((event) => document.removeEventListener(event, reset));
    };
  }, [isLocked]);
};

const Chevron: FC = () => (
  <svg
    aria-hidden="true"
    height="22"
    viewBox="0 0 24 24"
    width="22"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M6 15l6-6 6 6"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.5"
    />
  </svg>
);

const Lockscreen: FC = () => {
  const { isLocked, unlock } = useLock();
  const { date, time } = useLockClock(isLocked);
  const background = useWallpaperBackground(isLocked);

  // Idle auto-lock (no-op unless a non-zero interval is configured).
  useIdleAutoLock(isLocked);

  const [pin, setPinValue] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  // Re-read the stored PIN whenever we (re)lock OR return from the settings panel,
  // so setting/removing a PIN ON the lock screen takes effect immediately (no
  // refresh). Memoizing on [isLocked] alone left the UI in passwordless "swipe to
  // unlock" mode — with no PIN field to type into — right after a PIN was set.
  const pinRequired = useMemo(() => hasPinStored(), [isLocked, showSettings]);

  const pinInputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);

  // Reset transient UI whenever we (re)lock.
  useEffect(() => {
    if (isLocked) {
      setPinValue("");
      setError("");
      setShake(false);
      setShowSettings(false);
      // Pull focus into the overlay so global key handlers don't fire and the
      // PIN field (if any) is ready.
      window.setTimeout(() => {
        if (pinInputRef.current) pinInputRef.current.focus(PREVENT_SCROLL);
        else overlayRef.current?.focus(PREVENT_SCROLL);
      }, 0);
    }
  }, [isLocked]);

  const triggerShake = useCallback(() => {
    setShake(true);
    window.setTimeout(() => setShake(false), 500);
  }, []);

  const attemptUnlock = useCallback(
    async (candidate = "") => {
      const ok = await unlock(candidate);

      if (!ok) {
        setError("Incorrect PIN");
        setPinValue("");
        triggerShake();
        pinInputRef.current?.focus(PREVENT_SCROLL);
      }
    },
    [triggerShake, unlock]
  );

  // Swipe-up / click / Enter to unlock when no PIN is set.
  const onSimpleUnlock = useCallback(() => {
    if (showSettings) return;
    // Re-read the stored PIN LIVE (not the render flag): a passwordless unlock must
    // NEVER fire when a PIN exists, even if the render state is briefly stale — focus
    // the PIN field instead so the user types it.
    if (hasPinStored()) {
      pinInputRef.current?.focus(PREVENT_SCROLL);

      return;
    }
    attemptUnlock();
  }, [attemptUnlock, showSettings]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      // Keep all keystrokes inside the overlay; never leak to the desktop.
      if (event.key === "Enter" && !showSettings) {
        haltEvent(event);
        if (pinRequired) attemptUnlock(pin);
        else attemptUnlock();
      }
    },
    [attemptUnlock, pin, pinRequired, showSettings]
  );

  // Swipe-up via POINTER events so it works for mouse-drag (desktop) AND touch —
  // the old touch-only handlers did nothing when dragging with a mouse, so "swipe
  // up" appeared broken on the desktop.
  const onPointerDown = useCallback((event: React.PointerEvent) => {
    touchStartY.current = event.clientY;
  }, []);

  const onPointerUp = useCallback(
    (event: React.PointerEvent) => {
      const startY = touchStartY.current;

      touchStartY.current = null;
      if (startY === null) return;

      if (startY - event.clientY > SWIPE_THRESHOLD) onSimpleUnlock();
    },
    [onSimpleUnlock]
  );

  if (!isLocked) return null;

  return (
    <StyledLockscreen
      ref={overlayRef}
      onContextMenu={haltEvent}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      role="dialog"
      style={background ? { background } : undefined}
      tabIndex={-1}
      {...label("Locked")}
    >
      <div
        className="backdrop"
        style={background ? { background } : undefined}
      />
      <div className="scrim" />

      <div className="clock-area">
        <div className="time">{time}</div>
        <div className="date">{date}</div>
      </div>

      {showSettings ? (
        <PinSettings onClose={() => setShowSettings(false)} />
      ) : (
        <div className={`card${shake ? " shake" : ""}`}>
          {pinRequired ? (
            <>
              <div className="hint">Enter PIN to unlock</div>
              <div className="pin-row">
                <input
                  ref={pinInputRef}
                  autoComplete="off"
                  inputMode="numeric"
                  maxLength={12}
                  onChange={(event) => {
                    setError("");
                    setPinValue(event.target.value.replace(/\D/g, ""));
                  }}
                  type="password"
                  value={pin}
                  {...label("PIN")}
                />
                <button
                  onClick={() => attemptUnlock(pin)}
                  type="button"
                  {...label("Unlock")}
                >
                  →
                </button>
              </div>
              <div className="error">{error}</div>
            </>
          ) : (
            <div
              className="swipe"
              onClick={onSimpleUnlock}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  haltEvent(event);
                  onSimpleUnlock();
                }
              }}
              role="button"
              tabIndex={0}
              {...label("Unlock")}
            >
              <span className="chevron">
                <Chevron />
              </span>
              <div className="hint">Click, press Enter, or swipe up</div>
            </div>
          )}
        </div>
      )}

      {!showSettings && (
        <button
          className="settings"
          onClick={() => setShowSettings(true)}
          type="button"
        >
          {pinRequired ? "Change PIN" : "Set PIN"}
        </button>
      )}
    </StyledLockscreen>
  );
};

type PinSettingsProps = {
  onClose: () => void;
};

const PinSettings: FC<PinSettingsProps> = ({ onClose }) => {
  const existing = useMemo(() => hasPinStored(), []);
  const [pin1, setPin1] = useState("");
  const [pin2, setPin2] = useState("");
  const [idle, setIdle] = useState(() => getIdleMinutes());
  const [message, setMessage] = useState("");

  const save = useCallback(async () => {
    if (pin1 && pin1 !== pin2) {
      setMessage("PINs do not match");

      return;
    }

    if (pin1 && pin1.length < 4) {
      setMessage("Use at least 4 digits");

      return;
    }

    await setPin(pin1);
    // Confirm it actually persisted. PIN hashing needs crypto.subtle, which is only
    // available in a SECURE context (HTTPS or localhost); over plain http://<ip> it
    // silently no-ops, which would leave the lock passwordless without the user
    // knowing. Surface that instead of pretending the PIN was set.
    if (pin1 && !hasPinStored()) {
      setMessage(
        "Couldn't save PIN — open SecurityOS over HTTPS (or localhost)."
      );

      return;
    }
    setIdleMinutes(idle);
    onClose();
  }, [idle, onClose, pin1, pin2]);

  const removePin = useCallback(async () => {
    await setPin("");
    setIdleMinutes(idle);
    onClose();
  }, [idle, onClose]);

  return (
    <div className="card">
      <div className="pin-setup">
        <div className="hint">{existing ? "Change PIN" : "Set a PIN"}</div>
        <label htmlFor="lock-pin-1">New PIN (digits, optional)</label>
        <input
          id="lock-pin-1"
          autoComplete="off"
          inputMode="numeric"
          maxLength={12}
          onChange={(event) => {
            setMessage("");
            setPin1(event.target.value.replace(/\D/g, ""));
          }}
          type="password"
          value={pin1}
        />
        <label htmlFor="lock-pin-2">Confirm PIN</label>
        <input
          id="lock-pin-2"
          autoComplete="off"
          inputMode="numeric"
          maxLength={12}
          onChange={(event) => {
            setMessage("");
            setPin2(event.target.value.replace(/\D/g, ""));
          }}
          type="password"
          value={pin2}
        />
        <div className="idle">
          <label htmlFor="lock-idle">Auto-lock after (min, 0 = off)</label>
          <input
            id="lock-idle"
            inputMode="numeric"
            onChange={(event) =>
              setIdle(Number(event.target.value.replace(/\D/g, "")) || 0)
            }
            type="text"
            value={idle}
          />
        </div>
        <div className="error">{message}</div>
        <div className="actions">
          {existing && (
            <button onClick={removePin} type="button">
              Remove PIN
            </button>
          )}
          <button onClick={onClose} type="button">
            Cancel
          </button>
          <button onClick={save} type="button">
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default Lockscreen;
