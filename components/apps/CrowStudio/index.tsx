import ServiceLauncher from "components/apps/ServiceLauncher";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import type { FC } from "react";

const CrowStudio: FC<ComponentProcessProps> = () => (
  <ServiceLauncher service="crow" />
);

export default CrowStudio;
