import { WALLPAPER_MENU } from "components/system/Desktop/Wallpapers/constants";
import { getIconByFileExtension } from "components/system/Files/FileEntry/functions";
import type { FolderActions } from "components/system/Files/FileManager/useFolder";
import type {
  SortBy,
  SortByOrder,
} from "components/system/Files/FileManager/useSortBy";
import { useFileSystem } from "contexts/fileSystem";
import { useMenu } from "contexts/menu";
import type {
  ContextMenuCapture,
  MenuItem,
} from "contexts/menu/useMenuContextState";
import { useProcesses } from "contexts/process";
import { useSession } from "contexts/session";
import { dirname, join } from "path";
import { useCallback, useMemo } from "react";
import {
  DEFAULT_LOCALE,
  DESKTOP_PATH,
  FOLDER_ICON,
  isFileSystemMappingSupported,
  MENU_SEPERATOR,
} from "utils/constants";
import { bufferToBlob, isFirefox, isSafari } from "utils/functions";

const stopGlobalMusicVisualization = (): void =>
  window.WebampGlobal?.store.dispatch({
    enabled: false,
    type: "SET_MILKDROP_DESKTOP",
  });

const NEW_FOLDER = "New folder";
const NEW_TEXT_DOCUMENT = "New Text Document.txt";
const NEW_RTF_DOCUMENT = "New Rich Text Document.whtml";

const richTextDocumentIcon = getIconByFileExtension(".whtml");
const textDocumentIcon = getIconByFileExtension(".txt");

const updateSortBy =
  (value: SortBy, defaultIsAscending: boolean) =>
  ([sortBy, isAscending]: SortByOrder): SortByOrder =>
    [value, sortBy === value ? !isAscending : defaultIsAscending];

const EASTER_EGG_CLICK_COUNT = 2;

const CAPTURE_FPS = 30;
const CAPTURE_TIME_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  month: "2-digit",
  second: "2-digit",
  year: "numeric",
};
const MIME_TYPE_VIDEO_WEBM = "video/webm";
const MIME_TYPE_VIDEO_MP4 = "video/mp4";

let triggerEasterEggCountdown = EASTER_EGG_CLICK_COUNT;

let currentMediaStream: MediaStream | undefined;

