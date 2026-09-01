import {
  CAPABILITY_TTL_SECONDS,
  issueProxyCapability,
  verifyProxyCapability,
} from "utils/proxyCapability";

describe("proxy route capabilities", () => {
  const now = Date.UTC(2026, 8, 1, 12, 0, 0);
  const constraints = {
    iso: "a".repeat(32),
    profile: "wiki" as const,
    scriptPolicy: "all" as const,
  };

  it("binds a signed token to exactly one route", () => {
    const tor = issueProxyCapability("tor", constraints, now);
    const direct = issueProxyCapability("direct", constraints, now);

    expect(verifyProxyCapability(tor, "tor", constraints, now)).toBe(true);
    expect(verifyProxyCapability(tor, "direct", constraints, now)).toBe(false);
    expect(verifyProxyCapability(direct, "direct", constraints, now)).toBe(
      true
    );
    expect(verifyProxyCapability(direct, "tor", constraints, now)).toBe(false);
    expect(
      verifyProxyCapability(
        tor,
        "tor",
        {
          ...constraints,
          profile: "godseye",
        },
        now
      )
    ).toBe(false);
    expect(
      verifyProxyCapability(
        tor,
        "tor",
        {
          ...constraints,
          iso: "b".repeat(32),
        },
        now
      )
    ).toBe(false);
    expect(
      verifyProxyCapability(
        tor,
        "tor",
        {
          ...constraints,
          scriptPolicy: "off",
        },
        now
      )
    ).toBe(false);
  });

  it("rejects tampering and expired tokens", () => {
    const token = issueProxyCapability("tor", constraints, now);
    const tampered = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;

    expect(verifyProxyCapability(tampered, "tor", constraints, now)).toBe(
      false
    );
    expect(
      verifyProxyCapability(
        token,
        "tor",
        constraints,
        now + (CAPABILITY_TTL_SECONDS + 31) * 1000
      )
    ).toBe(false);
  });

  it("rejects malformed input without throwing", () => {
    expect(verifyProxyCapability(undefined, "tor", constraints, now)).toBe(
      false
    );
    expect(verifyProxyCapability("not-a-token", "tor", constraints, now)).toBe(
      false
    );
  });
});
