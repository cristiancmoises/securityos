import { useSession } from "contexts/session";
import { useEffect } from "react";

// useMasterAudio — turns the taskbar Volume into a TRUE master that governs ALL
// web-OS sound, not just media elements.
//
//   1. Media elements (<audio>/<video>) — volume/muted applied to every current
//      element and to any added later (MutationObserver).
//   2. WebAudio — a per-AudioContext master GainNode is transparently inserted in
//      front of `destination` by monkey-patching `AudioNode.prototype.connect`
//      (installed once, guarded). Webamp, the v86 emulator and AudioContext games
//      (Quake3, SpaceCadet, ...) all route through it, so the master controls them.
//   3. Webamp — best-effort SET_VOLUME dispatch on its Redux store.
//
// Everything is feature-guarded and never throws; the patch installs at most once
// (window-level flag) and applying the level is idempotent.

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

// ---------------------------------------------------------------------------
// Module-level state (shared across all hook callers / re-renders).
// ---------------------------------------------------------------------------

// Registry of every per-context master gain we created. We keep the AudioContext
// as the key so we can drop entries for contexts that get closed and so a single
// context never gets two masters.
const masterGains = new WeakMap<BaseAudioContext, GainNode>();

// Live list of master gains so we can re-apply the level to all of them on
// change. WeakMap isn't iterable, so we track gains in a parallel Set; gains for
// closed/GC'd contexts are harmless (setting .gain on a detached node is a no-op
// once dropped) and we prune obviously-dead ones opportunistically.
const liveMasters = new Set<GainNode>();

// The most recently requested master level, so newly created contexts (created
// after the last session change) start at the correct gain.
let currentLevel = 1;

const FLAG = "__securityOsMasterAudioInstalled__";

type PatchableWindow = Window & {
  [FLAG]?: boolean;
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
  WebampGlobal?: {
    store?: { dispatch: (action: { type: string; volume?: number }) => void };
  };
};

// ---------------------------------------------------------------------------
// WebAudio master-gain plumbing.
// ---------------------------------------------------------------------------

// Lazily create (or fetch) the master gain for a context. The master is wired
// directly to the *real* destination via the original (unpatched) connect, so we
// never recurse through our own override.
const getMasterGain = (
  context: BaseAudioContext,
  originalConnect: typeof AudioNode.prototype.connect
): GainNode | undefined => {
  const existing = masterGains.get(context);

  if (existing) return existing;

  let master: GainNode;

  try {
    master = context.createGain();
  } catch {
    return undefined;
  }

  master.gain.value = currentLevel;
  masterGains.set(context, master);
  liveMasters.add(master);

  // Connect master -> real destination using the ORIGINAL connect so this very
  // wire isn't itself rerouted (which would create a self-loop).
  try {
    originalConnect.call(master, context.destination);
  } catch {
    // If we somehow can't reach the destination, abandon this master rather
    // than break the app's audio graph.
    masterGains.delete(context);
    liveMasters.delete(master);

    return undefined;
  }

  return master;
};

// Install the connect() interception exactly once per page.
const installWebAudioPatch = (win: PatchableWindow): void => {
  const Ctx = win.AudioContext || win.webkitAudioContext;

  if (!Ctx || typeof AudioNode === "undefined") return;

  const proto = AudioNode.prototype;
  const originalConnect = proto.connect;

  // connect() has two overloads (AudioNode target / AudioParam target). We only
  // ever reroute the AudioNode-target form when the target is the context's real
  // `destination`; every other call is forwarded untouched and its return value
  // preserved (the spec returns the destination AudioNode, or void for params).
  function patchedConnect(
    this: AudioNode,
    destination: AudioNode | AudioParam,
    output?: number,
    input?: number
  ): AudioNode | void {
    try {
      const context = this.context;
      const isDestinationNode =
        typeof AudioDestinationNode !== "undefined" &&
        destination instanceof AudioDestinationNode &&
        context &&
        destination === context.destination;

      if (isDestinationNode) {
        const master = getMasterGain(context, originalConnect);

        if (master && master !== this) {
          // Route this node into the master instead of the real destination.
          // Preserve the optional output index; master always uses input 0.
          if (output === undefined) {
            originalConnect.call(this, master);
          } else {
            originalConnect.call(this, master, output);
          }

          // Per spec, connect(AudioNode) returns the destination node. We hand
          // back the master so chained `.connect(dest).connect(...)` keeps
          // working through the master path.
          return master;
        }
      }
    } catch {
      // Fall through to the original behaviour on any unexpected failure.
    }

    // Default: forward exactly the args we received and return the real result.
    if (output === undefined) {
      return originalConnect.call(this, destination as AudioNode);
    }
    if (input === undefined) {
      return originalConnect.call(this, destination as AudioNode, output);
    }

    return originalConnect.call(this, destination as AudioNode, output, input);
  }

  // eslint-disable-next-line no-param-reassign
  proto.connect = patchedConnect as typeof proto.connect;
};

// ---------------------------------------------------------------------------
// Apply the level everywhere.
// ---------------------------------------------------------------------------

const applyToWebAudio = (level: number): void => {
  liveMasters.forEach((master) => {
    try {
      // Track potentially-detached masters: a closed context's destination is
      // gone, but setting gain is still safe; prune ones whose context closed.
      const { context } = master;

      if ((context as AudioContext).state === "closed") {
        liveMasters.delete(master);

        return;
      }

      master.gain.value = level;
    } catch {
      liveMasters.delete(master);
    }
  });
};

const applyToMedia = (
  root: ParentNode,
  volume: number,
  muted: boolean
): void => {
  root
    .querySelectorAll<HTMLMediaElement>("video, audio")
    .forEach((element) => {
      try {
        element.volume = volume;
        element.muted = muted;
      } catch {
        // Ignore elements that reject volume/muted (e.g. cross-origin media).
      }
    });
};

const applyToWebamp = (win: PatchableWindow, level: number): void => {
  const store = win.WebampGlobal?.store;

  if (!store?.dispatch) return;

  try {
    store.dispatch({ type: "SET_VOLUME", volume: Math.round(level * 100) });
  } catch {
    // Best-effort only.
  }
};

// ---------------------------------------------------------------------------
// The hook.
// ---------------------------------------------------------------------------

const useMasterAudio = (): void => {
  const { muted, volume } = useSession();

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const win = window as PatchableWindow;
    const level = muted ? 0 : clamp01(volume);

    currentLevel = level;

    // Install the WebAudio connect() interception once for the whole page.
    if (!win[FLAG]) {
      try {
        installWebAudioPatch(win);
      } catch {
        // If patching fails we still control media elements + Webamp below.
      }
      win[FLAG] = true;
    }

    // 1. WebAudio masters.
    applyToWebAudio(level);

    // 2. Media elements (current + future).
    applyToMedia(document, clamp01(volume), muted);

    let observer: MutationObserver | undefined;

    if (typeof MutationObserver !== "undefined" && document.body) {
      observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLMediaElement) {
              try {
                node.volume = clamp01(volume);
                node.muted = muted;
              } catch {
                // Ignore.
              }
            } else if (node instanceof Element) {
              applyToMedia(node, clamp01(volume), muted);
            }
          });
        });
      });

      observer.observe(document.body, { childList: true, subtree: true });
    }

    // 3. Webamp.
    applyToWebamp(win, level);

    return () => observer?.disconnect();
  }, [muted, volume]);
};

export default useMasterAudio;
