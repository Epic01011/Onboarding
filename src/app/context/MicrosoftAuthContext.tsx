/**
 * MicrosoftAuthContext
 *
 * Expose le provider_token de la session Supabase comme token Microsoft Graph.
 * Dès que l'utilisateur se connecte via Microsoft 365 (Azure OAuth dans Supabase),
 * ce contexte récupère automatiquement le token Graph et le profil M365.
 *
 * Usage :
 *   const { graphToken, msUser, isConnected } = useMicrosoftAuth();
 *   await sendEmailViaGraph(graphToken, { to, subject, htmlBody });
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { supabase } from '../utils/supabaseClient';
import { getGraphUser, GraphUser } from '../utils/microsoftGraph';

interface MicrosoftAuthState {
  /** Token Microsoft Graph (provider_token Supabase) */
  graphToken: string | null;
  /** Profil Microsoft 365 de l'utilisateur connecté */
  msUser: GraphUser | null;
  /** Email Microsoft 365 (pour l'envoi de mails Outlook) */
  msEmail: string | null;
  /** Vrai si l'utilisateur est connecté avec un compte Microsoft */
  isConnected: boolean;
  /** Rafraîchit le token depuis la session Supabase */
  refresh: () => Promise<void>;
}

const MicrosoftAuthContext = createContext<MicrosoftAuthState | null>(null);

export function MicrosoftAuthProvider({ children }: { children: ReactNode }) {
  const [graphToken, setGraphToken] = useState<string | null>(null);
  const [msUser, setMsUser] = useState<GraphUser | null>(null);
  const [msEmail, setMsEmail] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.provider_token ?? null;

      // Le provider_token est présent seulement pour les connexions OAuth
      // et uniquement si le provider est 'azure'
      const isAzure = session?.user?.app_metadata?.provider === 'azure';

      if (token && isAzure) {
        setGraphToken(token);
        try {
          const profile = await getGraphUser(token);
          setMsUser(profile);
          setMsEmail(profile.mail || profile.userPrincipalName || null);
        } catch (err) {
          console.warn('[MicrosoftAuth] Graph /me error:', err);
          setMsUser(null);
          setMsEmail(null);
        }
      } else {
        setGraphToken(null);
        setMsUser(null);
        setMsEmail(null);
      }
    } catch (err) {
      console.warn('[MicrosoftAuth] refresh error:', err);
    }
  }, []);

  useEffect(() => {
    refresh();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });
    return () => subscription.unsubscribe();
  }, [refresh]);

  return (
    <MicrosoftAuthContext.Provider
      value={{
        graphToken,
        msUser,
        msEmail,
        isConnected: !!graphToken,
        refresh,
      }}
    >
      {children}
    </MicrosoftAuthContext.Provider>
  );
}

export function useMicrosoftAuth(): MicrosoftAuthState {
  const ctx = useContext(MicrosoftAuthContext);
  if (!ctx) throw new Error('useMicrosoftAuth must be used within MicrosoftAuthProvider');
  return ctx;
}
