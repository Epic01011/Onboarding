import { useState } from 'react';
import { FileText, Send, ExternalLink, CheckCircle2 } from 'lucide-react';
import { useOnboarding } from '../../context/OnboardingContext';
import { StepShell } from '../StepShell';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

export function StepReprise2LDM() {
  const { clientData, updateClientData, goNext } = useOnboarding();
  const navigate = useNavigate();
  const [signatureSent, setSignatureSent] = useState(clientData.lettreMissionSignee);

  const prixTotal =
    (clientData.devisMonthlyAccounting || 0) +
    (clientData.devisMonthlyClosing || 0) +
    (clientData.devisMonthlySocial || 0) +
    (clientData.devisMonthlyOptions || 0);

  const handleSendForSignature = () => {
    updateClientData({ lettreMissionSignee: true });
    setSignatureSent(true);
    toast.success('Lettre de mission envoyée pour signature');
  };

  return (
    <StepShell
      step={2}
      title="Lettre de Mission"
      subtitle="Générez et envoyez la lettre de mission pour signature électronique."
      type="automatisé"
      icon={<FileText className="w-5 h-5 text-white" />}
      onNext={goNext}
      nextDisabled={!signatureSent}
      skipLabel="Passer — à compléter ultérieurement →"
    >
      <div className="space-y-5">
        {prixTotal > 0 && (
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide mb-2">
              Honoraires du devis
            </p>
            <div className="space-y-1.5 text-sm">
              {clientData.devisMonthlyAccounting > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Comptabilité</span>
                  <span className="font-medium">{clientData.devisMonthlyAccounting} €/mois</span>
                </div>
              )}
              {clientData.devisMonthlyClosing > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Clôture</span>
                  <span className="font-medium">{clientData.devisMonthlyClosing} €/mois</span>
                </div>
              )}
              {clientData.devisMonthlySocial > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Social</span>
                  <span className="font-medium">{clientData.devisMonthlySocial} €/mois</span>
                </div>
              )}
              {clientData.devisSetupFees > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Frais de mise en place</span>
                  <span className="font-medium">{clientData.devisSetupFees} €</span>
                </div>
              )}
            </div>
            <div className="mt-2 pt-2 border-t border-violet-200 flex justify-between font-semibold text-violet-800">
              <span>Total mensuel</span>
              <span>{prixTotal} €/mois</span>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={() => navigate('/lettre-mission')}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-white border border-gray-200 hover:border-blue-400 hover:bg-blue-50 rounded-xl transition-all group"
          >
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-blue-600" />
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900">Ouvrir le moteur de LDM</p>
                <p className="text-xs text-gray-500">Générer la lettre de mission personnalisée</p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
          </button>

          {signatureSent ? (
            <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-800">Envoyée pour signature</p>
                <p className="text-xs text-emerald-600">
                  La lettre de mission a été transmise au client
                </p>
              </div>
            </div>
          ) : (
            <button
              onClick={handleSendForSignature}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all font-medium text-sm shadow-sm"
            >
              <Send className="w-4 h-4" />
              Envoyer pour signature par email
            </button>
          )}
        </div>
      </div>
    </StepShell>
  );
}
