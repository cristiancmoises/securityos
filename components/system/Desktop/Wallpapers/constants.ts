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
  MATRIX: () => import("components/system/Desktop/Wallpapers/Matrix"),
  VANTA: () => import("components/system/Desktop/Wallpapers/vantaWaves"),
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
  VANTA: (info?: string): Worker =>
    new Worker(
      new URL(
        "components/system/Desktop/Wallpapers/vantaWaves/wallpaper.worker",
        import.meta.url
      ),
      { name: `Wallpaper (Vanta Waves)${info ? ` [${info}]` : ""}` }
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
    id: "HEXELLS",
    name: "Hexells",
  },
  {
    id: "MATRIX 2D",
    name: "Matrix (2D)",
  },
  {
    id: "MATRIX 3D",
    name: "Matrix (3D)",
  },
  {
    id: "SLIDESHOW",
    name: "Picture Slideshow",
  },
  {
    id: "VANTA",
    name: "Vanta Waves",
    startsWith: true,
  },
  {
    id: "/Users/Public/Pictures/Wallpapers/Anonymity/guy-fawkes-mask.webp",
    name: "Anonymity",
  },
  {
    id: "/Users/Public/Pictures/Wallpapers/Art/flow-field.webp",
    name: "Art",
  },
  {
    id: "/Users/Public/Pictures/Wallpapers/BSD/beastie-emblem.webp",
    name: "BSD",
  },
  {
    id: "/Users/Public/Pictures/Wallpapers/Christ/cross-sunset.webp",
    name: "Christ",
  },
  {
    id: "/Users/Public/Pictures/Wallpapers/Emacs/gnu.webp",
    name: "Emacs",
  },
  {
    id: "/Users/Public/Pictures/Wallpapers/Forensics/fingerprint.webp",
    name: "Forensics",
  },
  {
    id: "/Users/Public/Pictures/Wallpapers/Gentoo/gentoo-penguin.webp",
    name: "Gentoo",
  },
  {
    id: "/Users/Public/Pictures/Wallpapers/Guix/gnu.webp",
    name: "Guix",
  },
  {
    id: "/Users/Public/Pictures/Wallpapers/Hacking/code-screen.webp",
    name: "Hacking",
  },
  {
    id: "/Users/Public/Pictures/Wallpapers/Matrix/matrix-rain.webp",
    name: "Matrix",
  },
  {
    id: "/Users/Public/Pictures/Wallpapers/Nature/aurora-borealis.webp",
    name: "Nature",
  },
  {
    id: "/Users/Public/Pictures/Wallpapers/Security/securityos-logo.webp",
    name: "SecurityOps Logo",
  },
  {
    id: "/Users/Public/Pictures/Wallpapers/Security/securityos-brand.webp",
    name: "Security",
  },
  {
    id: "/Users/Public/Pictures/Wallpapers/Space/ringed-world.webp",
    name: "Space",
  },
  {
    id: "/Users/Public/Pictures/Wallpapers/Technology/circuit-board.webp",
    name: "Technology",
  },
  {
    id: "/Users/Public/Pictures/Wallpapers/Unix/unix-tty.webp",
    name: "Unix",
  },
];

export const BASE_CANVAS_SELECTOR = ":scope > canvas";

export const BASE_VIDEO_SELECTOR = ":scope > video";
