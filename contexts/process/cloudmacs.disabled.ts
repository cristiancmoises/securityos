import type { Processes } from "contexts/process/types";

// Production replacement for the optional Cloudmacs registration. Keeping the
// empty module explicit makes the bundle exclusion independently auditable.
const cloudmacsProcesses: Processes = {};

export default cloudmacsProcesses;
