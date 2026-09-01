declare module "prettier" {
  export type Plugin = Record<string, unknown>;
}

declare module "prettier/parser-babel" {
  import type { Plugin } from "prettier";

  const plugin: Plugin;

  export = plugin;
}

declare module "prettier/parser-html" {
  import type { Plugin } from "prettier";

  const plugin: Plugin;

  export = plugin;
}

declare module "prettier/parser-markdown" {
  import type { Plugin } from "prettier";

  const plugin: Plugin;

  export = plugin;
}

declare module "prettier/parser-postcss" {
  import type { Plugin } from "prettier";

  const plugin: Plugin;

  export = plugin;
}

declare module "prettier/standalone" {
  import type { Plugin } from "prettier";

  export const format: (
    source: string,
    options?: {
      parser?: string;
      plugins?: Plugin[];
    }
  ) => string;
}
