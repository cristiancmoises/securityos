import StyledVolume from "components/system/Taskbar/Volume/StyledVolume";
import { useSession } from "contexts/session";
import { useCallback, useEffect, useRef, useState } from "react";
import { FOCUSABLE_ELEMENT } from "utils/constants";
import { haltEvent, label } from "utils/functions";

// Taskbar Volume control: a speaker button (scroll to change, click for a slider
// popover, with a mute toggle) wired to the global session volume/muted, which is
// applied to every <audio>/<video> on the desktop. (Webamp/WebAudio apps keep
// their own internal mixer — this reliably governs native media elements.)

const clamp = (value: number): number => Math.min(1, Math.max(0, value));

const VolumeIcon: FC<{ level: number; muted: boolean }> = ({ level, muted }) => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 9v6h4l5 5V4L8 9H4z" />
    {muted || level === 0 ? (
      <path d="M16 8.5l5 5m0-5l-5 5" stroke="currentColor" strokeWidth="2" />
    ) : (
      <>
        {level > 0.05 && <path d="M15.5 8.5a4.5 4.5 0 0 1 0 7" fill="none" stroke="currentColor" strokeWidth="2" />}
        {level > 0.5 && <path d="M18 6a8 8 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="2" />}
      </>
    )}
  </svg>
);

const applyToMedia = (root: ParentNode, volume: number, muted: boolean): void => {
  root.querySelectorAll<HTMLMediaElement>("video, audio").forEach((element) => {
    element.volume = volume;
    element.muted = muted;
  });
};

const Volume: FC = () => {
  const { muted, setMuted, setVolume, volume } = useSession();
  const [showSlider, setShowSlider] = useState(false);
  const lastVolumeRef = useRef(volume || 0.5);
  const containerRef = useRef<HTMLDivElement>(null);

  // Apply the session volume to all current media + any media added later.
  useEffect(() => {
    applyToMedia(document, volume, muted);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLMediaElement) {
            node.volume = volume;
            node.muted = muted;
          } else if (node instanceof Element) {
            applyToMedia(node, volume, muted);
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [muted, volume]);

  // Dismiss the slider on an outside click.
  useEffect(() => {
    if (!showSlider) return undefined;

    const onPointerDown = (event: PointerEvent): void => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowSlider(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);

    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [showSlider]);

  const changeVolume = useCallback(
    (next: number) => {
      const value = clamp(next);

      setVolume(value);
      if (value > 0) {
        lastVolumeRef.current = value;
        if (muted) setMuted(false);
      }
    },
    [muted, setMuted, setVolume]
  );

  const toggleMute = useCallback(() => {
    setMuted((current) => {
      const next = !current;

      if (!next && volume === 0) setVolume(lastVolumeRef.current || 0.5);

      return next;
    });
  }, [setMuted, setVolume, volume]);

  const effective = muted ? 0 : volume;
  const percent = Math.round(effective * 100);

  return (
    <StyledVolume ref={containerRef}>
      <button
        className="volume-button"
        onClick={() => setShowSlider((current) => !current)}
        onWheel={(event) => {
          haltEvent(event);
          changeVolume(volume + (event.deltaY < 0 ? 0.05 : -0.05));
        }}
        type="button"
        {...label(`Volume ${percent}%`)}
        {...FOCUSABLE_ELEMENT}
      >
        <VolumeIcon level={effective} muted={muted} />
      </button>
      {showSlider && (
        <div className="popover">
          <button
            className="mute"
            onClick={toggleMute}
            type="button"
            {...label(muted ? "Unmute" : "Mute")}
          >
            {muted || effective === 0 ? "🔇" : "🔊"}
          </button>
          <input
            max={1}
            min={0}
            onChange={(event) => changeVolume(Number(event.target.value))}
            step={0.01}
            type="range"
            value={effective}
            {...label("Volume")}
          />
          <span className="pct">{percent}%</span>
        </div>
      )}
    </StyledVolume>
  );
};

export default Volume;
