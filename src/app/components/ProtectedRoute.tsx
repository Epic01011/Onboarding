import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Loader2, ShieldAlert } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  /** Si true, exige aussi que le JWT soit vérifié cryptographiquement (ES256) */
  requireVerified?: boolean;
}

export function ProtectedRoute({ children, requireVerified = false }: ProtectedRouteProps) {
  const { user, loading, tokenVerified } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth', { replace: true });
    }
  }, [user, loading, navigate]);

  // Loading auth state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">Vérification de la session...</p>
          <p className="text-xs text-slate-600 mt-1">Validation JWT ES256 en cours</p>
        </div>
      </div>
    );
  }

  // Not authenticated → null (redirect handled by useEffect)
  if (!user) return null;

  // JWT cryptographically invalid (only if requireVerified=true)
  if (requireVerified && !tokenVerified) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center max-w-sm mx-auto px-6">
          <div className="w-14 h-14 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-7 h-7 text-red-400" />
          </div>
          <h2 className="text-white mb-2">Session invalide</h2>
          <p className="text-sm text-slate-400 mb-5">
            Votre token de session n'a pas pu être vérifié (ES256).
            Veuillez vous reconnecter.
          </p>
          <button
            onClick={() => navigate('/auth')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-all"
          >
            Se reconnecter
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}