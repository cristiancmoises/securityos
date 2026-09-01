import {
  createWebcamEffectState,
  DEFAULT_WEBCAM_EFFECT,
  drawWebcamEffect,
  wantsPlatformBackgroundBlur,
  type WebcamEffect,
} from "components/apps/ScreenCapture/effects";
import { useFileSystem } from "contexts/fileSystem";
import { join } from "path";
import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_LOCALE, DESKTOP_PATH, PICTURES_FOLDER } from "utils/constants";
import { bufferToBlob, isFirefox, isSafari } from "utils/functions";

// Re-export so the UI can import the webcam effect type from the hook alongside
// the other capture option types it already imports.
export type { WebcamEffect } from "components/apps/ScreenCapture/effects";

// Shared screen-capture engine: screen RECORDING (webm video → Desktop) and
// SCREENSHOT (png/jpeg → Pictures), both via getDisplayMedia so they faithfully
// capture everything on screen — including cross-origin app iframes (Tor Browser,
// SecTube). Used by the Screen Capture app and the desktop context menu.

const CAPTURE_FPS = 30;
const MIME_VIDEO_WEBM = "video/webm";
const MIME_VIDEO_MP4 = "video/mp4";
const MIME_VIDEO_WEBM_VP9 = "video/webm;codecs=vp9";
const MIME_VIDEO_WEBM_VP8 = "video/webm;codecs=vp8";
const MIME_IMAGE_PNG = "image/png";
const MIME_IMAGE_JPEG = "image/jpeg";
const JPEG_QUALITY = 0.92;

// Recording quality / performance presets. Each preset drives both the
// getDisplayMedia video constraints (ideal width/height) and the MediaRecorder
// videoBitsPerSecond, so weaker machines can record smoothly while strong ones
// keep native fidelity. `maxHeight === undefined` means "native resolution"
// (no downscale constraint). `preferVp8` records VP8 for broadest playback at
// lower CPU cost; the others prefer VP9 for better quality-per-size.
export type QualityPreset = "performance" | "balanced" | "high";

type QualityPresetConfig = {
  bitsPerSecond: number;
  maxHeight?: number;
  maxWidth?: number;
  preferVp8: boolean;
};

const QUALITY_PRESETS: Record<QualityPreset, QualityPresetConfig> = {
  // Smooth on weak machines: downscale to ~720p, low bitrate, prefer VP8.
  performance: {
    bitsPerSecond: 2_500_000,
    maxHeight: 720,
    maxWidth: 1280,
    preferVp8: true,
  },
  // Default: ~1080p, medium bitrate, VP9 when available.
  balanced: {
    bitsPerSecond: 6_000_000,
    maxHeight: 1080,
    maxWidth: 1920,
    preferVp8: false,
  },
  // Native resolution, high bitrate, VP9 when available.
  high: {
    bitsPerSecond: 12_000_000,
    preferVp8: false,
  },
};

const DEFAULT_QUALITY: QualityPreset = "balanced";

// Best-supported recording mimeType, preferring quality-per-size codecs. VP9 →
// VP8 → generic WebM → MP4. For the Performance preset VP8 is preferred first to
// save CPU on weak machines. Returns undefined if none can be probed (the
// MediaRecorder then falls back to the platform default).
const pickRecordingMimeType = (preferVp8: boolean): string | undefined => {
  const isSupported = (type: string): boolean =>
    typeof MediaRecorder !== "undefined" &&
    typeof MediaRecorder.isTypeSupported === "function" &&
    MediaRecorder.isTypeSupported(type);

  const order = preferVp8
    ? [
        MIME_VIDEO_WEBM_VP8,
        MIME_VIDEO_WEBM_VP9,
        MIME_VIDEO_WEBM,
        MIME_VIDEO_MP4,
      ]
    : [
        MIME_VIDEO_WEBM_VP9,
        MIME_VIDEO_WEBM_VP8,
        MIME_VIDEO_WEBM,
        MIME_VIDEO_MP4,
      ];

  return order.find((type) => isSupported(type));
};

