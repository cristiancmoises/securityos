import type { SortBy } from "components/system/Files/FileManager/useSortBy";
import type { Size } from "components/system/Window/RndWindow/useResizable";
import type { Position } from "react-rnd";
import type { ThemeName } from "styles/themes";

export type UpdateFiles = (newFile?: string, oldFile?: string) => void;

export type WindowState = {
  maximized?: boolean;
  position?: Position;
  size?: Size;
};

export type WindowStates = Record<string, WindowState>;

export type WallpaperFit = "center" | "fill" | "fit" | "stretch" | "tile";

export type UndercoverAppearance = {
  themeName: ThemeName;
  wallpaperFit: WallpaperFit;
  wallpaperImage: string;
};

type SortOrder = [string[], SortBy, boolean];

export type SortOrders = Record<string, SortOrder>;

export type ClockSource = "local" | "ntp";

export type IconPosition = {
  gridColumnStart: number;
  gridRowStart: number;
};

export type IconPositions = Record<string, IconPosition>;

export type SessionData = {
  aiApi: string;
  clockSource: ClockSource;
  // WebSocket relay URL for the v86 emulator's guest networking. The default
  // selects the local Tor bridge and fails closed when it is unavailable; an
  // empty string explicitly disables guest networking.
  emulatorRelayUrl: string;
  iconPositions: IconPositions;
  muted: boolean;
  runHistory: string[];
  sortOrders: SortOrders;
  themeName: ThemeName;
  undercoverAppearance?: UndercoverAppearance;
  volume: number;
  wallpaperFit: WallpaperFit;
  wallpaperImage: string;
  windowStates: WindowStates;
};

export type SessionContextState = SessionData & {
  disableUndercover: () => void;
  enableUndercover: () => void;
  foregroundId: string;
  prependToStack: (id: string) => void;
  removeFromStack: (id: string) => void;
  sessionLoaded: boolean;
  setClockSource: React.Dispatch<React.SetStateAction<ClockSource>>;
  setEmulatorRelayUrl: React.Dispatch<React.SetStateAction<string>>;
  setForegroundId: React.Dispatch<React.SetStateAction<string>>;
  setHaltSession: React.Dispatch<React.SetStateAction<boolean>>;
  setIconPositions: React.Dispatch<React.SetStateAction<IconPositions>>;
  setMuted: React.Dispatch<React.SetStateAction<boolean>>;
  setRunHistory: React.Dispatch<React.SetStateAction<string[]>>;
  setSortOrder: (
    directory: string,
    order: string[] | ((currentSortOrder: string[]) => string[]),
    sortBy?: SortBy,
    ascending?: boolean
  ) => void;
  setThemeName: React.Dispatch<React.SetStateAction<ThemeName>>;
  setVolume: React.Dispatch<React.SetStateAction<number>>;
  setWallpaper: (image: string, fit?: WallpaperFit) => void;
  setWindowStates: React.Dispatch<React.SetStateAction<WindowStates>>;
  stackOrder: string[];
};
