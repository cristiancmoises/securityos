import { useFileSystem } from "contexts/fileSystem";
import { join } from "path";
import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_LOCALE, DESKTOP_PATH, PICTURES_FOLDER } from "utils/constants";
import { bufferToBlob, isFirefox, isSafari } from "utils/functions";

// Shared screen-capture engine: screen RECORDING (webm video → Desktop) and
// SCREENSHOT (png → Pictures), both via getDisplayMedia so they faithfully
// capture everything on screen — including cross-origin app iframes (Tor Browser,
// SecTube). Used by the Screen Capture app and the desktop context menu.

const CAPTURE_FPS = 30;
const MIME_VIDEO_WEBM = "video/webm";
const MIME_VIDEO_MP4 = "video/mp4";
const MIME_IMAGE_PNG = "image/png";
const TIME_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  month: "2-digit",
  second: "2-digit",
  year: "numeric",
};

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
};

export type RecordOptions = {
  microphone?: boolean;
};

export type LastCapture = {
  fileName: string;
  kind: "recording" | "screenshot";
  note?: string;
  thumbnailUrl?: string;
};

type UseScreenCapture = {
  canRecord: boolean;
  canScreenshot: boolean;
  countdown: number;
  isRecording: boolean;
  lastCapture?: LastCapture;
  recordSeconds: number;
  recordScreen: (options?: RecordOptions) => Promise<void>;
  takeScreenshot: (options?: ScreenshotOptions) => Promise<void>;
};

const canCopyImage = (): boolean =>
  typeof navigator !== "undefined" &&
  typeof navigator.clipboard?.write === "function" &&
  typeof window !== "undefined" &&
  typeof window.ClipboardItem === "function";

const useScreenCapture = (): UseScreenCapture => {
  const { createPath, readFile, updateFolder, writeFile } = useFileSystem();
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [lastCapture, setLastCapture] = useState<LastCapture>();
  const streamRef = useRef<MediaStream>();
  const lastThumbnailRef = useRef<string>();

  const setCapture = useCallback((capture: LastCapture) => {
    if (lastThumbnailRef.current) URL.revokeObjectURL(lastThumbnailRef.current);
    lastThumbnailRef.current = capture.thumbnailUrl;
    setLastCapture(capture);
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

  const recordScreen = useCallback(
    async (options?: RecordOptions) => {
      // Second invocation stops an in-progress recording (flushes the file).
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = undefined;

        return;
      }

      const stream = await navigator.mediaDevices.getDisplayMedia(
        displayOptions(CAPTURE_FPS)
      );

      // Optionally mix in the microphone. Never fail the recording if the mic is
      // denied or unavailable — just continue without it.
      if (options?.microphone) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });

          micStream
            .getAudioTracks()
            .forEach((track) => stream.addTrack(track));
        } catch {
          // Mic denied/unavailable — continue with screen audio only.
        }
      }

      streamRef.current = stream;
      setIsRecording(true);
      setRecordSeconds(0);

      const [videoTrack] = stream.getVideoTracks();
      const { height, width } = videoTrack.getSettings();
      const recorder = new MediaRecorder(stream, {
        bitsPerSecond:
          height && width ? height * width * CAPTURE_FPS : undefined,
        mimeType: MediaRecorder.isTypeSupported(MIME_VIDEO_WEBM)
          ? MIME_VIDEO_WEBM
          : MIME_VIDEO_MP4,
      });
      const fileName = `Screen Recording ${timeStamp()}.webm`;
      const capturePath = join(DESKTOP_PATH, fileName);
      const startTime = Date.now();
      let hasData = false;

      // Stopping the share from the browser's own UI ends the track. Also stop
      // any mixed-in mic track so its indicator turns off.
      videoTrack.addEventListener("ended", () => {
        if (recorder.state !== "inactive") recorder.stop();
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = undefined;
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
          setCapture({
            fileName,
            kind: "recording",
            note: "Saved to the Desktop.",
          });
        }

        hasData = true;
      });

      recorder.start();
    },
    [readFile, setCapture, updateFolder, writeFile]
  );

  // Live recording timer (mm:ss). Ticks only while recording.
  useEffect(() => {
    if (!isRecording) return undefined;

    const interval = window.setInterval(() => {
      setRecordSeconds((seconds) => seconds + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isRecording]);

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
          canvas.toBlob((result) => resolve(result), MIME_IMAGE_PNG);
        });

        if (blob) {
          const fileName = `Screenshot ${timeStamp()}.png`;

          await createPath(
            fileName,
            PICTURES_FOLDER,
            Buffer.from(await blob.arrayBuffer())
          );
          updateFolder(PICTURES_FOLDER);

          let note = "Saved to Pictures.";

          // Optionally copy the PNG to the clipboard. Never fail the save if the
          // clipboard is blocked/unavailable — just note it.
          if (options?.copyToClipboard) {
            if (canCopyImage()) {
              try {
                await navigator.clipboard.write([
                  new ClipboardItem({ [MIME_IMAGE_PNG]: blob }),
                ]);
                note = "Saved to Pictures and copied to clipboard.";
              } catch {
                note = "Saved to Pictures (clipboard copy blocked).";
              }
            } else {
              note = "Saved to Pictures (clipboard unavailable).";
            }
          }

          setCapture({
            fileName,
            kind: "screenshot",
            note,
            thumbnailUrl: URL.createObjectURL(blob),
          });
        }
      } finally {
        stream.getTracks().forEach((track) => track.stop());
      }
    },
    [createPath, setCapture, updateFolder]
  );

  return {
    canRecord,
    canScreenshot,
    countdown,
    isRecording,
    lastCapture,
    recordSeconds,
    recordScreen,
    takeScreenshot,
  };
};

export default useScreenCapture;
