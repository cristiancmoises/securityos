import StyledScreenCapture from "components/apps/ScreenCapture/StyledScreenCapture";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import { useProcesses } from "contexts/process";
import useScreenCapture, {
  type LastCapture,
  type QualityPreset,
  type RecordFrameRate,
  type ScreenshotFormat,
} from "hooks/useScreenCapture";
import { useEffect, useState } from "react";

// Screen Capture — a small first-party tool that screenshots (PNG/JPEG → Pictures)
// or records (WEBM → Desktop) the screen via getDisplayMedia. Captures everything
// on screen, including the Tor Browser and other app iframes. Fully local; nothing
// is uploaded.

const formatElapsed = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}`;
};

// A short, human-friendly label for a recording mimeType (codec indicator).
const codecLabel = (mimeType?: string): string => {
  if (!mimeType) return "Auto";
  if (mimeType.includes("vp9")) return "VP9";
  if (mimeType.includes("vp8")) return "VP8";
  if (mimeType.includes("mp4")) return "MP4";
  if (mimeType.includes("webm")) return "WebM";

  return "Auto";
};

const ScreenCapture: FC<ComponentProcessProps> = () => {
  const {
    bestRecordingMimeType,
    cameras,
    canRecord,
    canScreenshot,
    canWebcam,
    countdown,
    isPaused,
    isRecording,
    lastCapture,
    pauseResumeRecording,
    recordScreen,
    recordSeconds,
    refreshCameras,
    takeScreenshot,
  } = useScreenCapture();
  const { open } = useProcesses();
  const [status, setStatus] = useState("");
  const [delaySeconds, setDelaySeconds] = useState(0);
  const [format, setFormat] = useState<ScreenshotFormat>("png");
  const [copyToClipboard, setCopyToClipboard] = useState(false);
  const [microphone, setMicrophone] = useState(false);
  const [webcam, setWebcam] = useState(false);
  const [webcamDeviceId, setWebcamDeviceId] = useState("");
  const [frameRate, setFrameRate] = useState<RecordFrameRate>(30);
  const [quality, setQuality] = useState<QualityPreset>("balanced");
  const [openAfter, setOpenAfter] = useState(true);
  const counting = countdown > 0;
  const codec = codecLabel(bestRecordingMimeType(quality));

  // Populate the camera list when the webcam overlay is first enabled. Request
  // permission so device labels are available; falls back gracefully if denied.
  useEffect(() => {
    if (webcam && canWebcam && cameras.length === 0) {
      refreshCameras(true).catch(() => undefined);
    }
  }, [cameras.length, canWebcam, refreshCameras, webcam]);

  // Keep the chosen camera valid: default to the first available, and reset if
  // the selected device disappears (e.g. unplugged).
  useEffect(() => {
    if (cameras.length === 0) {
      if (webcamDeviceId) setWebcamDeviceId("");
    } else if (!cameras.some((camera) => camera.deviceId === webcamDeviceId)) {
      setWebcamDeviceId(cameras[0].deviceId);
    }
  }, [cameras, webcamDeviceId]);

  // Open the freshly saved capture in its viewer (Photos / VideoPlayer). Never
  // let a failed open break the core save flow.
  const openCapture = (capture: LastCapture): void => {
    if (!openAfter || !capture.path) return;

    try {
      open(capture.kind === "recording" ? "VideoPlayer" : "Photos", {
        url: capture.path,
      });
    } catch {
      // Viewer failed to open — the file is still safely saved on disk.
    }
  };

  const onScreenshot = async (): Promise<void> => {
    setStatus(
      delaySeconds > 0
        ? `Capturing in ${delaySeconds}s…`
        : "Choose what to capture…"
    );
    try {
      const capture = await takeScreenshot({
        copyToClipboard,
        delaySeconds,
        format,
      });

      setStatus(
        copyToClipboard
          ? "📸 Screenshot saved and copied to clipboard."
          : "📸 Screenshot saved to Pictures."
      );
      if (capture) openCapture(capture);
    } catch {
      setStatus("Screenshot cancelled.");
    }
  };

  const onRecord = async (): Promise<void> => {
    const wasRecording = isRecording;

    try {
      const capture = await recordScreen({
        frameRate,
        microphone,
        quality,
        webcam,
        webcamDeviceId,
      });

      setStatus(
        wasRecording
          ? "🎬 Recording saved to the Desktop."
          : "Recording… click Stop (or end sharing) to finish."
      );
      if (wasRecording && capture) openCapture(capture);
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
          Format
          <select
            disabled={!canScreenshot || isRecording || counting}
            onChange={(event) =>
              setFormat(event.target.value as ScreenshotFormat)
            }
            value={format}
          >
            <option value="png">PNG</option>
            <option value="jpeg">JPEG</option>
          </select>
        </label>
        <label>
          Quality
          <select
            disabled={!canRecord || isRecording || counting}
            onChange={(event) =>
              setQuality(event.target.value as QualityPreset)
            }
            value={quality}
          >
            <option value="performance">Performance (720p)</option>
            <option value="balanced">Balanced (1080p)</option>
            <option value="high">High quality (native)</option>
          </select>
        </label>
        <label>
          FPS
          <select
            disabled={!canRecord || isRecording || counting}
            onChange={(event) =>
              setFrameRate(Number(event.target.value) as RecordFrameRate)
            }
            value={frameRate}
          >
            <option value={24}>24</option>
            <option value={30}>30</option>
            <option value={60}>60</option>
          </select>
        </label>
        {canRecord && (
          <span className="codec-badge" title={`Recording codec: ${codec}`}>
            Codec: {codec}
          </span>
        )}
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
        {canWebcam && (
          <label>
            <input
              checked={webcam}
              disabled={!canRecord || isRecording || counting}
              onChange={(event) => setWebcam(event.target.checked)}
              type="checkbox"
            />
            Webcam overlay
          </label>
        )}
        {canWebcam && webcam && (
          <label>
            Camera
            <select
              disabled={!canRecord || isRecording || counting}
              onChange={(event) => setWebcamDeviceId(event.target.value)}
              value={webcamDeviceId}
            >
              {cameras.length === 0 ? (
                <option value="">Default camera</option>
              ) : (
                cameras.map((camera) => (
                  <option key={camera.deviceId} value={camera.deviceId}>
                    {camera.label}
                  </option>
                ))
              )}
            </select>
          </label>
        )}
        <label>
          <input
            checked={openAfter}
            disabled={isRecording || counting}
            onChange={(event) => setOpenAfter(event.target.checked)}
            type="checkbox"
          />
          Open after capture
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
          className={isRecording ? `recording${isPaused ? " paused" : ""}` : ""}
          disabled={!canRecord || counting}
          onClick={onRecord}
          type="button"
        >
          {isRecording ? "⏹ Stop recording" : "⏺ Record screen"}
        </button>
        {isRecording && (
          <button className="pause" onClick={pauseResumeRecording} type="button">
            {isPaused ? "▶ Resume" : "⏸ Pause"}
          </button>
        )}
      </div>
      {counting && <div className="countdown">{countdown}</div>}
      {isRecording && (
        <div className={`rec-indicator${isPaused ? " paused" : ""}`}>
          <span className="dot" />
          {isPaused ? "❚❚ PAUSED" : "● REC"}
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
