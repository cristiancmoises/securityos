import type { ApiError } from "browserfs/dist/node/core/api_error";
import type { SortBy } from "components/system/Files/FileManager/useSortBy";
import { useFileSystem } from "contexts/fileSystem";
import type {
  IconPositions,
  SessionContextState,
  SessionData,
  SortOrders,
  UndercoverAppearance,
  WallpaperFit,
  WindowStates,
} from "contexts/session/types";
import defaultSession from "public/session.json";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_AI_API,
  DEFAULT_ASCENDING,
  DEFAULT_CLOCK_SOURCE,
  DEFAULT_EMULATOR_RELAY_URL,
  DEFAULT_MUTED,
  DEFAULT_THEME,
  DEFAULT_VOLUME,
  DEFAULT_WALLPAPER,
  DEFAULT_WALLPAPER_FIT,
  SESSION_FILE,
  UNDERCOVER_WALLPAPER,
} from "utils/constants";

const DEFAULT_SESSION = (defaultSession || {}) as unknown as SessionData;

const useSessionContextState = (): SessionContextState => {
  const { deletePath, readFile, rootFs, writeFile, lstat } = useFileSystem();
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [foregroundId, setForegroundId] = useState("");
  const [aiApi, setAiApi] = useState(DEFAULT_AI_API);
  const [emulatorRelayUrl, setEmulatorRelayUrl] = useState(
    DEFAULT_EMULATOR_RELAY_URL
  );
  const [stackOrder, setStackOrder] = useState<string[]>([]);
  const [themeName, setThemeName] = useState(DEFAULT_THEME);
  const [clockSource, setClockSource] = useState(DEFAULT_CLOCK_SOURCE);
  const [windowStates, setWindowStates] = useState(
    Object.create(null) as WindowStates
  );
  const [sortOrders, setSortOrders] = useState(
    Object.create(null) as SortOrders
  );
  const [iconPositions, setIconPositions] = useState(
    Object.create(null) as IconPositions
  );
  const [wallpaperFit, setWallpaperFit] = useState(DEFAULT_WALLPAPER_FIT);
  const [wallpaperImage, setWallpaperImage] = useState(DEFAULT_WALLPAPER);
  const [undercoverAppearance, setUndercoverAppearance] =
    useState<UndercoverAppearance>();
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [muted, setMuted] = useState(DEFAULT_MUTED);
  const [runHistory, setRunHistory] = useState<string[]>([]);
  const prependToStack = useCallback(
    (id: string) =>
      setStackOrder((currentStackOrder) =>
        currentStackOrder[0] === id
          ? currentStackOrder
          : [id, ...currentStackOrder.filter((stackId) => stackId !== id)]
      ),
    []
  );
  const removeFromStack = useCallback(
    (id: string) =>
      setStackOrder((currentStackOrder) =>
        currentStackOrder.filter((stackId) => stackId !== id)
      ),
    []
  );
  const setWallpaper = useCallback(
    (image: string, fit?: WallpaperFit): void => {
      if (fit) setWallpaperFit(fit);
      setWallpaperImage(image);
    },
    []
  );
  const enableUndercover = useCallback((): void => {
    if (themeName === "undercover") return;

    setUndercoverAppearance({ themeName, wallpaperFit, wallpaperImage });
    setThemeName("undercover");
    setWallpaper(UNDERCOVER_WALLPAPER, DEFAULT_WALLPAPER_FIT);
  }, [setWallpaper, themeName, wallpaperFit, wallpaperImage]);
  const disableUndercover = useCallback((): void => {
    if (themeName !== "undercover") return;

    const previousAppearance =
      undercoverAppearance?.themeName === "undercover"
        ? undefined
        : undercoverAppearance;

    setThemeName(previousAppearance?.themeName ?? DEFAULT_THEME);
    setWallpaper(
      previousAppearance?.wallpaperImage ?? DEFAULT_WALLPAPER,
      previousAppearance?.wallpaperFit ?? DEFAULT_WALLPAPER_FIT
    );
    // React's state setter requires an explicit value to clear this snapshot.
    // eslint-disable-next-line unicorn/no-useless-undefined
    setUndercoverAppearance(undefined);
  }, [setWallpaper, themeName, undercoverAppearance]);
  const [haltSession, setHaltSession] = useState(false);
  const setSortOrder = useCallback(
    (
      directory: string,
      order: string[] | ((currentSortOrder: string[]) => string[]),
      sortBy?: SortBy,
      ascending?: boolean
    ): void =>
      setSortOrders((currentSortOrder = {}) => {
        const [currentOrder, currentSortBy, currentAscending] =
          currentSortOrder[directory] || [];
        const newOrder =
          typeof order === "function" ? order(currentOrder) : order;

        return {
          ...currentSortOrder,
          [directory]: [
            newOrder,
            sortBy ?? currentSortBy,
            ascending ?? currentAscending ?? DEFAULT_ASCENDING,
          ],
        };
      }),
    []
  );
  const initializedSession = useRef(false);

  useEffect(() => {
    if (sessionLoaded && !haltSession) {
      const updateSessionFile = (): void => {
        writeFile(
          SESSION_FILE,
          JSON.stringify({
            aiApi,
            clockSource,
            emulatorRelayUrl,
            iconPositions,
            muted,
            runHistory,
            sortOrders,
            themeName,
            undercoverAppearance,
            volume,
            wallpaperFit,
            wallpaperImage,
            windowStates,
          }),
          true
        );
      };

      if (
        "requestIdleCallback" in window &&
        typeof window.requestIdleCallback === "function"
      ) {
        requestIdleCallback(updateSessionFile);
      } else {
        updateSessionFile();
      }
    }
  }, [
    aiApi,
    clockSource,
    emulatorRelayUrl,
    haltSession,
    iconPositions,
    muted,
    runHistory,
    sessionLoaded,
    sortOrders,
    themeName,
    undercoverAppearance,
    volume,
    wallpaperFit,
    wallpaperImage,
    windowStates,
    writeFile,
  ]);

  useEffect(() => {
    if (!initializedSession.current && rootFs) {
      const initSession = async (): Promise<void> => {
        initializedSession.current = true;

        try {
          let session: SessionData;

          try {
            session =
              (await lstat(SESSION_FILE)).blocks <= 0
                ? DEFAULT_SESSION
                : (JSON.parse(
                    (await readFile(SESSION_FILE)).toString()
                  ) as SessionData);
          } catch {
            session = DEFAULT_SESSION;
          }

          if (session.aiApi) setAiApi(session.aiApi);
          if (session.clockSource) setClockSource(session.clockSource);
          if (typeof session.volume === "number") setVolume(session.volume);
          if (typeof session.muted === "boolean") setMuted(session.muted);
          if (typeof session.emulatorRelayUrl === "string") {
            setEmulatorRelayUrl(session.emulatorRelayUrl);
          }
          if (session.themeName) setThemeName(session.themeName);
          if (session.undercoverAppearance) {
            setUndercoverAppearance(session.undercoverAppearance);
          }
          if (session.wallpaperImage) {
            setWallpaper(session.wallpaperImage, session.wallpaperFit);
          }
          if (
            session.sortOrders &&
            Object.keys(session.sortOrders).length > 0
          ) {
            setSortOrders(session.sortOrders);
          }
          if (
            session.iconPositions &&
            Object.keys(session.iconPositions).length > 0
          ) {
            // Persisted icon positions are passed straight to React as a `style`
            // prop on the desktop; a malformed value (string/array/null from an
            // old or corrupt session) makes React throw during render and blanks
            // the desktop. Keep only well-formed object entries.
            const validIconPositions = Object.fromEntries(
              Object.entries(session.iconPositions).filter(
                ([, pos]) =>
                  pos && typeof pos === "object" && !Array.isArray(pos)
              )
            );

            if (Object.keys(validIconPositions).length > 0) {
              setIconPositions(validIconPositions);
            }
          }
          if (
            session.windowStates &&
            Object.keys(session.windowStates).length > 0
          ) {
            setWindowStates(session.windowStates);
          }
          if (session.runHistory && session.runHistory.length > 0) {
            setRunHistory(session.runHistory);
          }
        } catch (error) {
          if ((error as ApiError)?.code === "ENOENT") {
            deletePath(SESSION_FILE);
          }
        }

        setSessionLoaded(true);
      };

      initSession();
    }
  }, [deletePath, lstat, readFile, rootFs, setWallpaper]);

  return {
    aiApi,
    clockSource,
    disableUndercover,
    emulatorRelayUrl,
    enableUndercover,
    foregroundId,
    iconPositions,
    muted,
    prependToStack,
    removeFromStack,
    runHistory,
    sessionLoaded,
    setClockSource,
    setEmulatorRelayUrl,
    setForegroundId,
    setHaltSession,
    setIconPositions,
    setMuted,
    setRunHistory,
    setSortOrder,
    setThemeName,
    setVolume,
    setWallpaper,
    setWindowStates,
    sortOrders,
    stackOrder,
    themeName,
    undercoverAppearance,
    volume,
    wallpaperFit,
    wallpaperImage,
    windowStates,
  };
};

export default useSessionContextState;
