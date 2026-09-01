import type { ComponentProcessProps } from "components/system/Apps/RenderComponent";
import type { FC } from "react";
import { useState } from "react";
import styled from "styled-components";
import { IFRAME_CONFIG } from "utils/constants";

const GODS_EYE_URL = "https://eye.securityops.co/";

const StyledGodsEye = styled.div`
  background: #05070b;
  display: flex;
  flex-direction: column;
  height: 100%;

  nav {
    align-items: center;
    background: #10151d;
    border-bottom: 1px solid rgba(117, 213, 154, 28%);
    color: #dce8e2;
    display: flex;
    flex: 0 0 36px;
    font-family: ${({ theme }) => theme.formats.systemFont};
    font-size: 12px;
    gap: 8px;
    padding: 0 10px;
  }

  nav .title {
    flex: 1;
  }

  nav .badge {
    border: 1px solid #e1a85c;
    border-radius: 999px;
    color: #f0bd78;
    font-size: 10px;
    padding: 2px 8px;
  }

  button {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 24%);
    border-radius: 5px;
    color: inherit;
    padding: 4px 9px;
  }

  iframe {
    border: 0;
    flex: 1;
    min-height: 0;
    width: 100%;
  }
`;

// GODS EYE is a large Vite/Cesium application. A rewritten query-URL proxy cannot
// preserve all ESM imports and workers, while the service itself explicitly permits
// framing. A native cross-origin iframe is safer and more compatible: same-origin
// policy isolates it from SecurityOS, and the badge makes direct egress unmistakable.
const GodsEye: FC<ComponentProcessProps> = () => {
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <StyledGodsEye>
      <nav>
        <span className="title">👁 GODS EYE — SecurityOps dashboard</span>
        <span className="badge">DIRECT · NOT ANONYMOUS</span>
        <button onClick={() => setReloadKey((key) => key + 1)} type="button">
          ↻ Reload
        </button>
        <button
          onClick={() =>
            window.open(GODS_EYE_URL, "_blank", "noopener,noreferrer")
          }
          title="Open GODS EYE in a separate window"
          type="button"
        >
          ⧉ Window
        </button>
      </nav>
      <iframe
        key={reloadKey}
        allow="fullscreen"
        src={GODS_EYE_URL}
        title="GODS EYE dashboard"
        {...IFRAME_CONFIG}
      />
    </StyledGodsEye>
  );
};

export default GodsEye;
