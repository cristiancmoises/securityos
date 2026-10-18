import ServiceLauncher from "components/apps/ServiceLauncher";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import type { FC } from "react";

const CallOfRoque: FC<ComponentProcessProps> = () => (
  <ServiceLauncher service="callofroque" />
);

export default CallOfRoque;
