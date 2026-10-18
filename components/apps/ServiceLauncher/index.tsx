import { type FC, useId, useState } from "react";
import styled from "styled-components";

const SERVICES = {
  callofroque: {
    en: "Play the browser-based tactical FPS. WebGPU or WebGL 2 is required.",
    icon: "emulator",
    name: "Call of Roque",
    pt: "Jogue o FPS tático no navegador. É necessário WebGPU ou WebGL 2.",
    url: "https://callofroque.roqueos.com/en/",
  },
  crow: {
    en: "Open the complete Crow Studio workspace in its native browser client.",
    icon: "executable",
    name: "Crow Studio",
    pt: "Abra o espaço de trabalho completo do Crow Studio no cliente original.",
    url: "https://crow.securityops.co/",
  },
  deeper: {
    en: "Use Deeper directly, with the service's own account and browser features.",
    icon: "securityops",
    name: "Deeper",
    pt: "Use o Deeper diretamente, com os recursos e a conta do próprio serviço.",
    url: "https://deeper.securityops.co/",
  },
  office: {
    demo: "https://office.securityops.co/demo",
    en: "Documents, spreadsheets and creative tools in your own office workspace.",
    icon: "wiki",
    name: "Liberty Office",
    pt: "Documentos, planilhas e ferramentas criativas no seu espaço de trabalho.",
    url: "https://office.securityops.co/",
  },
} as const;

const COPY = {
  en: {
    badge: "DIRECT · NOT ANONYMOUS",
    demo: "Try the demo",
    demoNote:
      "The Liberty demo keeps documents in your browser only. Export your work before finishing or clearing the demo.",
    hint: "If nothing opens, allow the browser to open the link, or copy its address. You can keep this app window open on the desktop.",
    open: "Open",
    privacy:
      "The full client opens in a separate browser window or tab. SecurityOS does not proxy its files, passwords or sessions. The service's own privacy and storage rules apply.",
    route:
      "Your browser connects directly to this service. Your network address is visible to it; this is not a Tor connection.",
  },
  "pt-BR": {
    badge: "DIRETO · NÃO ANÔNIMO",
    demo: "Experimentar a demo",
    demoNote:
      "A demo do Liberty mantém os documentos apenas no navegador. Exporte seu trabalho antes de finalizar ou limpar a demo.",
    hint: "Se nada abrir, permita que o navegador abra o link ou copie o endereço. Você pode manter a janela deste app aberta na área de trabalho.",
    open: "Abrir",
    privacy:
      "O cliente completo abre em outra janela ou aba do navegador. O SecurityOS não intermedeia arquivos, senhas ou sessões. Valem as regras de privacidade e armazenamento do próprio serviço.",
    route:
      "O navegador conecta diretamente ao serviço, que pode ver seu endereço de rede. Esta conexão não passa pelo Tor.",
  },
};

const StyledLauncher = styled.div`
  background: #101720;
  color: #edf3fa;
  height: 100%;
  overflow-y: auto;
  padding: 16px;

  .toolbar,
  .identity,
  .actions {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .toolbar {
    justify-content: space-between;
  }
  .badge {
    color: #bcd6f6;
    font-size: 11px;
    font-weight: 700;
  }
  label {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    font-size: 12px;
    gap: 8px;
    max-width: 100%;
  }
  select {
    background: #1b293b;
    border: 1px solid #6480a3;
    color: inherit;
    max-width: 100%;
    min-height: 44px;
    padding: 4px;
  }
  section {
    margin: 24px auto 0;
    max-width: 600px;
  }
  h2 {
    font-size: 24px;
    line-height: 1.25;
    margin: 0;
  }
  p {
    font-size: 14px;
    line-height: 1.6;
    margin: 16px 0;
  }
  .domain {
    color: #b7c8dc;
    font-size: 12px;
    margin: 4px 0 0;
    overflow-wrap: anywhere;
  }
  .identity > div {
    flex: 1;
    min-width: 0;
  }
  .route {
    background: #1b293b;
    border-left: 3px solid #81b9ff;
    padding: 12px;
  }
  .actions a {
    border: 1px solid #85bcff;
    border-radius: 4px;
    color: #e6f2ff;
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 8px 16px;
    text-decoration: none;
  }
  .actions .primary {
    background: #204d7d;
  }
  a:hover {
    background: #306194;
  }
  a:focus-visible,
  select:focus-visible {
    outline: 2px solid #a9d4ff;
    outline-offset: 3px;
  }
  .hint {
    color: #b7c8dc;
    font-size: 12px;
  }
`;

const ServiceLauncher: FC<{ service: keyof typeof SERVICES }> = ({
  service,
}) => {
  const app = SERVICES[service];
  const [language, setLanguage] = useState<keyof typeof COPY>("en");
  const copy = COPY[language];
  const title = useId();

  return (
    <StyledLauncher lang={language}>
      <div className="toolbar">
        <span className="badge">{copy.badge}</span>
        <label>
          Language / Idioma
          <select
            onChange={({ currentTarget }) =>
              setLanguage(currentTarget.value === "pt-BR" ? "pt-BR" : "en")
            }
            value={language}
          >
            <option value="en">English</option>
            <option value="pt-BR">Português (Brasil)</option>
          </select>
        </label>
      </div>
      <section aria-labelledby={title}>
        <div className="identity">
          <img
            alt=""
            height={48}
            src={`/System/Icons/96x96/${app.icon}.webp`}
            width={48}
          />
          <div>
            <h2 id={title}>{app.name}</h2>
            <p className="domain">{new URL(app.url).hostname}</p>
          </div>
        </div>
        <p>{language === "en" ? app.en : app.pt}</p>
        <p className="route">{copy.route}</p>
        <div className="actions">
          <a
            className="primary"
            href={app.url}
            referrerPolicy="no-referrer"
            rel="noopener noreferrer"
            target="_blank"
          >
            {copy.open} {app.name}
          </a>
          {"demo" in app && (
            <a
              href={app.demo}
              referrerPolicy="no-referrer"
              rel="noopener noreferrer"
              target="_blank"
            >
              {copy.demo}
            </a>
          )}
        </div>
        <p>{copy.privacy}</p>
        {"demo" in app && <p className="hint">{copy.demoNote}</p>}
        <p className="hint">{copy.hint}</p>
      </section>
    </StyledLauncher>
  );
};

export default ServiceLauncher;
