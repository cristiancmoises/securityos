import { useFileSystem } from "contexts/fileSystem";
import { join } from "path";
import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_LOCALE, DESKTOP_PATH, PICTURES_FOLDER } from "utils/constants";
import { bufferToBlob, isFirefox, isSafari } from "utils/functions";

// Shared screen-capture engine: screen RECORDING (webm video → Desktop) and
// SCREENSHOT (png/jpeg → Pictures), both via getDisplayMedia so they faithfully
// capture everything on screen — including cross-origin app iframes (Tor Browser,
// SecTube). Used by the Screen Capture app and the desktop context menu.

const CAPTURE_FPS = 30;
const MIME_VIDEO_WEBM = "video/webm";
const MIME_VIDEO_MP4 = "video/mp4";
const MIME_IMAGE_PNG = "image/png";
const MIME_IMAGE_JPEG = "image/jpeg";
const JPEG_QUALITY = 0.92;
// Inset (px) of the webcam picture-in-picture from the screen edges and the
// fraction of the screen width it occupies.
const PIP_MARGIN = 24;
const PIP_WIDTH_RATIO = 0.22;
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

const displayOptions = (frameRate: number): DisplayMediaStreamOptions =>
  ({
    video: { frameRate },
    ...(!isFirefox() &&
      !isSafari() && {
        preferCurrentTab: false,
        selfBrowserSurface: "include",
        surfaceSwitching: "include",
        systemAudio: "include",
      }),
  }) as DisplayMediaStreamOptions;

export type ScreenshotOptions = {
  copyToClipboard?: boolean;
  delaySeconds?: number;
  format?: ScreenshotFormat;
};

export type RecordOptions = {
  frameRate?: RecordFrameRate;
  microphone?: boolean;
  webcam?: boolean;
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
  // Resolves with the saved capture so callers can auto-open it.
  takeScreenshot: (options?: ScreenshotOptions) => Promise<LastCapture | undefined>;
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

  const setCapture = useCallback((capture: LastCapture) => {
    if (lastThumbnailRef.current) URL.revokeObjectURL(lastThumbnailRef.current);
    lastThumbnailRef.current = capture.thumbnailUrl;
    setLastCapture(capture);
  }, []);

  // Tear down every track and the picture-in-picture compositing loop. Safe to
  // call multiple times — failures of any optional resource never throw.
  const stopAllStreams = useCallback(() => {
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

  // Revoke any outstanding thumbnail object URL on unmount.
  useEffect(
    () => () => {
      if (lastThumbnailRef.current) {
        URL.revokeObjectURL(lastThumbnailRef.current);
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

  const recordScreen = useCallback(
    async (options?: RecordOptions) => {
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

        recorderRef.current = undefined;
        stopAllStreams();

        return stopPromise;
      }

      const frameRate: RecordFrameRate = options?.frameRate ?? CAPTURE_FPS;
      const stream = await navigator.mediaDevices.getDisplayMedia(
        displayOptions(frameRate)
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
          const webcamStream = await navigator.mediaDevices.getUserMedia({
            video: true,
          });

          auxStreamsRef.current.push(webcamStream);

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
            const drawFrame = (): void => {
              context.drawImage(screenVideo, 0, 0, width, height);

              const pipWidth = Math.round(width * PIP_WIDTH_RATIO);
              const camWidth = webcamVideo.videoWidth || 1;
              const camHeight = webcamVideo.videoHeight || 1;
              const pipHeight = Math.round(pipWidth * (camHeight / camWidth));
              const pipX = width - pipWidth - PIP_MARGIN;
              const pipY = height - pipHeight - PIP_MARGIN;

              context.drawImage(
                webcamVideo,
                pipX,
                pipY,
                pipWidth,
                pipHeight
              );
              pipRafRef.current = requestAnimationFrame(drawFrame);
            };

            drawFrame();

            const composited = canvas.captureStream(frameRate);

            // Carry over every audio track (screen audio + optional mic).
            stream
              .getAudioTracks()
              .forEach((track) => composited.addTrack(track));
            recordStream = composited;
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

      const { height, width } = videoTrack.getSettings();
      const recorder = new MediaRecorder(recordStream, {
        bitsPerSecond: height && width ? height * width * frameRate : undefined,
        mimeType: MediaRecorder.isTypeSupported(MIME_VIDEO_WEBM)
          ? MIME_VIDEO_WEBM
          : MIME_VIDEO_MP4,
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
          const { default: fixWebmDuration } = await import("fix-webm-duration");

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

      // Started (not stopped): the caller gets no capture yet.
      return undefined;
    },
    [canWebcam, readFile, setCapture, stopAllStreams, updateFolder, writeFile]
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
        displayOptions(1)
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
    canRecord,
    canScreenshot,
    canWebcam,
    countdown,
    isPaused,
    isRecording,
    lastCapture,
    pauseResumeRecording,
    recordSeconds,
    recordScreen,
    takeScreenshot,
  };
};

export default useScreenCapture;
