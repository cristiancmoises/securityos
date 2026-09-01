// Cloudmacs stays available as optional source, but production images exclude
// its launch surfaces unless an operator explicitly enables the local profile.
// NEXT_PUBLIC_* is intentional: Next.js replaces this value in the browser
// bundle at build time; it is not a runtime secret or mutable client setting.
export const CLOUDMACS_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_CLOUDMACS === "true";
