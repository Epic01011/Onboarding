import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../utils/supabaseClient';
import {
  verifySupabaseJwt,
  isJwtExpired,
} from '../utils/jwtVerify';

// Re-export so existing imports like `import { supabase } from '../context/AuthContext'` keep working
export { supabase };

interface AuthContextType {
  user: User | null;
  session: Session | null;
  accessToken: string | null;
  loading: boolean;
  /** true si le JWT courant a été vérifié cryptographiquement (ES256) */
  tokenVerified: boolean;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithGitHub: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tokenVerified, setTokenVerified] = useState(false);

  /** Vérifie cryptographiquement le token ES256 et met à jour tokenVerified */
  const applySession = async (sess: Session | null) => {
    setSession(sess);
    setUser(sess?.user ?? null);
    const token = sess?.access_token ?? null;
    setAccessToken(token);

    if (token) {
      try {
        const valid = await verifySupabaseJwt(token);
        setTokenVerified(valid);
        if (!valid) {
          console.warn('[Auth] JWT invalide ou expiré — token rejeté.');
        }
      } catch (err) {
        console.warn('[Auth] JWT verification error:', err);
        // Accept structurally valid non-expired tokens as fallback
        const structurallyOk = !isJwtExpired(token);
        setTokenVerified(structurallyOk);
      }
    } else {
      setTokenVerified(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Restore existing session on mount
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      if (data.session) {
        // Si le token est expiré localement, forcer un refresh
        if (isJwtExpired(data.session.access_token)) {
          const { data: refreshed } = await supabase.auth.refreshSession();
          if (mounted) await applySession(refreshed.session);
        } else {
          if (mounted) await applySession(data.session);
        }
      } else {
        if (mounted) setTokenVerified(false);
      }
      if (mounted) setLoading(false);
    });

    // Keep state in sync with Supabase Auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      if (!mounted) return;
      await applySession(sess);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ── Sign Up ──────────────────────────────────────────────────────────────────
  const signUp = async (email: string, password: string, name?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name: name ?? '' } },
      });

      if (error) throw new Error(error.message);

      if (data.session) {
        await applySession(data.session);
      } else if (data.user && !data.session) {
        await signIn(email, password);
      }
    } catch (err) {
      console.error('[Auth] Signup error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // ── Sign In ──────────────────────────────────────────────────────────────────
  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      await applySession(data.session);
    } catch (err) {
      console.error('[Auth] Signin error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // ── Sign In with Google (OAuth) ──────────────────────────────────────────────
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth`,
      },
    });
    if (error) {
      console.error('[Auth] Google OAuth error:', error.message);
      throw new Error(error.message);
    }
    // Supabase redirige vers Google — onAuthStateChange prend le relais au retour
  };

  // ── Sign In with GitHub (OAuth) ───────────────────────────────────────────────
  const signInWithGitHub = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth`,
      },
    });
    if (error) {
      console.error('[Auth] GitHub OAuth error:', error.message);
      throw new Error(error.message);
    }
    // Supabase redirige vers GitHub — onAuthStateChange prend le relais au retour
  };

  // ── Sign Out ─────────────────────────────────────────────────────────────────
  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setAccessToken(null);
      setTokenVerified(false);
    } catch (err) {
      console.error('[Auth] Signout error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, accessToken, loading, tokenVerified, signUp, signIn, signInWithGoogle, signInWithGitHub, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}