import directory from "contexts/process/directory";
import { existsSync, readFileSync } from "fs";
import ini from "ini";
import { basename, join } from "path";

const APPS = [
  ["Liberty Office", "LibertyOffice"],
  ["Crow Studio", "CrowStudio"],
  ["Deeper", "Deeper"],
  ["Call of Roque", "CallOfRoque"],
] as const;

describe.each(["Desktop", "Start Menu"])("%s service shortcuts", (location) => {
  it.each(APPS)("resolves %s to its independent application", (title, id) => {
    const path = join(
      process.cwd(),
      "public/Users/Public",
      location,
      `${title}.url`
    );
    const parsed = ini.parse(
      existsSync(path) ? readFileSync(path, "utf8") : "[InternetShortcut]\n"
    ) as { InternetShortcut?: { BaseURL?: string; IconFile?: string } };
    const shortcut = parsed.InternetShortcut || {};
    const app = directory[shortcut.BaseURL || ""];

    // A missing shortcut or a BaseURL pointing at Browser cannot launch this app.
    expect(app?.title).toBe(title);
    expect(shortcut.BaseURL).toBe(id);
    expect(app.singleton).toBe(true);
    expect(app.Component).toBeDefined();
    for (const size of [16, 32, 48, 96, 144]) {
      const bytes = readFileSync(
        join(
          process.cwd(),
          "public/System/Icons",
          `${size}x${size}`,
          basename(shortcut.IconFile || "")
        )
      );

      expect(bytes.toString("ascii", 0, 4)).toBe("RIFF");
      expect(bytes.toString("ascii", 8, 12)).toBe("WEBP");
    }
  });
});

it("publishes the current desktop release notes in English and Portuguese", () => {
  const { version } = JSON.parse(
    readFileSync(join(process.cwd(), "package.json"), "utf8")
  ) as { version: string };
  const release = version.split(".").slice(0, 2).join(".");
  const path = join(
    process.cwd(),
    "public/Users/Public/Desktop",
    `What's New (v${release}).md`
  );
  const notes = existsSync(path) ? readFileSync(path, "utf8") : "";

  expect(notes).toContain(`# What's New in SecurityOS ${release}`);
  expect(notes.indexOf("## English")).toBeGreaterThanOrEqual(0);
  expect(notes.indexOf("## Português (Brasil)")).toBeGreaterThan(
    notes.indexOf("## English")
  );
  for (const url of [
    "https://office.securityops.co/",
    "https://office.securityops.co/demo",
    "https://crow.securityops.co/",
    "https://deeper.securityops.co/",
    "https://callofroque.roqueos.com/en/",
  ]) {
    expect(notes).toContain(url);
  }
  expect(notes).toMatch(/not anonymous/i);
  expect(notes).toMatch(/não anônim/i);
});