const useFolderContextMenu = (
  url: string,
  {
    addToFolder,
    newPath,
    pasteToFolder,
    sortByOrder: [[sortBy, isAscending], setSortBy],
  }: FolderActions,
  isDesktop?: boolean
): ContextMenuCapture => {
  const { contextMenu } = useMenu();
  const {
    mapFs,
    pasteList = {},
    readFile,
    writeFile,
    updateFolder,
  } = useFileSystem();
  const {
    setWallpaper: setSessionWallpaper,
    setIconPositions,
    wallpaperImage,
  } = useSession();
  const setWallpaper = useCallback(
    (wallpaper: string) => {
      if (wallpaper === "VANTA") {
        triggerEasterEggCountdown -= 1;

        const triggerEasterEgg = triggerEasterEggCountdown === 0;

        setSessionWallpaper(`VANTA${triggerEasterEgg ? " WIREFRAME" : ""}`);

        if (triggerEasterEgg) {
          triggerEasterEggCountdown = EASTER_EGG_CLICK_COUNT;
        }
      } else {
        triggerEasterEggCountdown = EASTER_EGG_CLICK_COUNT;

        setSessionWallpaper(wallpaper);
      }
    },
    [setSessionWallpaper]
  );
  const { open } = useProcesses();
  const updateSorting = useCallback(
    (value: SortBy | "", defaultIsAscending: boolean): void => {
      setIconPositions((currentIconPositions) =>
        Object.fromEntries(
          Object.entries(currentIconPositions).filter(
            ([entryPath]) => dirname(entryPath) !== url
          )
        )
      );
      setSortBy(
        value === ""
          ? ([currentValue]) => [currentValue, defaultIsAscending]
          : updateSortBy(value, defaultIsAscending)
      );
    },
    [setIconPositions, setSortBy, url]
  );
  const canCapture = useMemo(
    () =>
      isDesktop &&
      typeof window !== "undefined" &&
      typeof navigator?.mediaDevices?.getDisplayMedia === "function" &&
      (window?.MediaRecorder?.isTypeSupported(MIME_TYPE_VIDEO_WEBM) ||
        window?.MediaRecorder?.isTypeSupported(MIME_TYPE_VIDEO_MP4)) &&
      !isSafari(),
    [isDesktop]
  );
  const captureScreen = useCallback(async () => {
    if (currentMediaStream) {
      const { active: wasActive } = currentMediaStream;

      currentMediaStream.getTracks().forEach((track) => track.stop());
      currentMediaStream = undefined;

      if (wasActive) return;
    }

    const displayMediaOptions: DisplayMediaStreamOptions &
      MediaStreamConstraints = {
      video: {
        frameRate: CAPTURE_FPS,
      },
      ...(!isFirefox() &&
        !isSafari() && {
          preferCurrentTab: true,
          selfBrowserSurface: "include",
          surfaceSwitching: "include",
          systemAudio: "include",
        }),
    };
    currentMediaStream = await navigator.mediaDevices.getDisplayMedia(
      displayMediaOptions
    );

    const [currentVideoTrack] = currentMediaStream.getVideoTracks();
    const { height, width } = currentVideoTrack.getSettings();
    const mediaRecorder = new MediaRecorder(currentMediaStream, {
      bitsPerSecond: height && width ? height * width * CAPTURE_FPS : undefined,
      mimeType: MediaRecorder.isTypeSupported(MIME_TYPE_VIDEO_WEBM)
        ? MIME_TYPE_VIDEO_WEBM
        : MIME_TYPE_VIDEO_MP4,
    });
    const timeStamp = new Intl.DateTimeFormat(
      DEFAULT_LOCALE,
      CAPTURE_TIME_DATE_FORMAT
    )
      .format(new Date())
      .replace(/[/:]/g, "-")
      .replace(",", "");
    const fileName = `Screen Capture ${timeStamp}.webm`;
    const capturePath = join(DESKTOP_PATH, fileName);
    const startTime = Date.now();
    let hasCapturedData = false;

    mediaRecorder.start();
    mediaRecorder.addEventListener("dataavailable", async (event) => {
      const { data } = event;

      if (data) {
        const bufferData = Buffer.from(await data.arrayBuffer());

        await writeFile(
          capturePath,
          hasCapturedData
            ? Buffer.concat([await readFile(capturePath), bufferData])
            : bufferData,
          hasCapturedData
        );

        if (mediaRecorder.state === "inactive") {
          const { default: fixWebmDuration } = await import(
            "fix-webm-duration"
          );

          fixWebmDuration(
            bufferToBlob(await readFile(capturePath)),
            Date.now() - startTime,
            async (capturedFile) => {
              await writeFile(
                capturePath,
                Buffer.from(await capturedFile.arrayBuffer()),
                true
              );
              updateFolder(DESKTOP_PATH, fileName);
            }
          );
        }

        hasCapturedData = true;
      }
    });
  }, [readFile, updateFolder, writeFile]);

  return useMemo(
    () =>
      contextMenu?.(() => {
        const ADD_FILE = { action: () => addToFolder(), label: "Upload(s)" };
        const MAP_DIRECTORY = {
          action: () =>
            mapFs(url)
              .then((mappedFolder) => {
                updateFolder(url, mappedFolder);
                open("FileExplorer", { url: join(url, mappedFolder) });
              })
              .catch(() => {
                // Ignore failure to map
              }),
          label: "Mapear pasta",
        };
        const FS_COMMANDS = [
          ADD_FILE,
          ...(isFileSystemMappingSupported() ? [MAP_DIRECTORY] : []),
        ];
        const isMusicVisualizationRunning =
          document.querySelector("main .webamp-desktop canvas") instanceof
          HTMLCanvasElement;

        return [
          {
            label: "Filtrar por",
            menu: [
              {
                action: () => updateSorting("name", true),
                label: "Nome",
                toggle: sortBy === "name",
              },
              {
                action: () => updateSorting("size", false),
                label: "Tamanho",
                toggle: sortBy === "size",
              },
              {
                action: () => updateSorting("type", true),
                label: "Item",
                toggle: sortBy === "type",
              },
              {
                action: () => updateSorting("date", false),
                label: "Data de modoficação",
                toggle: sortBy === "date",
              },
              MENU_SEPERATOR,
              {
                action: () => updateSorting("", true),
                label: "Ascendente",
                toggle: isAscending,
              },
              {
                action: () => updateSorting("", false),
                label: "Decrescente",
                toggle: !isAscending,
              },
            ],
          },
          { action: () => updateFolder(url), label: "Atualizar" },
          ...(isDesktop
            ? [
                MENU_SEPERATOR,
                {
                  label: "Plano de Fundo",
                  menu: WALLPAPER_MENU.reduce<MenuItem[]>(
                    (menu, item) => [
                      ...menu,
                      {
                        action: () => {
                          if (isMusicVisualizationRunning) {
                            stopGlobalMusicVisualization?.();
                          }
                          if (item.id) setWallpaper(item.id);
                        },
                        label: item.name || item.id,
                        toggle: item.startsWith
                          ? wallpaperImage.startsWith(item.id)
                          : wallpaperImage === item.id,
                      },
                    ],
                    isMusicVisualizationRunning
                      ? [
                          {
                            action: stopGlobalMusicVisualization,
                            checked: true,
                            label: "Visualização da Música",
                          },
                          MENU_SEPERATOR,
                        ]
                      : []
                  ),
                },
                ...(canCapture
                  ? [
                      {
                        action: captureScreen,
                        label: currentMediaStream?.active
                          ? "Parar captura de tela"
                          : "Capturar a tela",
                      },
                    ]
                  : []),
              ]
            : []),
          MENU_SEPERATOR,
          ...FS_COMMANDS,
          {
            action: () => open("Terminal", { url }),
            label: "Abrir Terminal aqui",
          },
          {
            action: () => pasteToFolder(),
            disabled: Object.keys(pasteList).length === 0,
            label: "Colar",
          },
          MENU_SEPERATOR,
          {
            label: "Novo",
            menu: [
              {
                action: () => newPath(NEW_FOLDER, undefined, "rename"),
                icon: FOLDER_ICON,
                label: "Pasta",
              },
              MENU_SEPERATOR,
              {
                action: () =>
                  newPath(NEW_RTF_DOCUMENT, Buffer.from(""), "rename"),
                icon: richTextDocumentIcon,
                label: "Documento Rich Text",
              },
              {
                action: () =>
                  newPath(NEW_TEXT_DOCUMENT, Buffer.from(""), "rename"),
                icon: textDocumentIcon,
                label: "Documento de texto",
              },
            ],
          },
          ...(isDesktop
            ? [
                MENU_SEPERATOR,
                {
                  action: () => open("DevTools", { url: "dom" }),
                  label: "Inspecionar",
                },
              ]
            : []),
        ];
      }),
    [
      addToFolder,
      canCapture,
      captureScreen,
      contextMenu,
      isAscending,
      isDesktop,
      mapFs,
      newPath,
      open,
      pasteList,
      pasteToFolder,
      setWallpaper,
      sortBy,
      updateFolder,
      updateSorting,
      url,
      wallpaperImage,
    ]
  );
};

export default useFolderContextMenu;
