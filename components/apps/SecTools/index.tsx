import StyledSecTools from "components/apps/SecTools/StyledSecTools";
import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

type ToolEntry = {
  Component: React.ComponentType;
  group: string;
  key: string;
  title: string;
};

// Each tool is a self-contained, fully-offline component under ./tools, lazily
// loaded so the suite stays light until a tool is opened.
const TOOLS: ToolEntry[] = [
  {
    Component: dynamic(() => import("components/apps/SecTools/tools/HashHmac")),
    group: "Crypto",
    key: "HashHmac",
    title: "Hash & HMAC",
  },
  {
    Component: dynamic(
      () => import("components/apps/SecTools/tools/EncoderDecoder")
    ),
    group: "Encoding",
    key: "EncoderDecoder",
    title: "Encoder / Decoder",
  },
  {
    Component: dynamic(
      () => import("components/apps/SecTools/tools/JwtDecoder")
    ),
    group: "Crypto",
    key: "JwtDecoder",
    title: "JWT Decoder",
  },
  {
    Component: dynamic(
      () => import("components/apps/SecTools/tools/PasswordEntropy")
    ),
    group: "Crypto",
    key: "PasswordEntropy",
    title: "Password & Entropy",
  },
  {
    Component: dynamic(
      () => import("components/apps/SecTools/tools/RegexTester")
    ),
    group: "Text",
    key: "RegexTester",
    title: "Regex Tester",
  },
  {
    Component: dynamic(
      () => import("components/apps/SecTools/tools/UuidRandom")
    ),
    group: "Crypto",
    key: "UuidRandom",
    title: "UUID & Random",
  },
  {
    Component: dynamic(
      () => import("components/apps/SecTools/tools/CidrCalculator")
    ),
    group: "Network",
    key: "CidrCalculator",
    title: "CIDR / Subnet",
  },
  {
    Component: dynamic(
      () => import("components/apps/SecTools/tools/CipherPlayground")
    ),
    group: "Text",
    key: "CipherPlayground",
    title: "Cipher Playground",
  },
  {
    Component: dynamic(
      () => import("components/apps/SecTools/tools/HashIdentifier")
    ),
    group: "Crypto",
    key: "HashIdentifier",
    title: "Hash Identifier",
  },
  {
    Component: dynamic(
      () => import("components/apps/SecTools/tools/TimestampConverter")
    ),
    group: "Text",
    key: "TimestampConverter",
    title: "Timestamp Converter",
  },
];

const GROUP_ORDER = ["Crypto", "Encoding", "Text", "Network"];

const SecTools: FC<ComponentProcessProps> = () => {
  const [activeKey, setActiveKey] = useState<string>(TOOLS[0].key);
  const ActiveTool = useMemo(
    () => (TOOLS.find((tool) => tool.key === activeKey) ?? TOOLS[0]).Component,
    [activeKey]
  );

  return (
    <StyledSecTools>
      <nav>
        {GROUP_ORDER.map((group) => {
          const groupTools = TOOLS.filter((tool) => tool.group === group);

          return groupTools.length === 0 ? null : (
            <div key={group}>
              <div className="group-label">{group}</div>
              {groupTools.map((tool) => (
                <button
                  key={tool.key}
                  className={tool.key === activeKey ? "active" : undefined}
                  onClick={() => setActiveKey(tool.key)}
                  type="button"
                >
                  {tool.title}
                </button>
              ))}
            </div>
          );
        })}
      </nav>
      <section>
        <ActiveTool />
      </section>
    </StyledSecTools>
  );
};

export default SecTools;
