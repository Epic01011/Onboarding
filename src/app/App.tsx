import { RouterProvider } from 'react-router';
import { router } from './routes';
import { Toaster } from './components/ui/sonner';
import { AuthProvider } from './context/AuthContext';
import { CabinetProvider } from './context/CabinetContext';
import { ServicesProvider } from './context/ServicesContext';
import { DossiersInitializer } from './context/DossiersContext';
import { MicrosoftAuthProvider } from './context/MicrosoftAuthContext';
import { SharePointProvider } from './context/SharePointContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { EmailDraftProvider } from '../components/ai-assistant/useEmailDraftStore';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <MicrosoftAuthProvider>
          <SharePointProvider>
            <CabinetProvider>
              <ServicesProvider>
                <EmailDraftProvider initialDrafts={[]}>
                  <DossiersInitializer />
                  <RouterProvider router={router} />
                  <Toaster />
                </EmailDraftProvider>
              </ServicesProvider>
            </CabinetProvider>
          </SharePointProvider>
        </MicrosoftAuthProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
