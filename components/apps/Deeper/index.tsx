import ServiceLauncher from "components/apps/ServiceLauncher";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import type { FC } from "react";

const Deeper: FC<ComponentProcessProps> = () => (
  <ServiceLauncher service="deeper" />
);

export default Deeper;
