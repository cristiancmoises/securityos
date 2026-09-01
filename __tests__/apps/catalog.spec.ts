import { createHash } from "crypto";
import { existsSync, readdirSync, readFileSync } from "fs";
import { basename, join, relative, sep } from "path";

const PROJECT_ROOT = process.cwd();
const ICON_SIZES = [16, 32, 48, 96, 144] as const;
const SHORTCUT_DIRECTORIES = [
  "public/Users/Public/Desktop",
  "public/Users/Public/Start Menu",
] as const;
const RETIRED_APPS = ["CryptPad", "Session", "Telegram", "WhatsApp"] as const;
const NEW_ICON_FAMILIES = [
  "godseye",
  "irc",
  "pinball",
  "undercover",
  "v86",
  "wiki",
  "zupt",
] as const;

const projectPath = (...segments: string[]): string =>
  join(PROJECT_ROOT, ...segments);

const APPS_DIRECTORY = projectPath("components/apps");

const readProjectFile = (...segments: string[]): string =>
  readFileSync(projectPath(...segments), "utf8");

const isWebP = (filePath: string): boolean => {
  const bytes = readFileSync(filePath);

  return (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  );
};

const listFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);

    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  });

const catalogSource = readProjectFile("contexts/process/directory.ts");
const constantsSource = readProjectFile("utils/constants.ts");
const dockerfileSource = readProjectFile("Dockerfile");
const runDialogSource = readProjectFile(
  "components/system/Dialogs/Run/index.tsx"
);
const processIconExpressions = [
  ...catalogSource.matchAll(/^\s{4}icon:\s+([^\n,]+),$/gm),
].map(([, expression]) => expression);
const processIconNames = [
  ...new Set([
    ...[
      ...catalogSource.matchAll(/icon: "\/System\/Icons\/([^"/]+)\.webp"/g),
    ].map(([, iconName]) => iconName),
    // FileExplorer uses the FOLDER_ICON constant instead of an inline path.
    "folder",
  ]),
].sort();

const iconPath = (name: string, size: number): string =>
  projectPath("public/System/Icons", `${size}x${size}`, `${name}.webp`);

const iconDigest = (name: string, size: number): string =>
  createHash("sha256")
    .update(readFileSync(iconPath(name, size)))
    .digest("hex");

