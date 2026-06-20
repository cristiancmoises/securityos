import {
  createWebcamEffectState,
  DEFAULT_WEBCAM_EFFECT,
  drawWebcamEffect,
  WEBCAM_EFFECT_OPTIONS,
  type WebcamEffect,
} from "components/apps/ScreenCapture/effects";
import StyledScreenCapture from "components/apps/ScreenCapture/StyledScreenCapture";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import { useProcesses } from "contexts/process";
import useScreenCapture, {
  type LastCapture,
  type PipPosition,
  type PipSize,
  type QualityPreset,
  type RecordFrameRate,
  type ScreenshotFormat,
} from "hooks/useScreenCapture";
import { useEffect, useRef, useState } from "react";

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
    canSystemAudio,
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
  // Canvas for the small live webcam-effect preview shown while configuring the
  // overlay (before a recording starts).
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("");
  const [delaySeconds, setDelaySeconds] = useState(0);
  const [format, setFormat] = useState<ScreenshotFormat>("png");
  const [copyToClipboard, setCopyToClipboard] = useState(false);
  const [microphone, setMicrophone] = useState(false);
  const [systemAudio, setSystemAudio] = useState(true);
  const [webcam, setWebcam] = useState(false);
  const [webcamDeviceId, setWebcamDeviceId] = useState("");
  const [webcamPosition, setWebcamPosition] =
    useState<PipPosition>("bottom-right");
  const [webcamSize, setWebcamSize] = useState<PipSize>("medium");
  const [webcamEffect, setWebcamEffect] =
    useState<WebcamEffect>(DEFAULT_WEBCAM_EFFECT);
  const [frameRate, setFrameRate] = useState<RecordFrameRate>(30);
  const [quality, setQuality] = useState<QualityPreset>("balanced");
  // Pre-recording countdown (seconds) before the recorder starts.
  const [recordDelaySeconds, setRecordDelaySeconds] = useState(0);
  // Optional auto-stop after this many seconds (0 = off).
  const [maxDurationSeconds, setMaxDurationSeconds] = useState(0);
  const [openAfter, setOpenAfter] = useState(true);
  // Which action a visible countdown belongs to, so the right button shows the
  // right label (and the recording one stays clickable to cancel).
  const [countdownKind, setCountdownKind] = useState<"screenshot" | "record">(
    "screenshot"
  );
  const counting = countdown > 0;
  const recordCounting = counting && countdownKind === "record";
  const screenshotCounting = counting && countdownKind === "screenshot";
  const codec = codecLabel(bestRecordingMimeType(quality));

  // Record/Stop button label: cancellable during a pre-recording countdown.
  let recordButtonLabel = "⏺ Record screen";

  if (isRecording) recordButtonLabel = "⏹ Stop recording";
  else if (recordCounting) recordButtonLabel = `✕ Cancel (${countdown}s)`;

  // System/tab audio can't be captured on every browser (e.g. Firefox). Keep
  // the toggle off + disabled there so the user isn't misled.
  useEffect(() => {
    if (!canSystemAudio && systemAudio) setSystemAudio(false);
  }, [canSystemAudio, systemAudio]);

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

  // Whether the small live webcam-effect preview should be active: the overlay
  // is enabled and we're idle (not counting/recording — the recorder owns the
  // camera then, and most browsers won't open it twice).
  const showWebcamPreview =
    canWebcam && webcam && !isRecording && !counting;

  // Live preview of the chosen webcam theme. Opens a low-res webcam stream and
  // runs the same effect renderer used by the recording draw loop, so the user
  // sees exactly what the PiP overlay will look like. Fully fail-soft: any
  // permission/effect error just leaves the preview blank and never disrupts
  // the recording flow. The stream is released as soon as the preview hides.
  useEffect(() => {
    if (!showWebcamPreview) return undefined;

    let stream: MediaStream | undefined;
    let rafId = 0;
    let cancelled = false;
    const video = document.createElement("video");
    const effectState = createWebcamEffectState();

    const start = async (): Promise<void> => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: webcamDeviceId
            ? { deviceId: { exact: webcamDeviceId } }
            : true,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());

          return;
        }
        video.srcObject = stream;
        video.muted = true;
        await video.play();

        const render = (): void => {
          const canvas = previewCanvasRef.current;
          const context = canvas?.getContext("2d");

          if (canvas && context) {
            try {
              drawWebcamEffect(
                context,
                video,
                canvas.width,
                canvas.height,
                webcamEffect,
                effectState
              );
            } catch {
              // An effect bug must never break the preview loop.
            }
          }
          rafId = requestAnimationFrame(render);
        };

        render();
      } catch {
        // Camera denied/unavailable — leave the preview blank.
      }
    };

    start();

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [showWebcamPreview, webcamDeviceId, webcamEffect]);

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
    setCountdownKind("screenshot");
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
    const wasCounting = counting;

    if (!wasRecording && !wasCounting && recordDelaySeconds > 0) {
      setCountdownKind("record");
      setStatus(`Recording in ${recordDelaySeconds}s…`);
    }

    try {
      const capture = await recordScreen({
        delaySeconds: wasRecording ? 0 : recordDelaySeconds,
        frameRate,
        maxDurationSeconds: wasRecording ? 0 : maxDurationSeconds,
        microphone,
        quality,
        systemAudio,
        webcam,
        webcamDeviceId,
        webcamEffect,
        webcamPosition,
        webcamSize,
      });

      // A second click during the pre-recording countdown cancels it: nothing
      // was recording, nothing came back, and the live recording never started.
      if (wasCounting && !isRecording) {
        setStatus("Recording cancelled.");

        return;
      }

      let startedStatus = "Recording… click Stop (or end sharing) to finish.";

      if (maxDurationSeconds > 0) {
        startedStatus = `Recording… auto-stops after ${Math.round(
          maxDurationSeconds / 60
        )} min (or click Stop).`;
      }

      setStatus(
        wasRecording ? "🎬 Recording saved to the Desktop." : startedStatus
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
        <label>
          Record delay
          <select
            disabled={!canRecord || isRecording || counting}
            onChange={(event) =>
              setRecordDelaySeconds(Number(event.target.value))
            }
            value={recordDelaySeconds}
          >
            <option value={0}>Now</option>
            <option value={3}>3s</option>
            <option value={5}>5s</option>
          </select>
        </label>
        <label>
          Stop after
          <select
            disabled={!canRecord || isRecording || counting}
            onChange={(event) =>
              setMaxDurationSeconds(Number(event.target.value))
            }
            value={maxDurationSeconds}
          >
            <option value={0}>Off</option>
            <option value={60}>1 min</option>
            <option value={300}>5 min</option>
            <option value={600}>10 min</option>
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
        <label
          title={
            canSystemAudio
              ? "Capture system / tab audio in the recording"
              : "System audio capture isn't supported in this browser"
          }
        >
          <input
            checked={systemAudio}
            disabled={!canRecord || !canSystemAudio || isRecording || counting}
            onChange={(event) => setSystemAudio(event.target.checked)}
            type="checkbox"
          />
          System audio
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
        {canWebcam && webcam && (
          <label>
            Webcam position
            <select
              disabled={!canRecord || isRecording || counting}
              onChange={(event) =>
                setWebcamPosition(event.target.value as PipPosition)
              }
              value={webcamPosition}
            >
              <option value="bottom-right">Bottom-right</option>
              <option value="bottom-left">Bottom-left</option>
              <option value="top-right">Top-right</option>
              <option value="top-left">Top-left</option>
            </select>
          </label>
        )}
        {canWebcam && webcam && (
          <label>
            Webcam size
            <select
              disabled={!canRecord || isRecording || counting}
              onChange={(event) => setWebcamSize(event.target.value as PipSize)}
              value={webcamSize}
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </label>
        )}
        {canWebcam && webcam && (
          <label
            title={
              webcamEffect === "background-blur"
                ? "Best-effort background blur (true segmentation needs a self-hosted model)"
                : "Visual theme applied to the webcam overlay"
            }
          >
            Webcam theme
            <select
              disabled={!canRecord || isRecording || counting}
              onChange={(event) =>
                setWebcamEffect(event.target.value as WebcamEffect)
              }
              value={webcamEffect}
            >
              {WEBCAM_EFFECT_OPTIONS.map((effect) => (
                <option key={effect.value} value={effect.value}>
                  {effect.label}
                </option>
              ))}
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
      {showWebcamPreview && (
        <div className="webcam-preview">
          <canvas height={120} ref={previewCanvasRef} width={160} />
          <span className="preview-label">Webcam theme preview</span>
        </div>
      )}
      <div className="actions">
        <button
          className="shoot-btn"
          disabled={!canScreenshot || isRecording || counting}
          onClick={onScreenshot}
          type="button"
        >
          {screenshotCounting
            ? `📷 Capturing in ${countdown}s`
            : "📷 Screenshot"}
        </button>
        <button
          className={`rec-btn${
            isRecording ? ` recording${isPaused ? " paused" : ""}` : ""
          }`}
          // Disabled only during a screenshot countdown; a recording countdown
          // keeps this clickable so the user can cancel it.
          disabled={!canRecord || screenshotCounting}
          onClick={onRecord}
          type="button"
        >
          {recordButtonLabel}
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
