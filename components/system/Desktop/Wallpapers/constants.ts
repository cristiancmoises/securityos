import type { WallpaperFunc } from "components/system/Desktop/Wallpapers/types";
import type { WallpaperFit } from "contexts/session/types";

export const bgPositionSize: Record<WallpaperFit, string> = {
  center: "center center",
  fill: "center center / cover",
  fit: "center center / contain",
  stretch: "center center / 100% 100%",
  tile: "50% 50%",
};

export const WALLPAPER_PATHS: Record<
  string,
  () => Promise<{ default: WallpaperFunc }>
> = {
  COASTAL_LANDSCAPE: () =>
    import("components/system/Desktop/Wallpapers/ShaderToy/CoastalLandscape"),
  HEXELLS: () => import("components/system/Desktop/Wallpapers/hexells"),
};

export const WALLPAPER_WORKERS: Record<string, (info?: string) => Worker> = {
  COASTAL_LANDSCAPE: (): Worker =>
    new Worker(
      new URL(
        "components/system/Desktop/Wallpapers/ShaderToy/CoastalLandscape/wallpaper.worker",
        import.meta.url
      ),
      { name: "Wallpaper (Coastal Landscape)" }
    ),
  HEXELLS: (): Worker =>
    new Worker(
      new URL(
        "components/system/Desktop/Wallpapers/hexells/wallpaper.worker",
        import.meta.url
      ),
      { name: "Wallpaper (Hexells)" }
    ),
};

type WallpaperMenuItem = {
  id: string;
  name?: string;
  startsWith?: boolean;
};

export const WALLPAPER_MENU: WallpaperMenuItem[] = [
  {
    id: "APOD",
    startsWith: true,
  },
  {
    id: "SLIDESHOW",
    name: "Picture Slideshow",
  },
];

export const BASE_CANVAS_SELECTOR = ":scope > canvas";

export const BASE_VIDEO_SELECTOR = ":scope > video";