// Inset (px) of the webcam picture-in-picture from the screen edges and the
// default fraction of the screen width it occupies.
const PIP_MARGIN = 24;
const PIP_WIDTH_RATIO = 0.22;

// Webcam picture-in-picture placement + size. The corner the overlay is pinned
// to, and the fraction of the screen width it occupies for each size step.
export type PipPosition =
  | "bottom-right"
  | "bottom-left"
  | "top-right"
  | "top-left";
export type PipSize = "small" | "medium" | "large";

const PIP_SIZE_RATIOS: Record<PipSize, number> = {
  small: 0.15,
  medium: 0.22,
  large: 0.3,
};

const DEFAULT_PIP_POSITION: PipPosition = "bottom-right";
const DEFAULT_PIP_SIZE: PipSize = "medium";
const TIME_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  month: "2-digit",
  second: "2-digit",
  year: "numeric",
};

export type ScreenshotFormat = "png" | "jpeg";
export type RecordFrameRate = 24 | 30 | 60;

const timeStamp = (): string =>
  new Intl.DateTimeFormat(DEFAULT_LOCALE, TIME_DATE_FORMAT)
    .format(new Date())
    .replace(/[/:]/g, "-")
    .replace(",", "");

// Whether this browser can plausibly capture system/tab audio via
// getDisplayMedia. Firefox historically ignores the audio/systemAudio
// constraints for display capture; Safari doesn't support recording at all.
export const canCaptureSystemAudio = (): boolean =>
  typeof navigator !== "undefined" &&
  typeof navigator.mediaDevices?.getDisplayMedia === "function" &&
  !isFirefox() &&
  !isSafari();

const displayOptions = (
  frameRate: number,
  preset?: QualityPresetConfig,
  // When defined, explicitly request (true) or suppress (false) system/tab
  // audio capture. Undefined preserves the historical default (request it on
  // browsers that support it). Screenshots never need audio.
  systemAudio?: boolean
): DisplayMediaStreamOptions => {
  // `ideal` width/height let the browser downscale toward the preset target
  // without hard-failing if the display is smaller (or no constraint exists).
  const video: MediaTrackConstraints = { frameRate };

  if (preset?.maxWidth) video.width = { ideal: preset.maxWidth };
  if (preset?.maxHeight) video.height = { ideal: preset.maxHeight };

  // Resolve whether to ask for system audio. Default ON for supported browsers
  // (preserves prior behavior); honor an explicit false to opt out.
  const wantSystemAudio =
    systemAudio === undefined ? canCaptureSystemAudio() : systemAudio;

  return {
    video,
    ...(wantSystemAudio && { audio: true }),
    ...(!isFirefox() &&
      !isSafari() && {
        preferCurrentTab: false,
        selfBrowserSurface: "include",
        surfaceSwitching: "include",
        systemAudio: wantSystemAudio ? "include" : "exclude",
      }),
  } as DisplayMediaStreamOptions;
};

export type ScreenshotOptions = {
  copyToClipboard?: boolean;
  delaySeconds?: number;
  format?: ScreenshotFormat;
};

export type RecordOptions = {
  // Optional 3-2-1 style countdown (seconds) before the MediaRecorder starts.
  // 0/undefined starts immediately.
  delaySeconds?: number;
  frameRate?: RecordFrameRate;
  // Optionally auto-stop the recording after this many seconds. 0/undefined =
  // no automatic stop (record until manually stopped).
  maxDurationSeconds?: number;
  microphone?: boolean;
  // Override the auto-selected best codec mimeType (auto-best is the default).
  mimeType?: string;
  // Recording quality / performance preset (defaults to "balanced").
  quality?: QualityPreset;
  // Explicitly capture system/tab audio. Defaults to ON for browsers that
  // support it (preserving prior behavior); set false to opt out. Independent
  // of `microphone`.
  systemAudio?: boolean;
  webcam?: boolean;
  // deviceId of the camera to use for the webcam PiP overlay. Omitted/empty →
  // the system default camera.
  webcamDeviceId?: string;
  // Visual effect / theme applied to the webcam PiP overlay in the draw loop
  // (defaults to "none"). See components/apps/ScreenCapture/effects.ts.
  webcamEffect?: WebcamEffect;
  // Corner the webcam PiP overlay is pinned to (defaults to bottom-right).
  webcamPosition?: PipPosition;
  // Size of the webcam PiP overlay as a width fraction (defaults to medium).
  webcamSize?: PipSize;
};

