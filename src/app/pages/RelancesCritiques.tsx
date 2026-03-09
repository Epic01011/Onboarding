import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Bell, ArrowLeft, ArrowRight, Clock } from 'lucide-react';
import { useDossiersContext } from '@/app/context/DossiersContext';
import { getDossierProgress, formatRelativeTime } from '@/app/utils/dossierUtils';

const CRITICAL_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000;

export function RelancesCritiques() {
  const navigate = useNavigate();
  const { dossiers } = useDossiersContext();

  const criticalDossiers = useMemo(() => {
    const now = Date.now();
    return dossiers.filter(d => {
      if (getDossierProgress(d) >= 1) return false;
      return now - new Date(d.updatedAt).getTime() > CRITICAL_THRESHOLD_MS;
    });
  }, [dossiers]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au tableau de bord
        </button>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center">
            <Bell className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Relances critiques</h1>
            <p className="text-sm text-gray-500">
              {criticalDossiers.length === 0
                ? 'Aucune relance critique'
                : `${criticalDossiers.length} dossier${criticalDossiers.length > 1 ? 's' : ''} sans activité depuis plus de 3 jours`}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6 max-w-4xl mx-auto">
        {criticalDossiers.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Aucune relance critique</p>
            <p className="text-sm text-gray-400 mt-1">Tous vos dossiers ont été traités récemment.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {criticalDossiers.map(dossier => {
              const progress = getDossierProgress(dossier);
              const name =
                dossier.clientData.raisonSociale ||
                dossier.clientData.denominationCreation ||
                dossier.clientData.nom ||
                'Client sans nom';

              return (
                <button
                  key={dossier.id}
                  onClick={() => navigate(`/onboarding/${dossier.id}`)}
                  className="w-full text-left bg-white rounded-xl border border-amber-200 bg-amber-50/30 hover:border-amber-400 hover:shadow-md transition-all p-5 group"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-gray-900 truncate">{name}</p>
                        {dossier.clientData.missionType && (
                          <span className="flex-shrink-0 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600 capitalize">
                            {dossier.clientData.missionType}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          Mis à jour {formatRelativeTime(dossier.updatedAt)}
                        </span>
                        <span>{Math.round(progress * 100)}% complété</span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="w-24 flex-shrink-0">
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-400 rounded-full transition-all"
                          style={{ width: `${Math.round(progress * 100)}%` }}
                        />
                      </div>
                    </div>

                    <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-amber-400 group-hover:translate-x-1 transition-all flex-shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
