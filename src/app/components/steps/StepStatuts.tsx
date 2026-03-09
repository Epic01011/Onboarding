import { useState } from 'react';
import { FileSignature, CheckCircle2, Loader2, ExternalLink, Send } from 'lucide-react';
import { useOnboarding } from '../../context/OnboardingContext';
import { useServices } from '../../context/ServicesContext';
import { StepShell, AutoTask } from '../StepShell';
import { createSignatureTransaction } from '../../services/jesignexpertApi';
import { toast } from 'sonner';

type Phase = 'prepare' | 'sending' | 'sent' | 'signed';
type TaskStatus = 'pending' | 'loading' | 'done' | 'error';

export function StepStatuts() {
  const { currentStep, clientData, updateClientData, goNext } = useOnboarding();
  const { connections } = useServices();
  const [phase, setPhase] = useState<Phase>(clientData.statutsSignes ? 'signed' : clientData.statutsGeneres ? 'sent' : 'prepare');
  const [taskStatuses, setTaskStatuses] = useState<TaskStatus[]>(['pending', 'pending', 'pending']);
  const [signingUrl, setSigningUrl] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  const handleGenerateAndSend = async () => {
    if (!clientData.nom || !clientData.email) {
      toast.error('Informations client manquantes');
      return;
    }

    setPhase('sending');

    // Task 1: Generate statuts PDF
    setTaskStatuses(['loading', 'pending', 'pending']);
    await new Promise(r => setTimeout(r, 1500));
    setTaskStatuses(['done', 'loading', 'pending']);

    // Task 2: Send for signature via JeSignExpert
    // Handles compound names: first token = prénom, rest = nom de famille
    const nameParts = clientData.nom.trim().split(/\s+/);
    const result = await createSignatureTransaction({
      name: `Statuts - ${clientData.raisonSociale || clientData.nom}`,
      signers: [{
        firstName: nameParts[0] || 'Dirigeant',
        lastName: nameParts.slice(1).join(' ') || clientData.nom,
        email: clientData.email,
      }],
      documentName: `Statuts_${clientData.raisonSociale?.replace(/\s/g, '_') || 'societe'}.pdf`,
      documentType: 'statuts',
    });

    if (result.success && result.data) {
      setTaskStatuses(['done', 'done', 'loading']);
      setIsDemo(result.demo ?? false);
      setSigningUrl(result.data.signers[0]?.signatureLink ?? result.data.signingUrl ?? null);

      updateClientData({
        statutsGeneres: true,
        statutsSignatureId: result.data.id,
      });

      // Task 3: Notify
      await new Promise(r => setTimeout(r, 800));
      setTaskStatuses(['done', 'done', 'done']);

      setPhase('sent');
      toast.success(result.demo ? 'Statuts generes (mode demo JeSignExpert)' : 'Statuts envoyes pour signature');
    } else {
      setTaskStatuses(['done', 'error', 'pending']);
      toast.error(result.error ?? 'Erreur lors de l\'envoi');
    }
  };

  const handleSimulateSignature = () => {
    updateClientData({ statutsSignes: true });
    setPhase('signed');
    toast.success('Statuts signes avec succes');
  };

  const handleNext = () => {
    if (!clientData.statutsSignes) {
      toast.error('Les statuts doivent etre signes avant de continuer');
      return;
    }
    goNext();
  };

  const tasks = [
    { label: 'Generation du projet de statuts', sublabel: `${clientData.formeJuridique || 'SARL'} — ${clientData.raisonSociale || clientData.nom}` },
    { label: `Envoi via JeSignExpert${!connections.jesignexpert.connected ? ' (Demo)' : ' (Live)'}`, sublabel: `Email → ${clientData.email}` },
    { label: 'Notification envoyee au dirigeant', sublabel: 'Email de signature' },
  ];

  return (
    <StepShell
      step={currentStep}
      title="Statuts de la societe"
      subtitle="Generation des statuts et envoi pour signature electronique via JeSignExpert"
      type="automatisé"
      icon={<FileSignature className="w-5 h-5 text-white" />}
      onNext={handleNext}
      nextDisabled={!clientData.statutsSignes}
    >
      <div className="space-y-6">
        {/* API status badge */}
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
            connections.jesignexpert.connected
              ? 'bg-violet-50 border-violet-200 text-violet-700'
              : 'bg-amber-50 border-amber-200 text-amber-700'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${connections.jesignexpert.connected ? 'bg-violet-500' : 'bg-amber-500'}`} />
            JeSignExpert {connections.jesignexpert.connected ? '(Live)' : '(Demo)'}
          </div>
        </div>

        {/* Prepare phase */}
        {phase === 'prepare' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm font-medium text-blue-800 mb-2">Informations des statuts</p>
              <div className="grid grid-cols-2 gap-3 text-xs text-blue-700">
                <div>
                  <p className="text-blue-500">Raison sociale</p>
                  <p className="font-medium">{clientData.raisonSociale || clientData.nom || '-'}</p>
                </div>
                <div>
                  <p className="text-blue-500">Forme juridique</p>
                  <p className="font-medium">{clientData.formeJuridique || '-'}</p>
                </div>
                <div>
                  <p className="text-blue-500">Capital social</p>
                  <p className="font-medium">{clientData.capital || '-'}</p>
                </div>
                <div>
                  <p className="text-blue-500">Siege social</p>
                  <p className="font-medium">{clientData.adresse ? `${clientData.adresse}, ${clientData.codePostal} ${clientData.ville}` : '-'}</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleGenerateAndSend}
              className="w-full py-3 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 transition-all flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" /> Generer et envoyer pour signature
            </button>
          </div>
        )}

        {/* Sending phase */}
        {phase === 'sending' && (
          <div className="space-y-3">
            {tasks.map((task, i) => (
              <AutoTask key={i} label={task.label} sublabel={task.sublabel} status={taskStatuses[i]} />
            ))}
          </div>
        )}

        {/* Sent phase - awaiting signature */}
        {phase === 'sent' && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />
                <p className="text-sm font-medium text-amber-800">En attente de signature</p>
              </div>
              {isDemo && <span className="inline-block text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full mb-2">Mode Demo</span>}
              <p className="text-xs text-amber-700">
                Les statuts ont ete envoyes a <strong>{clientData.email}</strong> pour signature electronique.
              </p>
              {signingUrl && (
                <a
                  href={signingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-amber-700 underline mt-2"
                >
                  <ExternalLink className="w-3 h-3" /> Voir le lien de signature
                </a>
              )}
            </div>

            {/* Simulate signature for demo */}
            <button
              onClick={handleSimulateSignature}
              className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" /> Simuler la signature (demo)
            </button>
          </div>
        )}

        {/* Signed phase */}
        {phase === 'signed' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-800">Statuts signes</p>
                <p className="text-xs text-emerald-600 mt-0.5">Les statuts de la societe ont ete signes electroniquement via JeSignExpert.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </StepShell>
  );
}
