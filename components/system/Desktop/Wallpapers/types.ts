import type { Size } from "components/system/Window/RndWindow/useResizable";

export type WallpaperConfig = Partial<typeof MatrixConfig> | VantaWavesConfig;

export type WallpaperFunc = (
  el: HTMLElement | null,
  config?: WallpaperConfig
) => Promise<void> | void;

export type OffscreenRenderProps = {
  canvas: OffscreenCanvas;
  clockSize?: Size;
  config?: VantaWavesConfig;
  devicePixelRatio: number;
};
