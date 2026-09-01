const FLAG = "NEXT_PUBLIC_ENABLE_CLOUDMACS";
const originalFlag = process.env[FLAG];

const loadFeatureSurface = async (): Promise<{
  CLOUDMACS_ENABLED: boolean;
  CSP_HEADER_VALUE: string;
  TEXT_EDITORS: string[];
  processDirectory: Record<string, unknown>;
}> => {
  const [
    { CLOUDMACS_ENABLED },
    { default: processDirectory },
    { TEXT_EDITORS },
    { CSP_HEADER_VALUE },
  ] = await Promise.all([
    import("utils/featureFlags"),
    import("contexts/process/directory"),
    import("components/system/Files/FileEntry/extensions"),
    import("scripts/securityHeaders.js"),
  ]);

  return {
    CLOUDMACS_ENABLED,
    CSP_HEADER_VALUE,
    TEXT_EDITORS,
    processDirectory,
  };
};

afterEach(() => {
  if (originalFlag === undefined) {
    delete process.env[FLAG];
  } else {
    process.env[FLAG] = originalFlag;
  }
  jest.resetModules();
});

describe("optional Cloudmacs surface", () => {
  it("is absent from the default production feature set", async () => {
    delete process.env[FLAG];
    jest.resetModules();

    const {
      CLOUDMACS_ENABLED,
      CSP_HEADER_VALUE,
      processDirectory,
      TEXT_EDITORS,
    } = await loadFeatureSurface();

    expect(CLOUDMACS_ENABLED).toBe(false);
    expect(processDirectory).not.toHaveProperty("Cloudmacs");
    expect(TEXT_EDITORS).not.toContain("Cloudmacs");
    expect(CSP_HEADER_VALUE).not.toContain("http://localhost:8090");
    expect(CSP_HEADER_VALUE).not.toContain("http://127.0.0.1:8090");
  });

  it("can be restored only by an explicit opt-in build", async () => {
    process.env[FLAG] = "true";
    jest.resetModules();

    const {
      CLOUDMACS_ENABLED,
      CSP_HEADER_VALUE,
      processDirectory,
      TEXT_EDITORS,
    } = await loadFeatureSurface();

    expect(CLOUDMACS_ENABLED).toBe(true);
    expect(processDirectory).toHaveProperty("Cloudmacs");
    expect(TEXT_EDITORS).toContain("Cloudmacs");
    expect(CSP_HEADER_VALUE).toContain("http://localhost:8090");
    expect(CSP_HEADER_VALUE).toContain("http://127.0.0.1:8090");
  });
});
