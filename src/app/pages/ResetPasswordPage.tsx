import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Lock, ArrowRight, Loader2, AlertCircle, CheckCircle2, Zap, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../utils/supabaseClient';

const MIN_PASSWORD_LENGTH = 6;

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // Supabase embeds the access_token in the URL fragment (#) when the user
  // clicks the reset link. detectSessionInUrl:true (set in supabaseClient.ts)
  // picks it up automatically; we wait for the PASSWORD_RECOVERY or SIGNED_IN event.
  useEffect(() => {
    // Check if there is already a recovery session active
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSessionReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setSessionReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`);
      return;
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw new Error(updateError.message);
      setDone(true);
      toast.success('Mot de passe mis à jour avec succès !');
      setTimeout(() => navigate('/auth', { replace: true }), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  // If no recovery token is present in the URL fragment, show a helpful message
  const noToken = !sessionReady && typeof window !== 'undefined' &&
    !window.location.hash.includes('access_token');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
      <main className="w-full max-w-md" aria-label="Réinitialisation du mot de passe">

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
          <h2 className="text-xl font-semibold text-white mb-1">Nouveau mot de passe</h2>
          <p className="text-sm text-slate-400 mb-6">
            Choisissez un mot de passe sécurisé pour votre compte.
          </p>

          {done ? (
            <div className="text-center py-4" role="status" aria-live="polite">
              <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" aria-hidden="true" />
              <p className="text-white font-medium mb-2">Mot de passe mis à jour !</p>
              <p className="text-sm text-slate-400 mb-2">
                Vous allez être redirigé automatiquement vers la page de connexion…
              </p>
            </div>
          ) : noToken ? (
            <div className="text-center py-4">
              <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" aria-hidden="true" />
              <p className="text-white font-medium mb-2">Lien invalide ou expiré</p>
              <p className="text-sm text-slate-400 mb-6">
                Ce lien de réinitialisation n'est plus valide. Veuillez faire une nouvelle demande.
              </p>
              <button
                onClick={() => navigate('/forgot-password')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                <span>Demander un nouveau lien</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <>
              {error && (
                <div role="alert" aria-live="polite" className="mb-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-xs text-red-300">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div>
                  <label htmlFor="reset-password" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Nouveau mot de passe
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
                    <input
                      id="reset-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={MIN_PASSWORD_LENGTH}
                      autoComplete="new-password"
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => !p)}
                      aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">Minimum {MIN_PASSWORD_LENGTH} caractères</p>
                </div>

                <div>
                  <label htmlFor="reset-confirm" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Confirmer le mot de passe
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
                    <input
                      id="reset-confirm"
                      type={showPassword ? 'text' : 'password'}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={MIN_PASSWORD_LENGTH}
                      autoComplete="new-password"
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-all mt-2"
                >
                  {isSubmitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /><span>Mise à jour en cours...</span></>
                  ) : (
                    <><span>Enregistrer le nouveau mot de passe</span><ArrowRight className="w-4 h-4" aria-hidden="true" /></>
                  )}
                </button>
              </form>
            </>
          )}
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
