import type { DocumentContext, DocumentInitialProps } from "next/document";
import NextDocument, { Head, Html, Main, NextScript } from "next/document";
import { CSP_META_CONTENT } from "scripts/securityHeaders";
import { ServerStyleSheet } from "styled-components";
import { DEFAULT_LOCALE } from "utils/constants";

const withStyledComponents = async (
  ctx: DocumentContext
): Promise<DocumentInitialProps> => {
  const { renderPage } = ctx;
  const sheet = new ServerStyleSheet();

  try {
    ctx.renderPage = () =>
      renderPage({
        enhanceApp: (App) => (props) => sheet.collectStyles(<App {...props} />),
      });

    const { styles, ...initialProps } = await NextDocument.getInitialProps(ctx);

    return {
      ...initialProps,
      styles: [styles, sheet.getStyleElement()],
    };
  } finally {
    sheet.seal();
  }
};

class Document extends NextDocument {
  public static async getInitialProps(
    ctx: DocumentContext
  ): Promise<DocumentInitialProps> {
    return withStyledComponents(ctx);
  }

  public render(): JSX.Element {
    return (
      <Html lang={DEFAULT_LOCALE}>
        <Head>
          {/* Fallback for pure `next export` / dumb-CDN hosting where real HTTP
              headers cannot be set. Server/reverse-proxy deployments get the full
              policy (incl. frame-ancestors/HSTS/COOP) from scripts/securityHeaders.js. */}
          <meta content={CSP_META_CONTENT} httpEquiv="Content-Security-Policy" />
          <meta content="no-referrer" name="referrer" />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default Document;
