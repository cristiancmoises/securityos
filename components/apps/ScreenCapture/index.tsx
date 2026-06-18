import StyledScreenCapture from "components/apps/ScreenCapture/StyledScreenCapture";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import useScreenCapture from "hooks/useScreenCapture";
import { useState } from "react";

// Screen Capture — a small first-party tool that screenshots (PNG → Pictures) or
// records (WEBM → Desktop) the screen via getDisplayMedia. Captures everything on
// screen, including the Tor Browser and other app iframes. Fully local; nothing
// is uploaded.

const ScreenCapture: FC<ComponentProcessProps> = () => {
  const { canRecord, canScreenshot, isRecording, recordScreen, takeScreenshot } =
    useScreenCapture();
  const [status, setStatus] = useState("");

  const onScreenshot = async (): Promise<void> => {
    setStatus("Choose what to capture…");
    try {
      await takeScreenshot();
      setStatus("📸 Screenshot saved to Pictures.");
    } catch {
      setStatus("Screenshot cancelled.");
    }
  };

  const onRecord = async (): Promise<void> => {
    const wasRecording = isRecording;

    try {
      await recordScreen();
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
      <div className="actions">
        <button disabled={!canScreenshot} onClick={onScreenshot} type="button">
          📷 Screenshot
        </button>
        <button
          className={isRecording ? "recording" : ""}
          disabled={!canRecord}
          onClick={onRecord}
          type="button"
        >
          {isRecording ? "⏹ Stop recording" : "⏺ Record screen"}
        </button>
      </div>
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
