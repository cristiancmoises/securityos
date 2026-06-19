import { ErrorBoundary } from "components/pages/ErrorBoundary";
import Metadata from "components/pages/Metadata";
import StyledApp from "components/pages/StyledApp";
import { FileSystemProvider } from "contexts/fileSystem";
import { MenuProvider } from "contexts/menu";
import { ProcessProvider } from "contexts/process";
import { SessionProvider } from "contexts/session";
import type { AppProps } from "next/app";

// ErrorBoundary is the OUTERMOST wrapper so a synchronous render-throw from ANY
// provider (process/fileSystem/session — the layers that restore persisted/stale
// state) is caught and shows the RecoveryScreen (with its Reset that wipes
// localStorage/sessionStorage/IndexedDB), instead of bubbling past to the React
// root and unmounting the whole tree to a blank page with no recovery.
const App = ({ Component, pageProps }: AppProps): React.ReactElement => (
  <ErrorBoundary>
    <ProcessProvider>
      <FileSystemProvider>
        <SessionProvider>
          <Metadata />
          <StyledApp>
            <MenuProvider>
              <Component {...pageProps} />
            </MenuProvider>
          </StyledApp>
        </SessionProvider>
      </FileSystemProvider>
    </ProcessProvider>
  </ErrorBoundary>
);

export default App;
