import styled from "styled-components";

// Shared styling for the messenger launcher apps (WhatsApp / Telegram / Session).
// Each renders the same branded "launch panel": these clients can't be embedded in
// an iframe (anti-framing headers + WebSockets the Tor proxy blocks), so the app
// opens the OFFICIAL web client in a real top-level window where it is fully
// functional. The per-brand accent comes in as the transient `$accent` prop.
const StyledMessenger = styled.div<{ $accent: string }>`
  align-items: center;
  background: radial-gradient(
      120% 120% at 50% 0%,
      color-mix(in srgb, ${({ $accent }) => $accent} 16%, transparent) 0%,
      transparent 60%
    ),
    #120c18;
  box-sizing: border-box;
  color: #ece6f3;
  display: flex;
  flex-direction: column;
  font-family: ${({ theme }) => theme.formats.systemFont};
  height: 100%;
  justify-content: center;
  overflow: auto;
  padding: 28px 24px;
  text-align: center;
  width: 100%;

  .card {
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: 14px;
    max-width: 440px;
    width: 100%;
  }

  .logo {
    align-items: center;
    background: ${({ $accent }) => $accent};
    border-radius: 22px;
    box-shadow: 0 10px 30px -8px color-mix(in srgb, ${({ $accent }) => $accent}
          70%, #000);
    display: flex;
    height: 84px;
    justify-content: center;
    width: 84px;
  }

  .logo svg {
    height: 48px;
    width: 48px;
  }

  h1 {
    font-size: 24px;
    font-weight: 600;
    letter-spacing: 0.2px;
    margin: 4px 0 0;
  }

  .tagline {
    color: #b9a7cf;
    font-size: 13.5px;
    line-height: 1.5;
    margin: 0;
    max-width: 380px;
  }

  .badge {
    align-items: center;
    background: rgba(255, 176, 32, 12%);
    border: 1px solid rgba(255, 176, 32, 38%);
    border-radius: 999px;
    color: #ffcd6b;
    display: inline-flex;
    font-size: 11.5px;
    font-weight: 500;
    gap: 6px;
    letter-spacing: 0.2px;
    line-height: 1.3;
    padding: 5px 12px;
  }

  .open-btn {
    align-items: center;
    background: ${({ $accent }) => $accent};
    border: 0;
    border-radius: 12px;
    color: #fff;
    cursor: pointer;
    display: inline-flex;
    font-size: 15px;
    font-weight: 600;
    gap: 9px;
    justify-content: center;
    margin-top: 4px;
    min-width: 220px;
    padding: 12px 22px;
    transition: filter 0.15s ease, transform 0.1s ease;
  }

  .open-btn:hover {
    filter: brightness(1.08);
  }

  .open-btn:active {
    transform: translateY(1px);
  }

  .open-btn svg {
    height: 18px;
    width: 18px;
  }

  .status {
    color: #9d89b8;
    font-size: 12px;
    margin: 2px 0 0;
    min-height: 16px;
  }

  .status.live {
    color: #7fdba0;
  }

  .steps {
    background: rgba(255, 255, 255, 4%);
    border: 1px solid rgba(255, 255, 255, 7%);
    border-radius: 12px;
    color: #c8bbd9;
    font-size: 12.5px;
    line-height: 1.65;
    margin: 6px 0 0;
    padding: 14px 18px 14px 34px;
    text-align: left;
    width: 100%;
    /* Restore numbered markers — the global reset (styles/GlobalStyle.ts) sets
       list-style:none on every ul/ol, which would otherwise leave the steps as an
       oddly-indented run of sentences in the 34px gutter reserved for markers. */
    list-style: decimal;
    list-style-position: outside;
  }

  .steps li {
    margin: 2px 0;
  }

  .steps b {
    color: #e7ddf3;
  }

  .tor-note {
    border: 1px solid rgba(127, 219, 160, 22%);
    border-radius: 10px;
    color: #b9a7cf;
    font-size: 12px;
    margin: 4px 0 0;
    max-width: 400px;
    padding: 2px 14px;
    text-align: left;
    width: 100%;
  }

  .tor-note summary {
    color: #7fdba0;
    cursor: pointer;
    font-weight: 600;
    padding: 8px 0;
  }

  .tor-note p {
    color: #c8bbd9;
    line-height: 1.6;
    margin: 0 0 10px;
  }

  .tor-note b {
    color: #e7ddf3;
  }

  .footnote {
    color: #7c7090;
    font-size: 11px;
    line-height: 1.5;
    margin: 8px 0 0;
    max-width: 380px;
  }
`;

export default StyledMessenger;
