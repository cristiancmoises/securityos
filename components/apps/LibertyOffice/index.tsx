import ServiceLauncher from "components/apps/ServiceLauncher";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import type { FC } from "react";

const LibertyOffice: FC<ComponentProcessProps> = () => (
  <ServiceLauncher service="office" />
);

export default LibertyOffice;
