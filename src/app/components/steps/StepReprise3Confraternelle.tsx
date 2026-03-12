import { Scale, ExternalLink, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useOnboarding } from '../../context/OnboardingContext';
import { StepShell } from '../StepShell';
import { useNavigate } from 'react-router';

export function StepReprise3Confraternelle() {
  const { clientData, updateClientData, goNext } = useOnboarding();
  const navigate = useNavigate();

  const handleOpenModule = () => {
    updateClientData({ lettreConfrereEnvoyee: true });
    const params = new URLSearchParams();
    if (clientData.raisonSociale) params.set('raisonSociale', clientData.raisonSociale);
    if (clientData.siren) params.set('siren', clientData.siren);
    if (clientData.confrereEmail) params.set('confrereEmail', clientData.confrereEmail);
    navigate(`/lettre-reprise?${params.toString()}`);
  };

  return (
    <StepShell
      step={3}
      title="Reprise Confraternelle"
      subtitle="Envoyez la lettre confraternelle à l'expert-comptable précédent (obligation OEC)."
      type="automatisé"
      icon={<Scale className="w-5 h-5 text-white" />}
      onNext={goNext}
      nextDisabled={!clientData.lettreConfrereEnvoyee}
      skipLabel="Passer — non applicable →"
    >
      <div className="space-y-5">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-800 mb-1">Obligation déontologique OEC</p>
          <p className="text-xs text-amber-700">
            Lors d'une reprise de dossier, vous devez obligatoirement informer le confrère précédent
            par lettre confraternelle avant toute intervention. Cette étape est requise par le Code
            de déontologie des experts-comptables.
          </p>
        </div>

        {clientData.raisonSociale && (
          <div className="bg-gray-50 rounded-lg px-4 py-3">
            <p className="text-xs text-gray-500 mb-0.5">Dossier</p>
            <p className="text-sm font-medium text-gray-900">{clientData.raisonSociale}</p>
            {clientData.siren && (
              <p className="text-xs text-gray-500 font-mono">SIREN : {clientData.siren}</p>
            )}
          </div>
        )}

        {clientData.lettreConfrereEnvoyee ? (
          <div className="flex items-center gap-3 px-4 py-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">
                Lettre confraternelle envoyée
              </p>
              <p className="text-xs text-emerald-600">
                La lettre a été transmise au confrère précédent
              </p>
            </div>
          </div>
        ) : (
          <button
            onClick={handleOpenModule}
            className="w-full flex items-center justify-between gap-3 px-6 py-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl transition-all font-medium shadow-md group"
          >
            <div className="flex items-center gap-3">
              <Scale className="w-5 h-5" />
              <div className="text-left">
                <p className="font-semibold">Ouvrir le moteur de reprise</p>
                <p className="text-xs text-slate-400">
                  Générer et envoyer la lettre confraternelle
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-white" />
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>
        )}

        <p className="text-xs text-gray-400 text-center">
          Le module de reprise s'ouvrira avec le contexte du client pré-rempli.
        </p>
      </div>
    </StepShell>
  );
}
