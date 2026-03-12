import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Trophy, CheckCircle2, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import { useOnboarding } from '../../context/OnboardingContext';
import { StepShell } from '../StepShell';
import { useProspectStore } from '../../store/useProspectStore';
import { useOnboardingDraftStore } from '../../store/useOnboardingDraftStore';
import { toast } from 'sonner';

interface SwitchRowProps {
  label: string;
  sublabel?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

function SwitchRow({ label, sublabel, checked, onChange }: SwitchRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-gray-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {sublabel && <p className="text-xs text-gray-500 mt-0.5">{sublabel}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`flex-shrink-0 transition-colors ${checked ? 'text-blue-600' : 'text-gray-300'}`}
        title={checked ? 'Activé' : 'Désactivé'}
      >
        {checked ? (
          <ToggleRight className="w-8 h-8" />
        ) : (
          <ToggleLeft className="w-8 h-8" />
        )}
      </button>
    </div>
  );
}

export function StepCreation7Cloture() {
  const { dossierId } = useParams<{ dossierId: string }>();
  const navigate = useNavigate();
  const { clientData, updateClientData, goPrev } = useOnboarding();
  const { convertProspectToClient } = useProspectStore();
  const { getDraft, clearDraft } = useOnboardingDraftStore();

  const prospectIdFromDraft = dossierId ? (getDraft(dossierId)?.prospectId ?? null) : null;
  const prospectId = prospectIdFromDraft ?? (clientData.creationProspectId || null);

  const [pennylane, setPennylane] = useState(clientData.pennylaneCreated);
  const [facturation, setFacturation] = useState(clientData.facturationAbonnementActive);
  const [closing, setClosing] = useState(false);
  const [closed, setClosed] = useState(false);

  const handlePennylane = (v: boolean) => {
    setPennylane(v);
    updateClientData({ pennylaneCreated: v });
  };

  const handleFacturation = (v: boolean) => {
    setFacturation(v);
    updateClientData({ facturationAbonnementActive: v });
  };

  const handleCloture = async () => {
    setClosing(true);
    try {
      if (prospectId) {
        const result = await convertProspectToClient(prospectId);
        if (!result.success) {
          toast.error(`Erreur lors de la conversion : ${result.error ?? 'Inconnue'}`);
          setClosing(false);
          return;
        }
      }
      if (dossierId) clearDraft(dossierId);
      setClosed(true);
      toast.success('Création de société finalisée avec succès ! 🎉');
      setTimeout(() => navigate('/dossiers-actifs'), 1800);
    } catch {
      toast.error('Une erreur est survenue lors de la clôture.');
      setClosing(false);
    }
  };

  return (
    <StepShell
      step={7}
      title="Connectivité & Clôture"
      subtitle="Activez les intégrations nécessaires puis clôturez le dossier de création."
      type="celebr"
      icon={<Trophy className="w-5 h-5 text-white" />}
      onBack={goPrev}
      hideNav
    >
      {/* Connectivity switches */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <p className="text-sm font-semibold text-gray-700 mb-1">Connectivité</p>
        <p className="text-xs text-gray-500 mb-4">
          Activez les services nécessaires au démarrage du dossier client.
        </p>
        <SwitchRow
          label="Création client Pennylane"
          sublabel="Créer le compte client dans l'espace Pennylane du cabinet"
          checked={pennylane}
          onChange={handlePennylane}
        />
        <SwitchRow
          label="Abonnement facturation"
          sublabel="Activer l'abonnement et la facturation récurrente du client"
          checked={facturation}
          onChange={handleFacturation}
        />
      </div>

      {/* Celebration message */}
      {!closed && (
        <div className="bg-gradient-to-br from-violet-50 to-blue-50 border border-violet-100 rounded-xl p-5 mb-6 text-center">
          <div className="text-3xl mb-2">🎉</div>
          <p className="text-sm font-semibold text-violet-800">
            {clientData.denominationCreation || clientData.nom
              ? `La création de ${clientData.denominationCreation || clientData.raisonSociale || 'la société'} est presque finalisée !`
              : 'Le dossier de création est presque finalisé !'}
          </p>
          <p className="text-xs text-violet-600 mt-1">
            Cliquez sur le bouton ci-dessous pour convertir le prospect en client et clôturer ce dossier.
          </p>
        </div>
      )}

      {closed ? (
        <div className="flex items-center justify-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
          <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">Dossier clôturé avec succès</p>
            <p className="text-xs text-emerald-600 mt-0.5">Redirection vers les dossiers actifs…</p>
          </div>
        </div>
      ) : (
        <button
          onClick={handleCloture}
          disabled={closing}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
            closing
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-violet-600 text-white hover:from-blue-700 hover:to-violet-700 shadow-md hover:shadow-lg'
          }`}
        >
          {closing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trophy className="w-4 h-4" />
          )}
          {closing ? 'Clôture en cours…' : 'Clôturer la création'}
        </button>
      )}
    </StepShell>
  );
}
