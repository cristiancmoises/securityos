import RecoveryScreen from "components/pages/RecoveryScreen";
import { Component, createElement } from "react";

type ErrorBoundaryProps = {
  FallbackRender?: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

// How many times we'll auto-reload to recover from a (hopefully transient) error
// within a short window before giving up and showing the recovery screen. The
// OLD behavior was to reload on EVERY error with no limit — so a persistent error
// (e.g. corrupted saved state) reloaded forever, which is the "stuck / blinking /
// nothing displays" boot the desktop could get into. We now reload at most once,
// then surface a real recovery UI instead of looping.
const RELOAD_LOG_KEY = "securityos:eb-reloads";
const RELOAD_WINDOW_MS = 20_000;
const MAX_AUTO_RELOADS = 1;

const recentReloadCount = (): number => {
  try {
    const now = Date.now();
    const raw = window.sessionStorage.getItem(RELOAD_LOG_KEY);
    const log: number[] = raw ? JSON.parse(raw) : [];

    return log.filter((time) => now - time < RELOAD_WINDOW_MS).length;
  } catch {
    return 0;
  }
};

const recordReload = (): void => {
  try {
    const now = Date.now();
    const raw = window.sessionStorage.getItem(RELOAD_LOG_KEY);
    const log: number[] = raw ? JSON.parse(raw) : [];

    window.sessionStorage.setItem(
      RELOAD_LOG_KEY,
      JSON.stringify([...log.filter((time) => now - time < RELOAD_WINDOW_MS), now])
    );
  } catch {
    // ignore storage failures
  }
};

export class ErrorBoundary extends Component<
  React.PropsWithChildren<ErrorBoundaryProps>,
  ErrorBoundaryState
> {
  public constructor(props: React.PropsWithChildren<ErrorBoundaryProps>) {
    super(props);
    this.state = { hasError: false };
  }

  public shouldComponentUpdate(): boolean {
    return false;
  }

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(): void {
    const { FallbackRender } = this.props;

    // A caller-supplied fallback (or Next.js dev overlay) handles its own UX —
    // never auto-reload in those cases.
    if (FallbackRender || "__nextDevClientId" in window) return;

    // Transient recovery: reload ONCE. If we've already reloaded recently and the
    // error came right back, stop — render() will show the recovery screen.
    if (recentReloadCount() < MAX_AUTO_RELOADS) {
      recordReload();
      window.location.reload();
    }
  }

  public render(): React.ReactNode {
    const {
      props: { children, FallbackRender },
      state: { hasError },
    } = this;

    if (!hasError) return children;

    // Persistent error with no caller fallback → show the recovery screen with a
    // Reset option instead of reloading forever.
    return FallbackRender ?? createElement(RecoveryScreen);
  }
}
