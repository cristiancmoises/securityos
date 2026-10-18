import CallOfRoque from "components/apps/CallOfRoque";
import CrowStudio from "components/apps/CrowStudio";
import Deeper from "components/apps/Deeper";
import LibertyOffice from "components/apps/LibertyOffice";
import { act, type ReactNode } from "react";

const { createRoot } = jest.requireActual<{
  createRoot: (container: Element) => {
    render: (children: ReactNode) => void;
    unmount: () => void;
  };
}>("react-dom/client");

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// A wrong service target, missing direct disclosure or automatic iframe is a bug.
const APPS = [
  {
    App: LibertyOffice,
    name: "Liberty Office",
    url: "https://office.securityops.co/",
  },
  { App: CrowStudio, name: "Crow Studio", url: "https://crow.securityops.co/" },
  { App: Deeper, name: "Deeper", url: "https://deeper.securityops.co/" },
  {
    App: CallOfRoque,
    name: "Call of Roque",
    url: "https://callofroque.roqueos.com/en/",
  },
] as const;

describe("independent full-client service apps", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it.each(APPS)(
    "opens $name only through its explicit native-client link",
    ({ App, name, url }) => {
      act(() => root.render(<App id="service" />));
      const link = [...container.querySelectorAll("a")].find(
        (element) => element.textContent === `Open ${name}`
      );

      expect(link?.getAttribute("href")).toBe(url);
      expect(link?.target).toBe("_blank");
      expect(link?.rel.split(" ")).toEqual(
        expect.arrayContaining(["noopener", "noreferrer"])
      );
      const renderedText = container.textContent || "";

      expect(renderedText).toContain("DIRECT · NOT ANONYMOUS");
      expect(renderedText).toContain("network address");
      expect(container.querySelector("iframe")).toBeNull();
    }
  );

  it("keeps the Liberty demo available without sending OS files to a proxy", () => {
    act(() => root.render(<LibertyOffice id="office" />));
    const link = [...container.querySelectorAll("a")].find(
      (element) => element.textContent === "Try the demo"
    );

    expect(link?.getAttribute("href")).toBe(
      "https://office.securityops.co/demo"
    );
    expect(link?.rel.split(" ")).toEqual(
      expect.arrayContaining(["noopener", "noreferrer"])
    );
    expect(container.querySelector("input[type=file]")).toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("defaults to English and changes only the selected app window to Portuguese", () => {
    act(() =>
      root.render(
        <>
          <LibertyOffice id="office" />
          <CrowStudio id="crow" />
        </>
      )
    );
    const selectors = container.querySelectorAll("select");

    expect(selectors).toHaveLength(2);
    expect(
      [...container.querySelectorAll("a")].map((link) => link.textContent)
    ).toEqual(
      expect.arrayContaining(["Open Liberty Office", "Open Crow Studio"])
    );
    act(() => {
      selectors[0].value = "pt-BR";
      selectors[0].dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(
      [...container.querySelectorAll("a")].map((link) => link.textContent)
    ).toEqual(
      expect.arrayContaining(["Abrir Liberty Office", "Open Crow Studio"])
    );
    const translatedText = container.textContent || "";

    expect(translatedText).toContain("DIRETO · NÃO ANÔNIMO");
    expect(selectors[1].value).toBe("en");
    expect(
      container.querySelector('a[href="https://office.securityops.co/"]')
    ).not.toBeNull();
  });
});
