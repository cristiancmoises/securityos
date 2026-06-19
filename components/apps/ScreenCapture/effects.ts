// Webcam effects / themes for the Screen Capture picture-in-picture overlay.
//
// Every effect is pure canvas-2D and CSP-clean: NO external dependencies, NO CDN
// scripts, and NO downloaded ML models (the SecurityOS Tor-only CSP forbids
// loading remote code/models). Each effect takes the live webcam <video> and a
// destination 2D context sized to the PiP box, and paints the themed webcam into
// it. The screen-capture draw loop then composites that box onto the recording.
//
// Design goals:
//  - Cheap enough to run every animation frame without tanking the frame rate.
//  - Fail-soft: a thrown effect must never break the recording. The draw loop
//    wraps these in try/catch and falls back to a plain webcam draw.

export type WebcamEffect =
  | "none"
  | "matrix"
  | "grayscale"
  | "sepia"
  | "neon"
  | "blur"
  | "background-blur";

export const DEFAULT_WEBCAM_EFFECT: WebcamEffect = "none";

// Labels for the UI dropdown. Order here is the order shown to the user.
export const WEBCAM_EFFECT_OPTIONS: { label: string; value: WebcamEffect }[] = [
  { label: "None", value: "none" },
  { label: "Matrix (digital rain)", value: "matrix" },
  { label: "Grayscale", value: "grayscale" },
  { label: "Sepia", value: "sepia" },
  { label: "Neon / Invert", value: "neon" },
  { label: "Blur", value: "blur" },
  { label: "Background blur", value: "background-blur" },
];

// A source the effects can draw from. The live webcam <video> satisfies this,
// and so does a <canvas> (used for the small UI preview).
type DrawSource = CanvasImageSource & {
  readonly videoWidth?: number;
  readonly videoHeight?: number;
};

// Per-instance mutable state for stateful effects (currently only Matrix needs
// it, to persist the rain columns between frames). One renderer owns one state
// object, so the PiP loop and the UI preview don't interfere with each other.
export type WebcamEffectState = {
  matrix?: MatrixState;
};

export const createWebcamEffectState = (): WebcamEffectState => ({});

// ---------------------------------------------------------------------------
// Matrix digital-rain
// ---------------------------------------------------------------------------
// Recreation of the classic "Matrix" green code rain (visual reference:
// cristiancezarmoises.com/download/matrix.html — green katakana/glyph columns
// falling on black). We render the rain on its own offscreen canvas and blend
// the webcam in with a green tint, so the operator is visible "inside" the code.

type MatrixState = {
  canvas: HTMLCanvasElement;
  columns: number;
  // Current y (in rows) of the leading glyph for each column.
  drops: number[];
  fontSize: number;
  height: number;
  width: number;
};

// Half-width katakana + digits + a few latin glyphs — the canonical Matrix set.
const MATRIX_GLYPHS =
  "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾚﾛﾜﾝ0123456789ABCDEFZ:.=*+-<>";

const randomGlyph = (): string =>
  MATRIX_GLYPHS.charAt(Math.floor(Math.random() * MATRIX_GLYPHS.length));

// Lazily (re)build the rain state when the PiP box size changes.
const ensureMatrixState = (
  state: WebcamEffectState,
  width: number,
  height: number
): MatrixState => {
  const fontSize = Math.max(10, Math.round(width / 26));
  const existing = state.matrix;

  if (
    existing &&
    existing.width === width &&
    existing.height === height &&
    existing.fontSize === fontSize
  ) {
    return existing;
  }

  const canvas = existing?.canvas ?? document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  const columns = Math.max(1, Math.floor(width / fontSize));
  // Seed each column at a random start so the rain doesn't fall in lockstep.
  const drops = Array.from({ length: columns }, () =>
    Math.floor((Math.random() * height) / fontSize)
  );

  const next: MatrixState = {
    canvas,
    columns,
    drops,
    fontSize,
    height,
    width,
  };

  state.matrix = next;

  return next;
};

