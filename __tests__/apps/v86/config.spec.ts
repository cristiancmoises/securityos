import { RELAY_PRESETS } from "components/apps/V86/config";
import { DEFAULT_EMULATOR_RELAY_URL } from "utils/constants";

describe("v86 relay defaults", () => {
  it("selects the local Tor relay instead of the public clearnet relay", () => {
    expect(DEFAULT_EMULATOR_RELAY_URL).toBe(RELAY_PRESETS.tor);
    expect(DEFAULT_EMULATOR_RELAY_URL).not.toBe(RELAY_PRESETS.clearnet);
  });
});
