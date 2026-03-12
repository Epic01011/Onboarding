import { useState } from 'react';
import { Mail, Eye, Send, CheckCircle2, Pencil } from 'lucide-react';
import { useOnboarding } from '../../context/OnboardingContext';
import { StepShell } from '../StepShell';
import { sendEmail } from '../../services/emailService';
import { useCabinet } from '../../context/CabinetContext';
import { toast } from 'sonner';

function buildCadrageEmail(params: {
  clientName: string;
  raisonSociale: string;
  expertName: string;
  expertEmail: string;
  cabinetNom: string;
}): string {
  const { clientName, raisonSociale, expertName, cabinetNom } = params;
  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#374151">
  <p>Bonjour ${clientName},</p>
  <p>
    Nous sommes ravis de vous accompagner dans la création de votre société 
    <strong>${raisonSociale || 'votre société'}</strong>.
  </p>
  <p>
    Afin de préparer les statuts et de compléter le dossier de création, 
    nous avons besoin des informations suivantes :
  </p>
  <ul style="margin:12px 0;padding-left:20px;line-height:1.8">
    <li><strong>Objet social</strong> : activité principale de la société</li>
    <li><strong>Répartition du capital</strong> : montant et répartition entre associés</li>
    <li><strong>Siège social</strong> : adresse complète du siège</li>
    <li><strong>Date de début d'activité souhaitée</strong></li>
    <li><strong>Mode de direction</strong> : Président, Gérant, Directeur Général…</li>
  </ul>
  <p>
    Vous pouvez nous répondre directement à cet email ou prendre 
    rendez-vous avec notre équipe pour en discuter.
  </p>
  <p>
    Cordialement,<br/>
    <strong>${expertName}</strong><br/>
    ${cabinetNom}
  </p>
</div>`.trim();
}

export function StepCreation2Cadrage() {
  const { clientData, updateClientData, goNext } = useOnboarding();
  const { cabinet } = useCabinet();

  const defaultHtml = buildCadrageEmail({
    clientName: clientData.nom || 'Madame, Monsieur',
    raisonSociale: clientData.denominationCreation || clientData.raisonSociale || '',
    expertName: cabinet.expertNom || 'Votre expert-comptable',
    expertEmail: cabinet.expertEmail || '',
    cabinetNom: cabinet.nom || 'Notre cabinet',
  });

  const [emailHtml, setEmailHtml] = useState(defaultHtml);
  const [emailSubject, setEmailSubject] = useState(
    `Création de société — Informations complémentaires requises`,
  );
  const [showPreview, setShowPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(clientData.cadrageEmailSent);

  const handleSend = async () => {
    if (!clientData.email) {
      toast.error('Adresse email du client manquante.');
      return;
    }
    setSending(true);
    const result = await sendEmail({
      to: clientData.email,
      toName: clientData.nom,
      subject: emailSubject,
      htmlContent: emailHtml,
    });
    setSending(false);
    if (result.success) {
      setSent(true);
      updateClientData({ cadrageEmailSent: true });
      if (result.demo) {
        toast.info('Email simulé (configurez SendGrid dans /setup pour l\'envoi réel)');
      } else {
        toast.success(`Email de cadrage envoyé à ${clientData.email} ✓`);
      }
    } else {
      toast.error(`Erreur lors de l'envoi : ${result.error}`);
    }
  };

  return (
    <StepShell
      step={2}
      title="Cadrage & Projet"
      subtitle="Envoyez un email au client pour recueillir les détails nécessaires à la création."
      type="automatisé"
      icon={<Mail className="w-5 h-5 text-white" />}
      onNext={goNext}
      nextLabel="Continuer →"
      skipLabel="Passer cette étape →"
    >
      {sent && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-5">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">Email de cadrage envoyé</p>
            <p className="text-xs text-emerald-600 mt-0.5">
              Un email a été transmis à <strong>{clientData.email}</strong>.
            </p>
          </div>
          <button
            onClick={() => setSent(false)}
            className="ml-auto flex-shrink-0 flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 bg-white border border-emerald-200 px-2.5 py-1.5 rounded-lg"
          >
            <Pencil className="w-3 h-3" />
            Modifier
          </button>
        </div>
      )}

      {!sent && (
        <div className="space-y-4">
          {/* Subject */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Objet</label>
            <input
              type="text"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Recipient */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Destinataire</label>
            <input
              type="text"
              readOnly
              value={clientData.email || '— email non renseigné —'}
              className="w-full border border-gray-100 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-600"
            />
          </div>

          {/* Email preview / editor */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-500">Corps du message</label>
              <button
                onClick={() => setShowPreview((v) => !v)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
              >
                <Eye className="w-3.5 h-3.5" />
                {showPreview ? 'Modifier' : 'Aperçu'}
              </button>
            </div>

            {showPreview ? (
              <div
                className="border border-gray-200 rounded-lg p-4 bg-white text-sm min-h-[200px] overflow-auto"
                dangerouslySetInnerHTML={{ __html: emailHtml }}
              />
            ) : (
              <textarea
                rows={10}
                value={emailHtml}
                onChange={(e) => setEmailHtml(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            )}
          </div>

          <button
            onClick={handleSend}
            disabled={sending || !clientData.email}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              sending || !clientData.email
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-violet-600 text-white hover:bg-violet-700 shadow-sm'
            }`}
          >
            {sending ? (
              <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {sending ? 'Envoi en cours…' : 'Envoyer l\'email de cadrage'}
          </button>
        </div>
      )}
    </StepShell>
  );
}
