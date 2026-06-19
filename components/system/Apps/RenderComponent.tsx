import { ErrorBoundary } from "components/pages/ErrorBoundary";
import ComponentError from "components/system/Apps/ComponentError";
import dynamic from "next/dynamic";
import { memo } from "react";

const Window = dynamic(() => import("components/system/Window"));

export type ComponentProcessProps = {
  id: string;
};

type RenderComponentProps = {
  Component: React.ComponentType<ComponentProcessProps>;
  hasWindow?: boolean;
  id: string;
};

const RenderComponent: FC<RenderComponentProps> = ({
  Component,
  hasWindow = true,
  id,
}) => {
  // The ErrorBoundary wraps the Window TOO (not just the Component) so a throw
  // from Window/RndWindow itself — e.g. on a stale/corrupt persisted windowState
  // — is caught locally (ComponentError, no reload) instead of bubbling to the
  // top-level boundary and taking down the whole desktop.
  const content = hasWindow ? (
    <Window id={id}>
      <Component id={id} />
    </Window>
  ) : (
    <Component id={id} />
  );

  return (
    <ErrorBoundary FallbackRender={<ComponentError />}>{content}</ErrorBoundary>
  );
};

export default memo(RenderComponent);
