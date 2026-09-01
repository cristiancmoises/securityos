import { act, type ReactNode } from "react";
import useProxyCapability from "utils/useProxyCapability";

const { createRoot } = jest.requireActual<{
  createRoot: (container: DocumentFragment | Element) => {
    render: (children: ReactNode) => void;
    unmount: () => void;
  };
}>("react-dom/client");

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const capabilityResponse = (token: string): Response =>
  ({
    json: () =>
      Promise.resolve({ capability: token, expiresIn: 43_200, route: "tor" }),
    ok: true,
  } as Response);

describe("useProxyCapability", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("never exposes the previous isolation scope while authorizing a new one", async () => {
    const firstIso = "c".repeat(32);
    const secondIso = "d".repeat(32);
    const firstToken = "first-capability-".padEnd(48, "a");
    const secondToken = "second-capability-".padEnd(48, "b");
    let resolveSecond: ((response: Response) => void) | undefined;
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(capabilityResponse(firstToken))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveSecond = resolve;
          })
      );

    globalThis.fetch = fetchMock as typeof fetch;

    const container = document.createElement("div");
    const root = createRoot(container);
    const observed: Array<{ capability: string; iso: string }> = [];

    const StateReader = ({ iso }: { iso: string }): undefined => {
      const { capability } = useProxyCapability("tor", "wiki", iso);

      observed.push({ capability, iso });

      return undefined;
    };

    act(() => root.render(<StateReader iso={firstIso} />));
    await act(async () => {
      await Promise.resolve();
    });
    expect(observed.at(-1)).toEqual({ capability: firstToken, iso: firstIso });

    observed.length = 0;
    act(() => root.render(<StateReader iso={secondIso} />));

    expect(observed).not.toContainEqual({
      capability: firstToken,
      iso: secondIso,
    });
    expect(observed.at(-1)).toEqual({ capability: "", iso: secondIso });

    await act(async () => {
      resolveSecond?.(capabilityResponse(secondToken));
      await Promise.resolve();
    });
    expect(observed.at(-1)).toEqual({
      capability: secondToken,
      iso: secondIso,
    });

    act(() => root.unmount());
  });
});
