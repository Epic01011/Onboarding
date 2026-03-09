import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Users, ArrowLeft, ArrowRight, Clock } from 'lucide-react';
import { useDossiersContext } from '@/app/context/DossiersContext';
import { getDossierProgress, formatRelativeTime } from '@/app/utils/dossierUtils';

export function DossiersActifs() {
  const navigate = useNavigate();
  const { dossiers } = useDossiersContext();

  const activeDossiers = useMemo(() =>
    dossiers.filter(d => {
      const p = getDossierProgress(d);
      return p > 0 && p < 1;
    }),
    [dossiers],
  );

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
          <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Dossiers actifs</h1>
            <p className="text-sm text-gray-500">
              {activeDossiers.length === 0
                ? 'Aucun dossier en cours'
                : `${activeDossiers.length} dossier${activeDossiers.length > 1 ? 's' : ''} en cours`}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6 max-w-4xl mx-auto">
        {activeDossiers.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Aucun dossier actif</p>
            <p className="text-sm text-gray-400 mt-1">Créez un nouveau dossier depuis le tableau de bord.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeDossiers.map(dossier => {
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
                  className="w-full text-left bg-white rounded-xl border border-blue-200 bg-blue-50/20 hover:border-blue-400 hover:shadow-md transition-all p-5 group"
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
                          <Clock className="w-3.5 h-3.5 text-blue-400" />
                          Mis à jour {formatRelativeTime(dossier.updatedAt)}
                        </span>
                        <span>{Math.round(progress * 100)}% complété</span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="w-24 flex-shrink-0">
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${Math.round(progress * 100)}%` }}
                        />
                      </div>
                    </div>

                    <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
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
