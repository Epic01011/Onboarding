import { useState, useEffect } from 'react';
import { Trophy, CheckCircle2, Building2, Users, Loader2, ArrowRight } from 'lucide-react';
import { useOnboarding } from '../../context/OnboardingContext';
import { StepShell } from '../StepShell';
import { useParams, useNavigate } from 'react-router';
import { useProspectStore } from '../../store/useProspectStore';
import { useOnboardingDraftStore } from '../../store/useOnboardingDraftStore';
import { useDossiersContext } from '../../context/DossiersContext';
import { toast } from 'sonner';

export function StepReprise6Cloture() {
  const { dossierId } = useParams<{ dossierId: string }>();
  const navigate = useNavigate();
  const { clientData } = useOnboarding();
  const { convertProspectToClient } = useProspectStore();
  const { getDraft, clearDraft } = useOnboardingDraftStore();
  const { saveDossier, getDossier } = useDossiersContext();

  const [converting, setConverting] = useState(false);
  const [converted, setConverted] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const prospectId = dossierId ? (getDraft(dossierId)?.prospectId ?? null) : null;

  useEffect(() => {
    setShowConfetti(true);
    const t = setTimeout(() => setShowConfetti(false), 4500);
    return () => clearTimeout(t);
  }, []);

  const handleFinalize = async () => {
    if (!dossierId) return;
    setConverting(true);
    try {
      // 1. Convert prospect to client in DB
      if (prospectId) {
        const result = await convertProspectToClient(prospectId);
        if (!result.success) {
          toast.error('Erreur lors de la conversion du prospect en client');
        }
      }

      // 2. Save final dossier state
      const dossier = getDossier(dossierId);
      if (dossier) {
        await saveDossier({
          ...dossier,
          clientData: { ...clientData },
        });
      }

      // 3. Clear the onboarding draft
      clearDraft(dossierId);

      setConverted(true);
      toast.success('Onboarding terminé — Client activé avec succès !');

      // 4. Redirect to active dossiers
      setTimeout(() => navigate('/dossiers-actifs'), 1500);
    } catch {
      toast.error('Une erreur est survenue lors de la finalisation');
    } finally {
      setConverting(false);
    }
  };

  const checklist = [
    { label: 'Prospect sélectionné et importé', done: !!(clientData.raisonSociale || clientData.siren) },
    { label: 'Lettre de mission générée et signée', done: clientData.lettreMissionSignee },
    { label: 'Lettre confraternelle envoyée', done: clientData.lettreConfrereEnvoyee },
    { label: 'Documents collectés', done: clientData.documentDemandeSent },
    { label: 'Client créé dans Pennylane', done: clientData.pennylaneCreated },
    { label: 'Mandat SEPA validé', done: clientData.pennylaneMandat === 'signed' },
  ];

  return (
    <StepShell
      step={6}
      title="Clôture de l'Onboarding"
      subtitle="L'onboarding de reprise est finalisé. Convertissez le dossier en client actif."
      type="celebr"
      icon={<Trophy className="w-5 h-5 text-white" />}
      hideNav={converted}
    >
      <div className="space-y-5">
        {/* Celebration banner */}
        <div
          className={`relative overflow-hidden bg-gradient-to-br from-pink-50 to-violet-50 border border-pink-100 rounded-xl p-6 text-center transition-all ${showConfetti ? 'animate-pulse' : ''}`}
        >
          <div className="text-4xl mb-2">🎉</div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Reprise finalisée !</h3>
          <p className="text-sm text-gray-600">
            Le dossier de{' '}
            <strong>{clientData.raisonSociale || clientData.nom || 'ce client'}</strong> est prêt à
            être activé.
          </p>
        </div>

        {/* Summary checklist */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Récapitulatif
          </p>
          {checklist.map(item => (
            <div key={item.label} className="flex items-center gap-2.5">
              <CheckCircle2
                className={`w-4 h-4 flex-shrink-0 ${item.done ? 'text-emerald-500' : 'text-gray-300'}`}
              />
              <span className={`text-sm ${item.done ? 'text-gray-900' : 'text-gray-400'}`}>
                {item.label}
              </span>
            </div>
          ))}
        </div>

        {/* Client info */}
        <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Société</p>
              <p className="text-sm font-medium text-gray-900">{clientData.raisonSociale || '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Contact</p>
              <p className="text-sm font-medium text-gray-900">{clientData.nom || '—'}</p>
            </div>
          </div>
        </div>

        {/* Finalize button */}
        {converted ? (
          <div className="flex items-center gap-3 px-4 py-4 bg-emerald-50 border border-emerald-200 rounded-xl justify-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <p className="text-sm font-semibold text-emerald-800">
              Client activé — Redirection en cours...
            </p>
          </div>
        ) : (
          <button
            onClick={handleFinalize}
            disabled={converting}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white rounded-xl font-semibold text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-70"
          >
            {converting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Trophy className="w-5 h-5" />
            )}
            {converting
              ? 'Finalisation en cours...'
              : "Terminer l'onboarding — Activer le client"}
            {!converting && <ArrowRight className="w-4 h-4" />}
          </button>
        )}
      </div>
    </StepShell>
  );
}
