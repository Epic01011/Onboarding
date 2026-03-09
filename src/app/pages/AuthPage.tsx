import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router';
import { Lock, Mail, User as UserIcon, ArrowRight, Loader2, AlertCircle, Zap, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../utils/supabaseClient';

// Icône Microsoft — accessible
function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 21 21" className={className} role="img" aria-label="Microsoft">
      <title>Microsoft</title>
      <rect x="0" y="0" width="10" height="10" fill="#F25022" />
      <rect x="11" y="0" width="10" height="10" fill="#7FBA00" />
      <rect x="0" y="11" width="10" height="10" fill="#00A4EF" />
      <rect x="11" y="11" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}

// Icône Google — accessible
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-label="Google">
      <title>Google</title>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

// Icône GitHub — accessible
function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} role="img" aria-label="GitHub">
      <title>GitHub</title>
      <path d="M12 0C5.37 0 0 5.373 0 12c0 5.303 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577
        0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756
        -1.089-.745.083-.729.083-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305
        3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93
        0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23
        .96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23
        3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22
        0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22
        0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.298 24 12
        24 5.373 18.627 0 12 0z" />
    </svg>
  );
}

export function AuthPage() {
  const { signIn, signUp, signInWithGoogle, signInWithGitHub, loading, user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const [msLoading, setMsLoading] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate('/', { replace: true });
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
        toast.success('Connexion réussie !');
        navigate('/');
      } else {
        await signUp(email, password, name);
        toast.success('Compte créé avec succès !');
        navigate('/');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Une erreur est survenue';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Connexion Microsoft 365 via Supabase Azure OAuth.
   * Après authentification, la session Supabase contiendra :
   *   - session.provider_token  → token Microsoft Graph (SharePoint + Outlook)
   *   - session.user.email      → adresse Microsoft 365
   *
   * Prérequis :
   *   Supabase → Auth → Providers → Azure (activer + Azure App Registration)
   */
  const handleMicrosoft = async () => {
    setError('');
    setMsLoading(true);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          scopes: [
            'openid',
            'profile',
            'email',
            'offline_access',
            'User.Read',
            'Mail.Send',
            'Mail.ReadWrite',
            'Sites.ReadWrite.All',
            'Files.ReadWrite.All',
          ].join(' '),
          redirectTo: `${window.location.origin}/auth`,
        },
      });
      if (oauthError) throw oauthError;
      // La page sera redirigée vers Microsoft puis revenue ici automatiquement
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur connexion Microsoft 365';
      setError(msg);
      toast.error(msg);
      setMsLoading(false);
    }
  };

  const handleGitHub = async () => {
    setError('');
    setGithubLoading(true);
    try {
      await signInWithGitHub();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur GitHub OAuth';
      setError(msg);
      toast.error(msg);
      setGithubLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      // Supabase returns error_code "validation_failed" when Google OAuth is not
      // enabled in the Supabase project. Show a user-friendly French message.
      const isProviderDisabled =
        (err instanceof Error && 'code' in err && err.code === 'validation_failed') ||
        (err instanceof Error && err.message.toLowerCase().includes('provider is not enabled'));
      const msg = isProviderDisabled
        ? 'La connexion Google n\'est pas encore activée sur ce serveur. Veuillez utiliser Microsoft 365 ou un email.'
        : (err instanceof Error ? err.message : 'Erreur Google OAuth');
      setError(msg);
      toast.error(msg);
      setGoogleLoading(false);
    }
  };

  const isBusy = isSubmitting || msLoading || googleLoading || githubLoading;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
      <main className="w-full max-w-md" aria-label="Authentification CabinetFlow">

        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-600/30"
            aria-hidden="true"
          >
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">CabinetFlow</h1>
          <p className="text-slate-300 text-sm">Onboarding automatisé pour cabinets comptables</p>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-2xl">

          {/* ── Bouton Microsoft 365 (principal) ─────────────────────────────── */}
          <button
            onClick={handleMicrosoft}
            disabled={isBusy}
            aria-label={msLoading ? 'Redirection vers Microsoft en cours' : 'Continuer avec Microsoft 365'}
            className="w-full flex items-center justify-center gap-3 bg-[#0078d4] hover:bg-[#106ebe] disabled:opacity-60 disabled:cursor-not-allowed text-white py-3.5 rounded-xl text-sm font-semibold transition-all mb-3 shadow-lg shadow-blue-900/30"
          >
            {msLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
            ) : (
              <MicrosoftIcon className="w-5 h-5" />
            )}
            <span>{msLoading ? 'Redirection vers Microsoft...' : 'Continuer avec Microsoft 365'}</span>
          </button>

          {/* Badge scopes Microsoft */}
          {!msLoading && (
            <div className="flex items-center gap-2 mb-4 px-1">
              <Building2 className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" aria-hidden="true" />
              <p className="text-xs text-slate-400">
                SharePoint · Outlook Mail · Microsoft 365
              </p>
            </div>
          )}

          {/* ── Bouton Google (juste en dessous de Microsoft) ─────────────────── */}
          <button
            onClick={handleGoogle}
            disabled={isBusy}
            aria-label={googleLoading ? 'Redirection vers Google en cours' : 'Continuer avec Google'}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed text-gray-700 border border-gray-300 py-3 rounded-xl text-sm font-semibold transition-all mb-4 shadow-sm"
          >
            {googleLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-gray-500" aria-hidden="true" />
            ) : (
              <GoogleIcon className="w-5 h-5" />
            )}
            <span>{googleLoading ? 'Redirection vers Google...' : 'Continuer avec Google'}</span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4" role="separator" aria-hidden="true">
            <div className="flex-1 h-px bg-slate-700" />
            <span className="text-xs text-slate-400">autres options</span>
            <div className="flex-1 h-px bg-slate-700" />
          </div>

          {/* ── Bouton GitHub ─────────────────────────────────────────────────── */}
          <div className="mb-5">
            <button
              onClick={handleGitHub}
              disabled={isBusy}
              aria-label={githubLoading ? 'Redirection vers GitHub en cours' : 'Continuer avec GitHub'}
              className="w-full flex items-center justify-center gap-3 bg-[#24292f] hover:bg-[#2d333b] disabled:opacity-60 disabled:cursor-not-allowed border border-slate-600 text-white py-3 rounded-xl text-sm font-semibold transition-all"
            >
              {githubLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
              ) : (
                <GitHubIcon className="w-5 h-5" />
              )}
              <span>{githubLoading ? 'Redirection vers GitHub...' : 'Continuer avec GitHub'}</span>
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5" role="separator" aria-hidden="true">
            <div className="flex-1 h-px bg-slate-700" />
            <span className="text-xs text-slate-400">ou avec un email</span>
            <div className="flex-1 h-px bg-slate-700" />
          </div>

          {/* ── Onglets Connexion / Création ──────────────────────────────────── */}
          <div className="flex gap-2 bg-slate-900 p-1 rounded-lg mb-5" role="tablist" aria-label="Mode d'authentification">
            <button
              role="tab"
              aria-selected={mode === 'signin'}
              onClick={() => setMode('signin')}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                mode === 'signin' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-300 hover:text-white'
              }`}
            >
              Connexion
            </button>
            <button
              role="tab"
              aria-selected={mode === 'signup'}
              onClick={() => setMode('signup')}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                mode === 'signup' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-300 hover:text-white'
              }`}
            >
              Créer un compte
            </button>
          </div>

          {/* Erreur */}
          {error && (
            <div role="alert" aria-live="polite" className="mb-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          {/* ── Formulaire email / mot de passe ────────────────────────────────── */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {mode === 'signup' && (
              <div>
                <label htmlFor="auth-name" className="block text-xs font-medium text-slate-300 mb-1.5">Nom complet</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
                  <input
                    id="auth-name"
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Jean Dupont"
                    autoComplete="name"
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-xs font-medium text-slate-300 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="contact@cabinet.fr"
                  required
                  autoComplete="email"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="auth-password" className="block text-xs font-medium text-slate-300">Mot de passe</label>
                {mode === 'signin' && (
                  <Link
                    to="/forgot-password"
                    className="text-xs text-blue-400 hover:text-blue-300 hover:underline underline-offset-2 transition-colors"
                  >
                    Mot de passe oublié ?
                  </Link>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
                <input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
              {mode === 'signup' && (
                <p className="text-xs text-slate-400 mt-1.5">Minimum 6 caractères</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isBusy}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-all mt-2"
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /><span>Chargement...</span></>
              ) : (
                <><span>{mode === 'signin' ? 'Se connecter' : 'Créer mon compte'}</span><ArrowRight className="w-4 h-4" aria-hidden="true" /></>
              )}
            </button>
          </form>

          {/* Switch mode */}
          <div className="mt-5 pt-5 border-t border-slate-700">
            <p className="text-xs text-slate-400 text-center">
              {mode === 'signin' ? (
                <>Pas encore de compte ?{' '}
                  <button onClick={() => setMode('signup')} className="text-blue-400 hover:text-blue-300 font-medium hover:underline underline-offset-2">Créer un compte</button>
                </>
              ) : (
                <>Déjà inscrit ?{' '}
                  <button onClick={() => setMode('signin')} className="text-blue-400 hover:text-blue-300 font-medium hover:underline underline-offset-2">Se connecter</button>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Security footer */}
        <div className="mt-4 text-center">
          <p className="text-xs text-slate-500">
            <Lock className="w-3 h-3 inline-block mr-1" aria-hidden="true" />
            Données chiffrées · JWT ES256 · Supabase Auth
          </p>
        </div>

      </main>
    </div>
  );
}