describe("SecurityOS application catalog", () => {
  it("keeps the runtime-visible version aligned with package metadata", () => {
    const { version } = JSON.parse(readProjectFile("package.json")) as {
      version: string;
    };
    const packageDataBlock = constantsSource.match(
      /export const PACKAGE_DATA = {[\S\s]*?\n};/
    )?.[0];

    expect(packageDataBlock).toContain(`version: "${version}"`);
  });

  it("presents Zupt while preserving the legacy process identity", () => {
    expect(catalogSource).toMatch(
      /Vaptvupt:\s*{[\S\s]*?icon: "\/System\/Icons\/zupt\.webp"[\S\s]*?title: "Zupt"/
    );
    expect(catalogSource).not.toMatch(/^\s{2}Zupt:\s*{/m);

    for (const directory of SHORTCUT_DIRECTORIES) {
      const shortcut = readProjectFile(directory, "Zupt.url");

      expect(shortcut).toContain("BaseURL=Vaptvupt");
      expect(shortcut).toContain("IconFile=/System/Icons/zupt.webp");
      expect(existsSync(projectPath(directory, "Vaptvupt.url"))).toBe(false);
    }
  });

  it("keeps the Zupt Run alias mapped to the legacy process identifier", () => {
    expect(runDialogSource).toMatch(/\bzupt:\s*"Vaptvupt"/);
  });

  it.each(RETIRED_APPS)("fully removes the %s application", (appName) => {
    expect(catalogSource).not.toMatch(
      new RegExp(`^\\s{2}${appName}:\\s*\\{`, "m")
    );
    expect(existsSync(join(APPS_DIRECTORY, appName, "index.tsx"))).toBe(false);
    expect(catalogSource).not.toContain(`components/apps/${appName}`);
    expect(
      listFiles(APPS_DIRECTORY).some((filePath) =>
        relative(APPS_DIRECTORY, filePath).startsWith(`${appName}${sep}`)
      )
    ).toBe(false);

    for (const directory of SHORTCUT_DIRECTORIES) {
      const shortcuts = listFiles(projectPath(directory)).filter((filePath) =>
        filePath.endsWith(".url")
      );

      expect(shortcuts.map((filePath) => basename(filePath))).not.toContain(
        `${appName}.url`
      );
      expect(
        shortcuts.some((filePath) =>
          readFileSync(filePath, "utf8").includes(`BaseURL=${appName}`)
        )
      ).toBe(false);
    }

    expect(
      existsSync(
        projectPath("public/System/Icons", `${appName.toLowerCase()}.webp`)
      )
    ).toBe(false);
    for (const size of ICON_SIZES) {
      expect(existsSync(iconPath(appName.toLowerCase(), size))).toBe(false);
    }
  });

  it("does not retain retired app icon generators", () => {
    expect(existsSync(projectPath("scripts/genCryptpadIcon.mjs"))).toBe(false);
    expect(existsSync(projectPath("scripts/genMessengerIcons.mjs"))).toBe(
      false
    );
  });

  it("removes retired messenger transport profiles and shared embed code", () => {
    const transportSources = [
      readProjectFile("pages/api/proxy.ts"),
      readProjectFile("pages/api/proxy-capability.ts"),
      readProjectFile("server.js"),
      readProjectFile("utils/proxyCapability.d.ts"),
      readProjectFile("utils/proxyCapability.js"),
    ].join("\n");

    expect(transportSources).not.toMatch(/\b(?:telegram|whatsapp)\b/i);
    expect(
      existsSync(projectPath("components/apps/Messenger/MessengerEmbed.tsx"))
    ).toBe(false);
  });

  it("removes retired integrations from active deployment configuration", () => {
    const deploymentSources = [
      readProjectFile("docker-compose.yml"),
      readProjectFile("deploy/docker-compose.yml"),
      ...listFiles(projectPath("deploy/cloudmacs")).map((filePath) =>
        readFileSync(filePath, "utf8")
      ),
    ].join("\n");

    expect(deploymentSources).not.toMatch(
      /\b(?:cryptpad|telegram|telega|whatsapp|whatsappel|wuzapi)\b/i
    );
  });

  it("keeps Cloudmacs source opt-in and out of the default Compose stack", () => {
    const composeSource = readProjectFile("docker-compose.yml");
    const hardenedComposeSource = readProjectFile("deploy/docker-compose.yml");
    const ionosOverrideSource = readProjectFile(
      "deploy/ionos-no-cloudmacs.override.yml"
    );
    const nextConfigSource = readProjectFile("next.config.js");

    expect(existsSync(projectPath("components/apps/Cloudmacs/index.tsx"))).toBe(
      true
    );
    expect(existsSync(projectPath("deploy/cloudmacs/Dockerfile"))).toBe(true);
    expect(composeSource).toMatch(
      /^ {2}cloudmacs:\n {4}profiles: \["cloudmacs"]$/m
    );
    expect(composeSource).toMatch(
      /NEXT_PUBLIC_ENABLE_CLOUDMACS: \${NEXT_PUBLIC_ENABLE_CLOUDMACS:-false}/
    );
    expect(hardenedComposeSource).toContain(
      'NEXT_PUBLIC_ENABLE_CLOUDMACS: "false"'
    );
    expect(ionosOverrideSource).toMatch(
      /^ {2}cloudmacs:\n {4}profiles: \["retired-cloudmacs-do-not-enable"]$/m
    );
    expect(dockerfileSource).toContain(
      "ARG NEXT_PUBLIC_ENABLE_CLOUDMACS=false"
    );
    expect(nextConfigSource).toContain('"contexts/process/cloudmacs$"');
    expect(nextConfigSource).toContain(
      "./contexts/process/cloudmacs.disabled.ts"
    );
    for (const shortcutDirectory of SHORTCUT_DIRECTORIES) {
      expect(dockerfileSource).toContain(
        `/SecurityOS/${shortcutDirectory}/Cloudmacs.url`
      );
    }
    for (const size of ICON_SIZES) {
      expect(dockerfileSource).toContain(
        `/SecurityOS/public/System/Icons/${size}x${size}/emacs.webp`
      );
    }
  });

  it("keeps the production runtime on the unprivileged node user", () => {
    const runtimeUserDirectives = [
      ...dockerfileSource.matchAll(/^USER\s+(\S+)\s*$/gm),
    ].map(([, user]) => user);

    expect(runtimeUserDirectives.at(-1)).toBe("node");
    expect(dockerfileSource.indexOf("USER node")).toBeLessThan(
      dockerfileSource.indexOf("CMD [")
    );
  });

  it("registers Wiki at the exact SecurityOps origin", () => {
    const wikiSource = readProjectFile("components/apps/Wiki/index.tsx");

    expect(wikiSource).toContain('url: "https://wiki.securityops.co/"');
    expect(catalogSource).toMatch(
      /Wiki:\s*{[\S\s]*?import\("components\/apps\/Wiki"\)[\S\s]*?title: "SecurityOps Wiki"/
    );
    for (const directory of SHORTCUT_DIRECTORIES) {
      expect(readProjectFile(directory, "Wiki.url")).toContain("BaseURL=Wiki");
    }
  });
});

describe("process icon catalog", () => {
  it("ships Tor Browser assets as genuine WebP files", () => {
    for (const size of ICON_SIZES) {
      expect(isWebP(iconPath("torbrowser", size))).toBe(true);
    }
    expect(
      isWebP(projectPath("public/System/Icons/Favicons/16x16/torbrowser.webp"))
    ).toBe(true);
  });

  it("keeps every process icon reference in an auditable form", () => {
    expect(
      processIconExpressions.filter(
        (expression) =>
          expression !== "FOLDER_ICON" &&
          !/^"\/System\/Icons\/[^"/]+\.webp"$/.test(expression)
      )
    ).toEqual([]);
    expect(constantsSource).toContain("export const FOLDER_ICON");
    expect(constantsSource).toContain("ICON_PATH}/folder.webp");
  });

  it.each(processIconNames)(
    "%s supplies every supported resolution",
    (iconName) => {
      for (const size of ICON_SIZES) {
        expect(existsSync(iconPath(iconName, size))).toBe(true);
      }
    }
  );

  it.each(["folder_back", "folder_front"])(
    "%s supplies every supported folder-overlay resolution",
    (iconName) => {
      for (const size of ICON_SIZES) {
        expect(existsSync(iconPath(iconName, size))).toBe(true);
      }
    }
  );

  it.each(ICON_SIZES)(
    "keeps the new icon families distinct at %ipx",
    (size) => {
      const digests = NEW_ICON_FAMILIES.map((iconName) =>
        iconDigest(iconName, size)
      );

      expect(new Set(digests).size).toBe(NEW_ICON_FAMILIES.length);
    }
  );
});

describe("Undercover branding", () => {
  it("keeps active source and assets free of prohibited product names", () => {
    const sourceFiles = [
      ...listFiles(projectPath("components/apps/Undercover")),
      ...listFiles(projectPath("styles/undercover")),
      projectPath("scripts/genUndercoverWallpaper.mjs"),
      projectPath("utils/undercoverNames.ts"),
    ];
    const corpus = sourceFiles
      .map(
        (filePath) =>
          `${relative(PROJECT_ROOT, filePath)}\n${readFileSync(
            filePath,
            "utf8"
          )}`
      )
      .join("\n");

    expect(corpus).not.toMatch(
      /\b(?:bing|copilot|microsoft|office|onedrive|outlook|teams)\b/i
    );
    expect(corpus).not.toMatch(/\b(?:Edge|Windows)\b/);
    expect(corpus).not.toMatch(/win11/i);
    expect(
      existsSync(
        projectPath(
          "public/Users/Public/Pictures/Wallpapers/Undercover/win11.webp"
        )
      )
    ).toBe(false);
  });
});