// A selectable camera, as surfaced to the UI. `label` may be empty until the
// user has granted camera permission at least once.
export type CameraDevice = {
  deviceId: string;
  label: string;
};

export type LastCapture = {
  fileName: string;
  kind: "recording" | "screenshot";
  note?: string;
  // Absolute path to the saved file (for auto-open in Photos / VideoPlayer).
  path?: string;
  thumbnailUrl?: string;
};

type UseScreenCapture = {
  // The available video-input (camera) devices for the webcam PiP overlay.
  cameras: CameraDevice[];
  // The mimeType that would be used to record at the given quality preset, e.g.
  // "video/webm;codecs=vp9" — for a small codec indicator in the UI. undefined
  // when nothing can be probed (platform default would be used).
  bestRecordingMimeType: (quality?: QualityPreset) => string | undefined;
  // Whether system/tab audio capture is plausibly supported (for a UI toggle).
  canSystemAudio: boolean;
  canRecord: boolean;
  canScreenshot: boolean;
  canWebcam: boolean;
  countdown: number;
  isPaused: boolean;
  isRecording: boolean;
  lastCapture?: LastCapture;
  pauseResumeRecording: () => void;
  recordSeconds: number;
  // Resolves with the saved capture when a recording is STOPPED (so callers can
  // auto-open it); resolves undefined when a recording is merely started.
  recordScreen: (options?: RecordOptions) => Promise<LastCapture | undefined>;
  // Enumerate camera devices, optionally requesting permission first so labels
  // are populated. Safe to call repeatedly; updates `cameras`.
  refreshCameras: (requestPermission?: boolean) => Promise<CameraDevice[]>;
  // Resolves with the saved capture so callers can auto-open it.
  takeScreenshot: (
    options?: ScreenshotOptions
  ) => Promise<LastCapture | undefined>;
};

const canCopyImage = (): boolean =>
  typeof navigator !== "undefined" &&
  typeof navigator.clipboard?.write === "function" &&
  typeof window !== "undefined" &&
  typeof window.ClipboardItem === "function";

