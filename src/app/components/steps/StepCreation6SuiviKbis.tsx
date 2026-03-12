import { useRef, useState } from 'react';
import { FileCheck, Upload, Mail, Send, FolderOpen, CheckCircle2, X } from 'lucide-react';
import { useOnboarding } from '../../context/OnboardingContext';
import { StepShell } from '../StepShell';
import { sendEmail } from '../../services/emailService';
import { useCabinet } from '../../context/CabinetContext';
import { toast } from 'sonner';

function buildKbisSuiviEmail(params: {
  clientName: string;
  raisonSociale: string;
  expertName: string;
  cabinetNom: string;
}): string {
  const { clientName, raisonSociale, expertName, cabinetNom } = params;
  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#374151">
  <p>Bonjour ${clientName},</p>
  <p>
    Nous avons le plaisir de vous informer que les formalités de création de 
    <strong>${raisonSociale || 'votre société'}</strong> ont été déposées avec succès 
    auprès du Greffe du Tribunal de Commerce compétent.
  </p>
  <p>
    Nous attendons désormais le retour du Greffe et la délivrance de votre 
    <strong>extrait Kbis définitif</strong>. Ce délai est généralement de 
    <strong>3 à 10 jours ouvrés</strong>.
  </p>
  <p>
    Vous serez informé(e) dès réception du Kbis. N'hésitez pas à nous contacter 
    si vous avez des questions.
  </p>
  <p>
    Cordialement,<br/>
    <strong>${expertName}</strong><br/>
    ${cabinetNom}
  </p>
</div>`.trim();
}

export function StepCreation6SuiviKbis() {
  const { clientData, updateClientData, goNext } = useOnboarding();
  const { cabinet } = useCabinet();

  // ── Section 1 : email suivi client ──────────────────────────────────────────
  const [emailSent, setEmailSent] = useState(clientData.kbisSuiviEmailSent);
  const [sending, setSending] = useState(false);
  const emailBody = buildKbisSuiviEmail({
    clientName: clientData.nom || 'Madame, Monsieur',
    raisonSociale: clientData.denominationCreation || clientData.raisonSociale || '',
    expertName: cabinet.expertNom || 'Votre expert-comptable',
    cabinetNom: cabinet.nom || 'Notre cabinet',
  });

  const handleSendSuivi = async () => {
    if (!clientData.email) {
      toast.error('Adresse email du client manquante.');
      return;
    }
    setSending(true);
    const result = await sendEmail({
      to: clientData.email,
      toName: clientData.nom,
      subject: `Création de ${clientData.denominationCreation || 'votre société'} — Formalités déposées`,
      htmlContent: emailBody,
    });
    setSending(false);
    if (result.success) {
      setEmailSent(true);
      updateClientData({ kbisSuiviEmailSent: true });
      if (result.demo) {
        toast.info('Email simulé (configurez SendGrid dans /setup pour l\'envoi réel)');
      } else {
        toast.success(`Email de suivi envoyé à ${clientData.email} ✓`);
      }
    } else {
      toast.error(`Erreur lors de l'envoi : ${result.error}`);
    }
  };

  // ── Section 2 : upload Kbis ──────────────────────────────────────────────────
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [kbisFile, setKbisFile] = useState<{ name: string; size: number } | null>(
    clientData.kbisUploaded ? { name: clientData.kbisUrl || 'Kbis.pdf', size: 0 } : null,
  );

  const handleKbisFile = (f: File) => {
    setKbisFile({ name: f.name, size: f.size });
    updateClientData({ kbisUploaded: true, kbisUrl: f.name });
    toast.success(`Kbis "${f.name}" chargé — sera transmis à la GED (SharePoint).`);
  };

  return (
    <StepShell
      step={6}
      title="Suivi & Dépôt Kbis"
      subtitle="Informez le client du dépôt des formalités, puis déposez le Kbis définitif dès réception du Greffe."
      type="manuel"
      icon={<FileCheck className="w-5 h-5 text-white" />}
      onNext={goNext}
      nextLabel="Continuer →"
      skipLabel="Passer cette étape →"
    >
      {/* ── Section 1 : Information Client ─────────────────────────────────── */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Mail className="w-4 h-4 text-gray-500" />
          Section 1 — Information Client
        </h3>

        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 text-sm mb-3 overflow-auto max-h-48"
          dangerouslySetInnerHTML={{ __html: emailBody }}
        />

        {emailSent ? (
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            Email de suivi envoyé à <strong>{clientData.email}</strong>
          </div>
        ) : (
          <button
            onClick={handleSendSuivi}
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
            {sending ? 'Envoi en cours…' : 'Envoyer l\'email de suivi'}
          </button>
        )}
      </div>

      {/* ── Section 2 : Dépôt Kbis ─────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Upload className="w-4 h-4 text-gray-500" />
          Section 2 — Dépôt du Kbis définitif
        </h3>

        <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 mb-4">
          <FolderOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <p className="text-xs text-blue-700">
            Le Kbis sera classé automatiquement dans la GED (SharePoint) sous{' '}
            <strong>Création / Kbis</strong>.
          </p>
        </div>

        <div
          className={`rounded-xl border-2 border-dashed p-6 transition-all text-center cursor-pointer ${
            kbisFile
              ? 'border-emerald-300 bg-emerald-50'
              : dragging
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-200 bg-gray-50 hover:border-gray-300'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f) handleKbisFile(f);
          }}
          onClick={() => !kbisFile && inputRef.current?.click()}
        >
          {kbisFile ? (
            <div className="flex items-center justify-center gap-3">
              <FileCheck className="w-6 h-6 text-emerald-500" />
              <div className="text-left">
                <p className="text-sm font-medium text-emerald-700">{kbisFile.name}</p>
                {kbisFile.size > 0 && (
                  <p className="text-xs text-emerald-600">{(kbisFile.size / 1024).toFixed(0)} Ko</p>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setKbisFile(null);
                  updateClientData({ kbisUploaded: false, kbisUrl: '' });
                }}
                className="ml-2 text-gray-400 hover:text-red-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div>
              <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-600">Déposer le Kbis définitif</p>
              <p className="text-xs text-gray-400 mt-1">Glisser-déposer ou cliquer pour parcourir</p>
            </div>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleKbisFile(f);
            e.target.value = '';
          }}
        />
      </div>
    </StepShell>
  );
}
