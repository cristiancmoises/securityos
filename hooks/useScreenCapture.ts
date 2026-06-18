import { useFileSystem } from "contexts/fileSystem";
import { join } from "path";
import { useCallback, useRef, useState } from "react";
import { DEFAULT_LOCALE, DESKTOP_PATH, PICTURES_FOLDER } from "utils/constants";
import { bufferToBlob, isFirefox, isSafari } from "utils/functions";

// Shared screen-capture engine: screen RECORDING (webm video → Desktop) and
// SCREENSHOT (png → Pictures), both via getDisplayMedia so they faithfully
// capture everything on screen — including cross-origin app iframes (Tor Browser,
// SecTube). Used by the Screen Capture app and the desktop context menu.

const CAPTURE_FPS = 30;
const MIME_VIDEO_WEBM = "video/webm";
const MIME_VIDEO_MP4 = "video/mp4";
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

type UseScreenCapture = {
  canRecord: boolean;
  canScreenshot: boolean;
  isRecording: boolean;
  recordScreen: () => Promise<void>;
  takeScreenshot: () => Promise<void>;
};

const useScreenCapture = (): UseScreenCapture => {
  const { createPath, readFile, updateFolder, writeFile } = useFileSystem();
  const [isRecording, setIsRecording] = useState(false);
  const streamRef = useRef<MediaStream>();

  const canScreenshot =
    typeof window !== "undefined" &&
    typeof navigator?.mediaDevices?.getDisplayMedia === "function";
  const canRecord =
    canScreenshot &&
    (window?.MediaRecorder?.isTypeSupported?.(MIME_VIDEO_WEBM) ||
      window?.MediaRecorder?.isTypeSupported?.(MIME_VIDEO_MP4)) &&
    !isSafari();

  const recordScreen = useCallback(async () => {
    // Second invocation stops an in-progress recording (flushes the file).
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = undefined;

      return;
    }

    const stream = await navigator.mediaDevices.getDisplayMedia(
      displayOptions(CAPTURE_FPS)
    );

    streamRef.current = stream;
    setIsRecording(true);

    const [videoTrack] = stream.getVideoTracks();
    const { height, width } = videoTrack.getSettings();
    const recorder = new MediaRecorder(stream, {
      bitsPerSecond: height && width ? height * width * CAPTURE_FPS : undefined,
      mimeType: MediaRecorder.isTypeSupported(MIME_VIDEO_WEBM)
        ? MIME_VIDEO_WEBM
        : MIME_VIDEO_MP4,
    });
    const fileName = `Screen Recording ${timeStamp()}.webm`;
    const capturePath = join(DESKTOP_PATH, fileName);
    const startTime = Date.now();
    let hasData = false;

    // Stopping the share from the browser's own UI ends the track.
    videoTrack.addEventListener("ended", () => {
      if (recorder.state !== "inactive") recorder.stop();
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
      }

      hasData = true;
    });

    recorder.start();
  }, [readFile, updateFolder, writeFile]);

  const takeScreenshot = useCallback(async () => {
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
        canvas.toBlob((result) => resolve(result), "image/png");
      });

      if (blob) {
        await createPath(
          `Screenshot ${timeStamp()}.png`,
          PICTURES_FOLDER,
          Buffer.from(await blob.arrayBuffer())
        );
        updateFolder(PICTURES_FOLDER);
      }
    } finally {
      stream.getTracks().forEach((track) => track.stop());
    }
  }, [createPath, updateFolder]);

  return {
    canRecord,
    canScreenshot,
    isRecording,
    recordScreen,
    takeScreenshot,
  };
};

export default useScreenCapture;
