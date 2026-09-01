import RoutedWebApp from "components/apps/RoutedWebApp";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import type { FC } from "react";

const GODS_EYE_URL = "https://eye.securityops.co/";

// GODS EYE is a large Vite/Cesium application. A rewritten query-URL proxy cannot
// preserve every ESM import and worker. Tor mode still offers a fail-closed,
// sandboxed view; the explicitly selected native clearnet iframe remains the fully
// compatible Cesium path and is clearly labelled as direct.
const GODS_EYE = {
  accent: "#36e89b",
  allow: "fullscreen",
  directTransport: "native" as const,
  name: "GODS EYE",
  profile: "godseye" as const,
  subtitle: "SecurityOps intelligence dashboard",
  torNote:
    "The dashboard is fetched through Tor in an opaque sandbox; complex Cesium workers may be limited.",
  url: GODS_EYE_URL,
};

const GodsEye: FC<ComponentProcessProps> = (props) => (
  <RoutedWebApp {...props} config={GODS_EYE} />
);

export default GodsEye;
