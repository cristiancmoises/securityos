import type { Processes } from "contexts/process/types";
import dynamic from "next/dynamic";

// Kept in a separate module so the production webpack build can replace the
// whole optional registration before it ever traverses the Cloudmacs component.
const cloudmacsProcesses: Processes = {
  Cloudmacs: {
    Component: dynamic(() => import("components/apps/Cloudmacs")),
    backgroundColor: "#1d1f21",
    defaultSize: {
      height: 640,
      width: 940,
    },
    icon: "/System/Icons/emacs.webp",
    singleton: true,
    title: "Cloudmacs",
  },
};

export default cloudmacsProcesses;
