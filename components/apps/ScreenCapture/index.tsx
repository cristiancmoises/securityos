import StyledScreenCapture from "components/apps/ScreenCapture/StyledScreenCapture";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import useScreenCapture from "hooks/useScreenCapture";
import { useState } from "react";

// Screen Capture — a small first-party tool that screenshots (PNG → Pictures) or
// records (WEBM → Desktop) the screen via getDisplayMedia. Captures everything on
// screen, including the Tor Browser and other app iframes. Fully local; nothing
// is uploaded.

const formatElapsed = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}`;
};

const ScreenCapture: FC<ComponentProcessProps> = () => {
  const {
    canRecord,
    canScreenshot,
    countdown,
    isRecording,
    lastCapture,
    recordScreen,
    recordSeconds,
    takeScreenshot,
  } = useScreenCapture();
  const [status, setStatus] = useState("");
  const [delaySeconds, setDelaySeconds] = useState(0);
  const [copyToClipboard, setCopyToClipboard] = useState(false);
  const [microphone, setMicrophone] = useState(false);
  const counting = countdown > 0;

  const onScreenshot = async (): Promise<void> => {
    setStatus(
      delaySeconds > 0
        ? `Capturing in ${delaySeconds}s…`
        : "Choose what to capture…"
    );
    try {
      await takeScreenshot({ copyToClipboard, delaySeconds });
      setStatus(
        copyToClipboard
          ? "📸 Screenshot saved and copied to clipboard."
          : "📸 Screenshot saved to Pictures."
      );
    } catch {
      setStatus("Screenshot cancelled.");
    }
  };

  const onRecord = async (): Promise<void> => {
    const wasRecording = isRecording;

    try {
      await recordScreen({ microphone });
      setStatus(
        wasRecording
          ? "🎬 Recording saved to the Desktop."
          : "Recording… click Stop (or end sharing) to finish."
      );
    } catch {
      setStatus("Recording cancelled.");
    }
  };

  return (
    <StyledScreenCapture>
      <h1>Screen Capture</h1>
      <p className="sub">
        Screenshots save to <b>Pictures</b>, recordings to the <b>Desktop</b>.
        Everything stays on your device — nothing is uploaded.
      </p>
      <div className="options">
        <label>
          Delay
          <select
            disabled={!canScreenshot || isRecording || counting}
            onChange={(event) => setDelaySeconds(Number(event.target.value))}
            value={delaySeconds}
          >
            <option value={0}>Now</option>
            <option value={3}>3s</option>
            <option value={5}>5s</option>
          </select>
        </label>
        <label>
          <input
            checked={copyToClipboard}
            disabled={!canScreenshot || isRecording || counting}
            onChange={(event) => setCopyToClipboard(event.target.checked)}
            type="checkbox"
          />
          Copy to clipboard
        </label>
        <label>
          <input
            checked={microphone}
            disabled={!canRecord || isRecording || counting}
            onChange={(event) => setMicrophone(event.target.checked)}
            type="checkbox"
          />
          Microphone audio
        </label>
      </div>
      <div className="actions">
        <button
          disabled={!canScreenshot || isRecording || counting}
          onClick={onScreenshot}
          type="button"
        >
          {counting ? `📷 Capturing in ${countdown}s` : "📷 Screenshot"}
        </button>
        <button
          className={isRecording ? "recording" : ""}
          disabled={!canRecord || counting}
          onClick={onRecord}
          type="button"
        >
          {isRecording ? "⏹ Stop recording" : "⏺ Record screen"}
        </button>
      </div>
      {counting && <div className="countdown">{countdown}</div>}
      {isRecording && (
        <div className="rec-indicator">
          <span className="dot" />● REC
          <span className="timer">{formatElapsed(recordSeconds)}</span>
        </div>
      )}
      {lastCapture && !isRecording && !counting && (
        <div className="last-capture">
          {lastCapture.thumbnailUrl && (
            <img alt={lastCapture.fileName} src={lastCapture.thumbnailUrl} />
          )}
          <div className="meta">
            <span className="name">{lastCapture.fileName}</span>
            <span className="note">{lastCapture.note}</span>
          </div>
        </div>
      )}
      {status && <div className="status">{status}</div>}
      {!canScreenshot && (
        <div className="status warn">
          Screen capture isn&apos;t available in this browser.
        </div>
      )}
    </StyledScreenCapture>
  );
};

export default ScreenCapture;
