import { useState } from 'react';
import { PenLine, CheckSquare, Square, Send, Clock, CheckCircle2 } from 'lucide-react';
import { useOnboarding } from '../../context/OnboardingContext';
import { StepShell } from '../StepShell';
import { toast } from 'sonner';

const DOCUMENTS = [
  { id: 'statuts', label: 'Statuts de la société', required: true },
  { id: 'm0', label: 'Formulaire M0 (immatriculation)', required: true },
  { id: 'declaration', label: 'Déclaration des bénéficiaires effectifs', required: false },
];

type SignatureStatus = 'idle' | 'pending' | 'signed';

export function StepCreation4Signature() {
  const { clientData, updateClientData, goNext } = useOnboarding();

  const [selected, setSelected] = useState<string[]>(['statuts', 'm0']);
  const [status, setStatus] = useState<SignatureStatus>(
    clientData.statutsSignes ? 'signed' : 'idle',
  );
  const [sending, setSending] = useState(false);

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    );
  };

  const handleSendForSignature = async () => {
    if (selected.length === 0) {
      toast.error('Sélectionnez au moins un document à signer.');
      return;
    }
    setSending(true);
    // Simulate sending to e-signature provider (Yousign / Jesignexpert)
    await new Promise((r) => setTimeout(r, 1200));
    setSending(false);
    setStatus('pending');
    updateClientData({ statutsSignatureId: `SIG-${Date.now()}` });
    toast.success('Documents envoyés pour signature électronique ✓');
  };

  const handleMarkSigned = () => {
    setStatus('signed');
    updateClientData({ statutsSignes: true });
    toast.success('Signature enregistrée ✓');
  };

  return (
    <StepShell
      step={4}
      title="Signature Électronique"
      subtitle="Sélectionnez les documents finaux à signer électroniquement et envoyez-les au client."
      type="automatisé"
      icon={<PenLine className="w-5 h-5 text-white" />}
      onNext={goNext}
      nextLabel="Continuer →"
      skipLabel="Passer cette étape →"
    >
      {/* Document selection */}
      <div className="mb-6">
        <p className="text-sm font-medium text-gray-700 mb-3">Documents à signer</p>
        <div className="space-y-2">
          {DOCUMENTS.map((doc) => {
            const checked = selected.includes(doc.id);
            return (
              <button
                key={doc.id}
                onClick={() => toggle(doc.id)}
                disabled={status !== 'idle'}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all ${
                  checked
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {checked ? (
                  <CheckSquare className="w-4 h-4 text-blue-600 flex-shrink-0" />
                ) : (
                  <Square className="w-4 h-4 text-gray-400 flex-shrink-0" />
                )}
                <span className="text-sm text-gray-800">{doc.label}</span>
                {doc.required && (
                  <span className="ml-auto text-xs text-gray-400">Requis</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Status display */}
      {status === 'idle' && (
        <button
          onClick={handleSendForSignature}
          disabled={sending || selected.length === 0}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
            sending || selected.length === 0
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-violet-600 text-white hover:bg-violet-700 shadow-sm'
          }`}
        >
          {sending ? (
            <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          {sending ? 'Envoi en cours…' : 'Envoyer pour signature électronique'}
        </button>
      )}

      {status === 'pending' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <Clock className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">En attente de signature</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Une invitation de signature a été envoyée à <strong>{clientData.email}</strong>.
              </p>
            </div>
          </div>
          <button
            onClick={handleMarkSigned}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            Marquer comme signé
          </button>
        </div>
      )}

      {status === 'signed' && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">Documents signés</p>
            <p className="text-xs text-emerald-600 mt-0.5">
              La signature électronique a été complétée avec succès.
            </p>
          </div>
        </div>
      )}
    </StepShell>
  );
}
