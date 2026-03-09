import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Mail, ArrowLeft, ArrowRight, Loader2, AlertCircle, CheckCircle2, Zap, Lock } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const { error: supabaseError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (supabaseError) throw new Error(supabaseError.message);
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
      <main className="w-full max-w-md" aria-label="Récupération de mot de passe">

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
          <h2 className="text-xl font-semibold text-white mb-1">Mot de passe oublié</h2>
          <p className="text-sm text-slate-400 mb-6">
            Entrez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
          </p>

          {sent ? (
            <div className="text-center py-4" role="status" aria-live="polite">
              <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" aria-hidden="true" />
              <p className="text-white font-medium mb-2">Email envoyé !</p>
              <p className="text-sm text-slate-400 mb-6">
                Vérifiez votre boîte mail ({email}) et cliquez sur le lien de réinitialisation.
                Le lien est valable 1 heure.
              </p>
              <button
                onClick={() => navigate('/auth')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                Retour à la connexion
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
                  <label htmlFor="forgot-email" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Adresse email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
                    <input
                      id="forgot-email"
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

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
                >
                  {isSubmitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /><span>Envoi en cours...</span></>
                  ) : (
                    <><span>Envoyer le lien de réinitialisation</span><ArrowRight className="w-4 h-4" aria-hidden="true" /></>
                  )}
                </button>
              </form>

              <div className="mt-5 pt-5 border-t border-slate-700">
                <p className="text-xs text-slate-400 text-center">
                  <button
                    onClick={() => navigate('/auth')}
                    className="text-blue-400 hover:text-blue-300 font-medium hover:underline underline-offset-2 inline-flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3 h-3" aria-hidden="true" />
                    Retour à la connexion
                  </button>
                </p>
              </div>
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