const drawMatrix = (
  context: CanvasRenderingContext2D,
  source: DrawSource,
  width: number,
  height: number,
  state: WebcamEffectState
): void => {
  const rain = ensureMatrixState(state, width, height);
  const rainContext = rain.canvas.getContext("2d");

  if (!rainContext) {
    // Offscreen context unavailable — degrade to a green-tinted webcam.
    context.drawImage(source, 0, 0, width, height);
    context.globalCompositeOperation = "color";
    context.fillStyle = "#00ff41";
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = "source-over";

    return;
  }

  // 1) Fade the previous rain frame toward black for the classic trailing glow.
  rainContext.fillStyle = "rgba(0, 0, 0, 0.08)";
  rainContext.fillRect(0, 0, width, height);

  // 2) Draw the falling glyphs, brightening the leading character of each drop.
  rainContext.font = `${rain.fontSize}px monospace`;
  rainContext.textBaseline = "top";

  for (let i = 0; i < rain.columns; i += 1) {
    const x = i * rain.fontSize;
    const y = rain.drops[i] * rain.fontSize;

    rainContext.fillStyle = "#cfffd6";
    rainContext.fillText(randomGlyph(), x, y);
    rainContext.fillStyle = "#00ff41";
    rainContext.fillText(randomGlyph(), x, y - rain.fontSize);

    // Reset the column to the top at random once it falls off the bottom.
    if (y > height && Math.random() > 0.975) {
      rain.drops[i] = 0;
    } else {
      rain.drops[i] += 1;
    }
  }

  // 3) Composite: black base, green-keyed webcam, then the rain on top so the
  //    operator appears to be embedded in the code.
  context.fillStyle = "#000";
  context.fillRect(0, 0, width, height);

  context.save();
  context.globalAlpha = 0.55;
  context.drawImage(source, 0, 0, width, height);
  // Green tint the webcam: keep luminance, force a green hue.
  context.globalCompositeOperation = "color";
  context.fillStyle = "#00ff41";
  context.fillRect(0, 0, width, height);
  context.restore();

  // Add the rain with screen blending so bright glyphs glow over the webcam.
  context.save();
  context.globalCompositeOperation = "screen";
  context.drawImage(rain.canvas, 0, 0, width, height);
  context.restore();
};

// ---------------------------------------------------------------------------
// CSS-filter based effects (grayscale / sepia / neon-invert / blur)
// ---------------------------------------------------------------------------
// The 2D context `filter` property is hardware-accelerated and CSP-clean, so
// these stay fast even at 60fps. We set the filter, draw, then reset it.

const drawWithFilter = (
  context: CanvasRenderingContext2D,
  source: DrawSource,
  width: number,
  height: number,
  filter: string
): void => {
  const previous = context.filter;

  context.filter = filter;
  context.drawImage(source, 0, 0, width, height);
  context.filter = previous || "none";
};

// ---------------------------------------------------------------------------
// Background blur (best-effort "remove background")
// ---------------------------------------------------------------------------
// True person segmentation ("remove background") needs an ML model (e.g.
// MediaPipe Selfie Segmentation / BodyPix). Those models are loaded from a CDN,
// which the SecurityOS Tor-only CSP blocks, and we deliberately do NOT bundle a
// model here. So "Remove background" is implemented as a best-effort, CSP-clean
// BACKGROUND BLUR: a strong gaussian blur over the whole webcam frame.
//
// NOTE: For true segmentation (sharp subject over a blurred/replaced
// background) a model must be SELF-HOSTED (shipped with the app and added to the
// CSP allow-list), then run via MediaStreamTrackProcessor or WebGL. Until then
// this gives a recognisable "background blur" look without any remote code.
//
// If/when the platform-native background-blur constraint (currently
// experimental, Chromium) is available it is applied to the webcam track in the
// hook before compositing; this canvas pass is the universal fallback.
const drawBackgroundBlur = (
  context: CanvasRenderingContext2D,
  source: DrawSource,
  width: number,
  height: number
): void => {
  drawWithFilter(context, source, width, height, "blur(8px)");
};

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------
// Paint `source` into `context` (sized width x height) applying `effect`. The
// caller has already translated/clipped the context to the PiP box, so effects
// always draw at (0, 0). Never throws meaningfully — but callers should still
// wrap this so a future effect bug can't break a live recording.
export const drawWebcamEffect = (
  context: CanvasRenderingContext2D,
  source: DrawSource,
  width: number,
  height: number,
  effect: WebcamEffect,
  state: WebcamEffectState
): void => {
  switch (effect) {
    case "matrix":
      drawMatrix(context, source, width, height, state);
      break;
    case "grayscale":
      drawWithFilter(context, source, width, height, "grayscale(1)");
      break;
    case "sepia":
      drawWithFilter(context, source, width, height, "sepia(1)");
      break;
    case "neon":
      drawWithFilter(
        context,
        source,
        width,
        height,
        "invert(1) saturate(2.2) hue-rotate(180deg) contrast(1.2)"
      );
      break;
    case "blur":
      drawWithFilter(context, source, width, height, "blur(4px)");
      break;
    case "background-blur":
      drawBackgroundBlur(context, source, width, height);
      break;
    case "none":
    default:
      context.drawImage(source, 0, 0, width, height);
      break;
  }
};

// Whether this effect benefits from the experimental platform background-blur
// constraint being applied to the camera track (used by the hook).
export const wantsPlatformBackgroundBlur = (effect: WebcamEffect): boolean =>
  effect === "background-blur";
