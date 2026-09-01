import { Browser } from "components/apps/TorBrowser";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import type { FC } from "react";

const ClearnetBrowser: FC<ComponentProcessProps> = (props) => (
  <Browser {...props} mode="clearnet" />
);

export default ClearnetBrowser;