const useScreenCapture = (): UseScreenCapture => {
  const { createPath, readFile, updateFolder, writeFile } = useFileSystem();
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [lastCapture, setLastCapture] = useState<LastCapture>();
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const streamRef = useRef<MediaStream>();
  const recorderRef = useRef<MediaRecorder>();
  // Resolves the promise returned by recordScreen() when a STOP completes, so
  // callers receive the finalized recording capture (for auto-open).
  const stopResolveRef = useRef<(capture: LastCapture) => void>();
  // Auxiliary resources used only by the webcam picture-in-picture path; cleaned
  // up alongside the main stream when recording ends.
  const auxStreamsRef = useRef<MediaStream[]>([]);
  const pipRafRef = useRef<number>();
  const lastThumbnailRef = useRef<string>();
  // Auto-stop timer (max recording duration). Cleared on manual stop/unmount.
  const maxDurationTimerRef = useRef<number>();
  // True while a pre-recording countdown is running so a second click can
  // cancel it instead of being ignored.
  const recordCountdownRef = useRef(false);

  const setCapture = useCallback((capture: LastCapture) => {
    if (lastThumbnailRef.current) URL.revokeObjectURL(lastThumbnailRef.current);
    lastThumbnailRef.current = capture.thumbnailUrl;
    setLastCapture(capture);
  }, []);

  // Tear down every track and the picture-in-picture compositing loop. Safe to
  // call multiple times — failures of any optional resource never throw.
  const stopAllStreams = useCallback(() => {
    if (maxDurationTimerRef.current !== undefined) {
      window.clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = undefined;
    }
    if (pipRafRef.current !== undefined) {
      cancelAnimationFrame(pipRafRef.current);
      pipRafRef.current = undefined;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = undefined;
    auxStreamsRef.current.forEach((aux) =>
      aux.getTracks().forEach((track) => track.stop())
    );
    auxStreamsRef.current = [];
  }, []);

  // Revoke any outstanding thumbnail object URL and clear the auto-stop timer
  // on unmount.
  useEffect(
    () => () => {
      if (lastThumbnailRef.current) {
        URL.revokeObjectURL(lastThumbnailRef.current);
      }
      if (maxDurationTimerRef.current !== undefined) {
        window.clearTimeout(maxDurationTimerRef.current);
        maxDurationTimerRef.current = undefined;
      }
    },
    []
  );

  const canScreenshot =
    typeof window !== "undefined" &&
    typeof navigator?.mediaDevices?.getDisplayMedia === "function";
  const canRecord =
    canScreenshot &&
    (window?.MediaRecorder?.isTypeSupported?.(MIME_VIDEO_WEBM) ||
      window?.MediaRecorder?.isTypeSupported?.(MIME_VIDEO_MP4)) &&
    !isSafari();
  const canWebcam =
    canRecord && typeof navigator?.mediaDevices?.getUserMedia === "function";
  const canSystemAudio = canRecord && canCaptureSystemAudio();

  // The codec that would be chosen for a given preset (for a UI indicator).
  const bestRecordingMimeType = useCallback(
    (quality: QualityPreset = DEFAULT_QUALITY): string | undefined =>
      pickRecordingMimeType(QUALITY_PRESETS[quality].preferVp8),
    []
  );

  // List the available camera (videoinput) devices for the webcam PiP picker.
  // Browsers hide device labels until camera permission has been granted at
  // least once; pass requestPermission to briefly open the camera so labels can
  // be populated, then re-enumerate. Always fails soft — returns [] and never
  // throws, so it can never break the core recording flow.
  const refreshCameras = useCallback(
    async (requestPermission = false): Promise<CameraDevice[]> => {
      if (
        !canWebcam ||
        typeof navigator?.mediaDevices?.enumerateDevices !== "function"
      ) {
        setCameras([]);

        return [];
      }

      if (requestPermission) {
        try {
          const probe = await navigator.mediaDevices.getUserMedia({
            video: true,
          });

          // Release immediately; we only needed permission for labels.
          probe.getTracks().forEach((track) => track.stop());
        } catch {
          // Permission denied/unavailable — enumerate anyway (labels may be
          // empty), so the user can still pick by position.
        }
      }

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const found = devices
          .filter((device) => device.kind === "videoinput")
          .map((device, index) => ({
            deviceId: device.deviceId,
            label: device.label || `Camera ${index + 1}`,
          }));

        setCameras(found);

        return found;
      } catch {
        setCameras([]);

        return [];
      }
    },
    [canWebcam]
  );

  const recordScreen = useCallback(
    async (options?: RecordOptions) => {
      // A click during the pre-recording countdown cancels it (nothing has
      // started yet). The countdown loop below sees this flag and bails out.
      if (recordCountdownRef.current) {
        recordCountdownRef.current = false;
        setCountdown(0);

        return undefined;
      }

      // Second invocation stops an in-progress recording (flushes the file).
      // Resolve with the finalized capture once the recorder flushes its data.
      if (streamRef.current) {
        const stopPromise = new Promise<LastCapture | undefined>((resolve) => {
          stopResolveRef.current = resolve;
          // Safety net: never hang the caller if no final data event arrives.
          window.setTimeout(() => {
            if (stopResolveRef.current === resolve) {
              stopResolveRef.current = undefined;
              resolve(undefined);
            }
          }, 5000);
        });

        const recorderToStop = recorderRef.current;

        recorderRef.current = undefined;
        // CRITICAL: explicitly stop the recorder so it flushes + finalizes the
        // file. Relying on the source tracks ending is NOT enough for the
        // webcam-PiP path — the recorder records the canvas captureStream, which
        // keeps emitting frames after the display/webcam tracks stop, so it would
        // never stop. stopAllStreams() then tears down every track (incl. the
        // canvas stream) + the RAF compositing loop.
        if (recorderToStop && recorderToStop.state !== "inactive") {
          try {
            recorderToStop.stop();
          } catch {
            // already inactive
          }
        }
        stopAllStreams();

        return stopPromise;
      }

      const frameRate: RecordFrameRate = options?.frameRate ?? CAPTURE_FPS;
      const presetKey: QualityPreset = options?.quality ?? DEFAULT_QUALITY;
      const preset = QUALITY_PRESETS[presetKey];

      // Optional 3-2-1 countdown before recording starts. Show the picker only
      // after it elapses so the user can frame the recording. Cancellable via a
      // second click (recordCountdownRef cleared by the cancel branch above).
      const recordDelay = Math.max(0, Math.trunc(options?.delaySeconds ?? 0));

      if (recordDelay > 0) {
        recordCountdownRef.current = true;
        try {
          for (let remaining = recordDelay; remaining > 0; remaining -= 1) {
            if (!recordCountdownRef.current) break;
            setCountdown(remaining);
            // eslint-disable-next-line no-await-in-loop
            await new Promise((resolve) => {
              window.setTimeout(resolve, 1000);
            });
          }
        } finally {
          setCountdown(0);
        }

        // Cancelled during the countdown — abort before opening the picker.
        if (!recordCountdownRef.current) return undefined;
        recordCountdownRef.current = false;
      }

      const stream = await navigator.mediaDevices.getDisplayMedia(
        displayOptions(frameRate, preset, options?.systemAudio)
      );

      // Optionally mix in the microphone. Never fail the recording if the mic is
      // denied or unavailable — just continue without it.
      if (options?.microphone) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });

          auxStreamsRef.current.push(micStream);
          micStream.getAudioTracks().forEach((track) => stream.addTrack(track));
        } catch {
          // Mic denied/unavailable — continue with screen audio only.
        }
      }

      // The MediaStream actually fed to the recorder. Defaults to the raw screen
      // stream; replaced by a composited canvas stream when the webcam PiP is on.
      let recordStream = stream;
      const [videoTrack] = stream.getVideoTracks();

      // Optionally overlay the webcam as a picture-in-picture in the
      // bottom-right corner. Done by compositing both video sources onto a
      // <canvas> and recording its captureStream(). Never fail the recording if
      // the webcam is denied/unavailable — fall back to the plain screen stream.
      if (options?.webcam && canWebcam) {
        try {
          // Use the chosen camera when provided; fall back to the system
          // default if no/empty deviceId. `exact` so we honor the user's pick.
          const deviceId = options.webcamDeviceId;
          const webcamEffect: WebcamEffect =
            options.webcamEffect ?? DEFAULT_WEBCAM_EFFECT;

          // Base video constraints (chosen camera or system default).
          const baseVideo: MediaTrackConstraints = deviceId
            ? { deviceId: { exact: deviceId } }
            : {};

          // Best-effort "Remove background": if the browser exposes the
          // experimental platform background-blur constraint, ask for it on the
          // camera track. CSP-clean (no model download). Chromium-only today;
          // ignored/rejected elsewhere, where the canvas blur fallback takes
          // over. True person segmentation needs a self-hosted model (see
          // effects.ts).
          // `backgroundBlur` is an experimental, non-standard constraint, so it
          // isn't in the TS MediaTrackConstraints type — widen via a cast.
          const withBgBlur = wantsPlatformBackgroundBlur(webcamEffect)
            ? ({ ...baseVideo, backgroundBlur: true } as MediaTrackConstraints)
            : undefined;

          let webcamStream: MediaStream;

          try {
            webcamStream = await navigator.mediaDevices.getUserMedia({
              video: withBgBlur ?? baseVideo,
            });
          } catch {
            // The experimental constraint can hard-fail on some builds — retry
            // once without it so the recording (and the canvas blur fallback)
            // still proceed.
            webcamStream = await navigator.mediaDevices.getUserMedia({
              video: baseVideo,
            });
          }

          auxStreamsRef.current.push(webcamStream);

          // Now that permission is granted, re-enumerate so labels populate for
          // next time (fire-and-forget; never blocks the recording).
          refreshCameras().catch(() => undefined);

          const screenVideo = document.createElement("video");
          const webcamVideo = document.createElement("video");

          screenVideo.srcObject = stream;
          screenVideo.muted = true;
          webcamVideo.srcObject = webcamStream;
          webcamVideo.muted = true;
          await Promise.all([screenVideo.play(), webcamVideo.play()]);

          const { height = 720, width = 1280 } = videoTrack.getSettings();
          const canvas = document.createElement("canvas");

          canvas.width = width;
          canvas.height = height;

          const context = canvas.getContext("2d");

          if (context) {
            // Resolve the chosen PiP corner + size (fall back to defaults).
            const pipPosition = options.webcamPosition ?? DEFAULT_PIP_POSITION;
            const pipRatio =
              PIP_SIZE_RATIOS[options.webcamSize ?? DEFAULT_PIP_SIZE] ??
              PIP_WIDTH_RATIO;
            const isLeft = pipPosition.endsWith("-left");
            const isTop = pipPosition.startsWith("top-");

            // Render the (themed) webcam into its own offscreen canvas first so
            // an effect's filters/blends stay contained to the PiP box and never
            // bleed onto the screen content. Persistent state (e.g. the matrix
            // rain columns) lives in effectState across frames.
            const pipCanvas = document.createElement("canvas");
            const pipContext = pipCanvas.getContext("2d");
            const effectState = createWebcamEffectState();

            const drawFrame = (): void => {
              context.drawImage(screenVideo, 0, 0, width, height);

              const pipWidth = Math.round(width * pipRatio);
              const camWidth = webcamVideo.videoWidth || 1;
              const camHeight = webcamVideo.videoHeight || 1;
              const pipHeight = Math.round(pipWidth * (camHeight / camWidth));
              const pipX = isLeft ? PIP_MARGIN : width - pipWidth - PIP_MARGIN;
              const pipY = isTop ? PIP_MARGIN : height - pipHeight - PIP_MARGIN;

              // Apply the selected webcam theme. Fail-soft: any effect error
              // falls back to a plain webcam draw so a recording can never break.
              if (pipContext && pipWidth > 0 && pipHeight > 0) {
                try {
                  if (
                    pipCanvas.width !== pipWidth ||
                    pipCanvas.height !== pipHeight
                  ) {
                    pipCanvas.width = pipWidth;
                    pipCanvas.height = pipHeight;
                  }
                  drawWebcamEffect(
                    pipContext,
                    webcamVideo,
                    pipWidth,
                    pipHeight,
                    webcamEffect,
                    effectState
                  );
                  context.drawImage(pipCanvas, pipX, pipY, pipWidth, pipHeight);
                } catch {
                  context.drawImage(
                    webcamVideo,
                    pipX,
                    pipY,
                    pipWidth,
                    pipHeight
                  );
                }
              } else {
                context.drawImage(webcamVideo, pipX, pipY, pipWidth, pipHeight);
              }

              pipRafRef.current = requestAnimationFrame(drawFrame);
            };

            drawFrame();

            const composited = canvas.captureStream(frameRate);

            // Carry over every audio track (screen audio + optional mic).
            stream
              .getAudioTracks()
              .forEach((track) => composited.addTrack(track));
            recordStream = composited;
            // Track the canvas captureStream so stopAllStreams() also stops it —
            // otherwise it keeps emitting and the recorder never stops.
            auxStreamsRef.current.push(composited);
          }
        } catch {
          // Webcam denied/unavailable — record the screen without the overlay.
          recordStream = stream;
        }
      }

      streamRef.current = stream;
      setIsRecording(true);
      setIsPaused(false);
      setRecordSeconds(0);

      // Pick the best-supported codec (honoring an explicit override), and use
      // the preset's fixed video bitrate for predictable quality-per-size
      // instead of the old h*w*fps heuristic.
      const mimeType =
        options?.mimeType && MediaRecorder.isTypeSupported(options.mimeType)
          ? options.mimeType
          : pickRecordingMimeType(preset.preferVp8);
      const recorder = new MediaRecorder(recordStream, {
        videoBitsPerSecond: preset.bitsPerSecond,
        ...(mimeType ? { mimeType } : {}),
      });

      recorderRef.current = recorder;

      const fileName = `Screen Recording ${timeStamp()}.webm`;
      const capturePath = join(DESKTOP_PATH, fileName);
      const startTime = Date.now();
      let hasData = false;

      // Stopping the share from the browser's own UI ends the track. Also stop
      // any mixed-in tracks (mic / webcam) so their indicators turn off.
      videoTrack.addEventListener("ended", () => {
        if (recorder.state !== "inactive") recorder.stop();
        recorderRef.current = undefined;
        stopAllStreams();
      });

      recorder.addEventListener("dataavailable", async (event) => {
        const { data } = event;

        if (!data) return;

        const chunk = Buffer.from(await data.arrayBuffer());

        await writeFile(
          capturePath,
          hasData ? Buffer.concat([await readFile(capturePath), chunk]) : chunk,
          hasData
        );

        if (recorder.state === "inactive") {
          const { default: fixWebmDuration } = await import(
            "fix-webm-duration"
          );

          fixWebmDuration(
            bufferToBlob(await readFile(capturePath)),
            Date.now() - startTime,
            async (fixedFile) => {
              await writeFile(
                capturePath,
                Buffer.from(await fixedFile.arrayBuffer()),
                true
              );
              updateFolder(DESKTOP_PATH, fileName);
            }
          );
          setIsRecording(false);
          setIsPaused(false);

          const capture: LastCapture = {
            fileName,
            kind: "recording",
            note: "Saved to the Desktop.",
            path: capturePath,
          };

          setCapture(capture);
          stopResolveRef.current?.(capture);
          stopResolveRef.current = undefined;
        }

        hasData = true;
      });

      recorder.start();

      // Optional max-duration auto-stop. When the timer fires, stop the
      // recorder (its inactive `dataavailable` handler flushes + finalizes the
      // file) and tear down the streams. Cleared on manual stop / unmount via
      // stopAllStreams(). Fail-soft: a bad timer can never break recording.
      const maxDuration = Math.max(
        0,
        Math.trunc(options?.maxDurationSeconds ?? 0)
      );

      if (maxDuration > 0) {
        maxDurationTimerRef.current = window.setTimeout(() => {
          maxDurationTimerRef.current = undefined;
          try {
            if (recorder.state !== "inactive") recorder.stop();
          } catch {
            // Recorder already gone — nothing to stop.
          }
          recorderRef.current = undefined;
          stopAllStreams();
        }, maxDuration * 1000);
      }

      // Started (not stopped): the caller gets no capture yet.
      return undefined;
    },
    [
      canWebcam,
      readFile,
      refreshCameras,
      setCapture,
      stopAllStreams,
      updateFolder,
      writeFile,
    ]
  );

  // Pause / resume an in-progress recording. The live timer is gated on
  // !isPaused so it stops advancing while paused. Guard the recorder state so a
  // stray call can never throw.
  const pauseResumeRecording = useCallback(() => {
    const recorder = recorderRef.current;

    if (!recorder) return;

    try {
      if (recorder.state === "recording") {
        recorder.pause();
        setIsPaused(true);
      } else if (recorder.state === "paused") {
        recorder.resume();
        setIsPaused(false);
      }
    } catch {
      // Pause/resume unsupported on this platform — leave state unchanged.
    }
  }, []);

  // Live recording timer (mm:ss). Ticks only while recording AND not paused.
  useEffect(() => {
    if (!isRecording || isPaused) return undefined;

    const interval = window.setInterval(() => {
      setRecordSeconds((seconds) => seconds + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isPaused, isRecording]);

  const takeScreenshot = useCallback(
    async (options?: ScreenshotOptions) => {
      // Optional countdown before grabbing the display media.
      const delaySeconds = Math.max(0, Math.trunc(options?.delaySeconds ?? 0));

      if (delaySeconds > 0) {
        try {
          for (let remaining = delaySeconds; remaining > 0; remaining -= 1) {
            setCountdown(remaining);
            // eslint-disable-next-line no-await-in-loop
            await new Promise((resolve) => {
              window.setTimeout(resolve, 1000);
            });
          }
        } finally {
          setCountdown(0);
        }
      }

      const isJpeg = options?.format === "jpeg";
      const mimeType = isJpeg ? MIME_IMAGE_JPEG : MIME_IMAGE_PNG;
      const extension = isJpeg ? "jpg" : "png";
      const stream = await navigator.mediaDevices.getDisplayMedia(
        // Screenshots never need audio — opt out so no audio is captured.
        displayOptions(1, undefined, false)
      );

      try {
        const video = document.createElement("video");

        video.srcObject = stream;
        video.muted = true;
        await video.play();
        await new Promise((resolve) => {
          requestAnimationFrame(() => resolve(undefined));
        });

        const canvas = document.createElement("canvas");

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d")?.drawImage(video, 0, 0);

        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob(
            (result) => resolve(result),
            mimeType,
            isJpeg ? JPEG_QUALITY : undefined
          );
        });

        if (blob) {
          const fileName = `Screenshot ${timeStamp()}.${extension}`;
          const savedName = await createPath(
            fileName,
            PICTURES_FOLDER,
            Buffer.from(await blob.arrayBuffer())
          );

          updateFolder(PICTURES_FOLDER);

          let note = "Saved to Pictures.";

          // Optionally copy the image to the clipboard. Never fail the save if
          // the clipboard is blocked/unavailable — just note it. Browsers only
          // reliably support PNG on the clipboard; JPEG falls back gracefully.
          if (options?.copyToClipboard) {
            if (canCopyImage() && !isJpeg) {
              try {
                await navigator.clipboard.write([
                  new ClipboardItem({ [mimeType]: blob }),
                ]);
                note = "Saved to Pictures and copied to clipboard.";
              } catch {
                note = "Saved to Pictures (clipboard copy blocked).";
              }
            } else if (isJpeg) {
              note = "Saved to Pictures (clipboard copy is PNG-only).";
            } else {
              note = "Saved to Pictures (clipboard unavailable).";
            }
          }

          const capture: LastCapture = {
            fileName: savedName,
            kind: "screenshot",
            note,
            path: join(PICTURES_FOLDER, savedName),
            thumbnailUrl: URL.createObjectURL(blob),
          };

          setCapture(capture);

          return capture;
        }

        return undefined;
      } finally {
        stream.getTracks().forEach((track) => track.stop());
      }
    },
    [createPath, setCapture, updateFolder]
  );

  return {
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
  };
};

export default useScreenCapture;
