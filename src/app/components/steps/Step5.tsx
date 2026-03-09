import { useState } from 'react';
import {
  Scale, FileText, CheckCircle2, Clock, Eye, BookOpen, Download,
  Send, AlertCircle,
} from 'lucide-react';
import { useOnboarding } from '../../context/OnboardingContext';
import { StepShell, AutoTask } from '../StepShell';
import { sendEmail } from '../../services/emailService';
import { generateLettrePdfBlob } from '../../services/pdfGenerator';
import { PdfPreviewModal } from '../modals/PdfPreviewModal';
import { LetterPreviewModal } from '../modals/LetterPreviewModal';
import { useCabinet } from '../../context/CabinetContext';
import { useServices } from '../../context/ServicesContext';
import type { TemplateVariables } from '../../utils/templateUtils';
import type { PdfResult } from '../../services/pdfGenerator';
import { toast } from 'sonner';
import { delay } from '../../utils/delay';

type Phase = 'idle' | 'sending' | 'sent';

export function Step5() {
  const { clientData, updateClientData, goNext, goPrev } = useOnboarding();
  const [phase, setPhase] = useState<Phase>('idle');
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [pdfResult, setPdfResult] = useState<PdfResult | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [emailDemo, setEmailDemo] = useState(false);

  const { cabinet } = useCabinet();
  const { getEmailConfig } = useServices();
  const emailConfig = getEmailConfig();

  const today = new Date();
  const deadline = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000);
  const formatDate = (d: Date) =>
    d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const formatDateLong = (d: Date) => {
    const weekday = d.toLocaleDateString('fr-FR', { weekday: 'long' });
    const day = d.getDate();
    const dayStr = day === 1 ? '1er' : String(day);
    const rest = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return `${weekday} ${dayStr} ${rest}`;
  };
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  // Template variables for LetterPreviewModal (bibliotheque)
  const templateVars: TemplateVariables = {
    cabinet_nom: cabinet.nom,
    cabinet_adresse: cabinet.adresse,
    cabinet_code_postal: cabinet.codePostal,
    cabinet_ville: cabinet.ville,
    cabinet_siren: cabinet.siren,
    cabinet_numero_ordre: cabinet.numeroOrdre,
    cabinet_expert: cabinet.expertNom,
    cabinet_telephone: cabinet.telephone,
    cabinet_capital_social: cabinet.capitalSocial,
    client_nom: clientData.nom,
    client_raison_sociale: clientData.raisonSociale || clientData.nom,
    client_siren: clientData.siren,
    client_email: clientData.email,
    client_adresse: `${clientData.adresse}, ${clientData.codePostal} ${clientData.ville}`,
    client_forme_juridique: clientData.formeJuridique,
    confrere_email: clientData.confrereEmail,
    date_du_jour: formatDateLong(today),
    date_effet: formatDate(nextMonth),
    date_rapprochement: formatDate(nextMonth),
  };

  // Shared params for PDF generation
  const buildPdfParams = () => ({
    cabinetNom: cabinet.nom,
    cabinetAdresse: cabinet.adresse,
    cabinetCodePostal: cabinet.codePostal,
    cabinetVille: cabinet.ville,
    cabinetTelephone: cabinet.telephone,
    cabinetExpertEmail: cabinet.expertEmail,
    cabinetSiren: cabinet.siren,
    cabinetOrdreNum: cabinet.numeroOrdre,
    cabinetExpertNom: cabinet.expertNom,
    clientNom: clientData.nom,
    clientRaisonSociale: clientData.raisonSociale || clientData.nom,
    clientSiren: clientData.siren,
    confrereEmail: clientData.confrereEmail,
    dateLettre: formatDateLong(today),
  });

  // ── Preview PDF ─────────────────────────────────────────────────────────────
  const handlePreviewPdf = async () => {
    setGeneratingPdf(true);
    try {
      await delay(100);
      const result = generateLettrePdfBlob(buildPdfParams());
      setPdfResult(result);
      setShowPdfModal(true);
    } catch (err) {
      toast.error('Erreur lors de la génération du PDF');
      console.error('[PDF]', err);
    } finally {
      setGeneratingPdf(false);
    }
  };

  // ── Send with PDF attachment ────────────────────────────────────────────────
  const handleSendPdf = async (base64: string, filename: string) => {
    setIsSending(true);
    setShowPdfModal(false);
    setPhase('sending');

    const subject = `Reprise confraternelle — ${clientData.raisonSociale || clientData.nom} (SIREN : ${clientData.siren})`;
    const htmlContent = `
      <p>Madame, Monsieur,</p>
      <p>Veuillez trouver ci-joint la lettre confraternelle concernant la reprise du dossier de la société
      <strong>${clientData.raisonSociale || clientData.nom}</strong> (SIREN&nbsp;: <strong>${clientData.siren}</strong>).</p>
      <p>Nous vous remercions de bien vouloir nous faire parvenir les éléments du dossier dans un délai de <strong>15&nbsp;jours</strong>.</p>
      <br>
      <p style="font-size:12px;color:#64748b;">Cordialement,<br><strong>${cabinet.nom}</strong>${cabinet.expertNom ? `<br>${cabinet.expertNom}` : ''}</p>
    `;

    const result = await sendEmail({
      to: clientData.confrereEmail,
      subject,
      htmlContent,
      attachments: [{ filename, content: base64, type: 'application/pdf' }],
    });

    setEmailDemo(result.demo ?? false);
    setIsSending(false);
    updateClientData({ lettreConfrereEnvoyee: true });
    setPhase('sent');

    if (result.success) {
      if (result.demo) {
        toast.info('Lettre confraternelle (PDF) simulée — Configurez SendGrid dans /setup pour l\'envoi réel');
      } else {
        toast.success(`Lettre confraternelle envoyée à ${clientData.confrereEmail} ✓`);
      }
    } else {
      toast.error(`Erreur envoi : ${result.error}`);
    }
  };

  // ── Send from template modal → redirect to PDF flow ────────────────────────
  const handleSendFromTemplateModal = async (_content: string, _templateId: string) => {
    setShowTemplateModal(false);
    handlePreviewPdf();
  };

  // ── Quick send (generate + send without preview) ────────────────────────────
  const handleQuickSend = async () => {
    setPhase('sending');
    await delay(400);
    try {
      const result = generateLettrePdfBlob(buildPdfParams());
      await handleSendPdf(result.base64, result.filename);
    } catch {
      toast.error('Erreur lors de la génération du PDF');
      setPhase('idle');
    }
  };

  return (
    <StepShell
      step={5}
      title="Gestion Déontologique — Lettre Confraternelle"
      subtitle="Génération PDF de la lettre de reprise (Ordre OEC art. 33), prévisualisation, téléchargement et envoi avec pièce jointe au confrère"
      type="conditionnel"
      icon={<Scale className="w-5 h-5 text-white" />}
      onBack={goPrev}
      onNext={goNext}
      nextLabel="Contractualisation →"
      nextDisabled={!clientData.lettreConfrereEnvoyee}
    >
      {/* Alert déontologique */}
      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
        <Scale className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800">Obligation déontologique — Reprise de dossier</p>
          <p className="text-xs text-amber-700 mt-1">
            Conformément à l'<strong>article 33 du Code de déontologie</strong> de l'Ordre des Experts-Comptables.
            Délai réglementaire d'attente&nbsp;: <strong>15 jours</strong>. L'onboarding peut se poursuivre en parallèle.
          </p>
        </div>
      </div>

      {/* Email config indicator */}
      <div className="flex items-center gap-2 mb-5">
        <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${emailConfig.isDemo ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${emailConfig.isDemo ? 'bg-amber-500' : 'bg-emerald-500'}`} />
          Email {emailConfig.isDemo ? '(Mode démo — configurez SendGrid dans /setup)' : `(Live — ${emailConfig.fromEmail})`}
        </div>
      </div>

      {/* Dossier info grid */}
      <div className="grid grid-cols-2 gap-2 mb-5">
        <div className="bg-gray-50 rounded-lg px-4 py-3">
          <p className="text-xs text-gray-500 mb-0.5">Destinataire (confrère)</p>
          <p className="text-sm font-medium text-gray-900 truncate">{clientData.confrereEmail || '—'}</p>
        </div>
        <div className="bg-gray-50 rounded-lg px-4 py-3">
          <p className="text-xs text-gray-500 mb-0.5">Société concernée</p>
          <p className="text-sm font-medium text-gray-900 truncate">{clientData.raisonSociale || clientData.nom}</p>
        </div>
        <div className="bg-gray-50 rounded-lg px-4 py-3">
          <p className="text-xs text-gray-500 mb-0.5">SIREN</p>
          <p className="text-sm font-mono font-medium text-gray-900">{clientData.siren || '—'}</p>
        </div>
        <div className="bg-gray-50 rounded-lg px-4 py-3">
          <p className="text-xs text-gray-500 mb-0.5">Date limite de réponse</p>
          <p className="text-sm font-medium text-gray-900">avant le {formatDate(deadline)}</p>
        </div>
      </div>

      {/* Template library card */}
      {phase === 'idle' && (
        <div className="border border-slate-200 bg-slate-50 rounded-xl p-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-slate-600" />
              <p className="text-sm font-medium text-slate-700">Bibliothèque de modèles (Ordre OEC)</p>
            </div>
            <button
              onClick={() => setShowTemplateModal(true)}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              <FileText className="w-3 h-3" /> Consulter / personnaliser
            </button>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            PDF généré automatiquement via <strong>jsPDF</strong> depuis les données du dossier.
            En-tête cabinet, données client et SIREN auto-remplis. Conforme article 33 OEC.
          </p>
          <div className="flex gap-2 flex-wrap">
            {['Variables auto-remplies', 'En-tête cabinet', 'Conforme OEC art. 33', 'PDF téléchargeable', 'Pièce jointe email'].map(tag => (
              <div key={tag} className="flex items-center gap-1.5 text-xs text-slate-600 bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" /> {tag}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main actions */}
      {phase === 'idle' && (
        <div className="flex flex-col gap-2 mb-2">
          <button
            onClick={handlePreviewPdf}
            disabled={generatingPdf || !clientData.confrereEmail}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all shadow-sm ${
              generatingPdf || !clientData.confrereEmail
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-slate-800 hover:bg-slate-900 text-white'
            }`}
          >
            {generatingPdf ? (
              <><div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" /> Génération du PDF…</>
            ) : (
              <><Eye className="w-4 h-4" /> Prévisualiser le PDF</>
            )}
          </button>

          <button
            onClick={handleQuickSend}
            disabled={generatingPdf || !clientData.confrereEmail}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all border ${
              generatingPdf || !clientData.confrereEmail
                ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                : 'border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800'
            }`}
          >
            <Send className="w-4 h-4" />
            Envoyer directement au confrère (PDF joint)
          </button>

          {!clientData.confrereEmail && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              L'email du confrère est manquant — retournez à l'étape 1 pour le saisir.
            </div>
          )}
        </div>
      )}

      {/* Sending */}
      {phase === 'sending' && (
        <div className="space-y-2.5 mb-5">
          <AutoTask
            label="Génération de la lettre confraternelle (PDF — jsPDF)"
            status="done"
            sublabel={`En-tête : ${cabinet.nom} | Conforme OEC art. 33`}
          />
          <AutoTask
            label="Envoi de l'email avec pièce jointe PDF"
            status="loading"
            sublabel={`Email + PDF → ${clientData.confrereEmail}`}
          />
        </div>
      )}

      {/* Sent confirmation */}
      {phase === 'sent' && (
        <div className="space-y-3">
          <AutoTask
            label="Lettre confraternelle (PDF) générée et envoyée"
            status="done"
            sublabel={`Destinataire : ${clientData.confrereEmail}`}
          />

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <p className="text-sm font-medium text-emerald-800">Lettre envoyée avec succès</p>
              {emailDemo && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Mode démo</span>
              )}
            </div>
            <p className="text-xs text-emerald-700">
              PDF joint — Envoyé à : <strong>{clientData.confrereEmail}</strong>
            </p>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-2">
            <Clock className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-orange-800">Délai réglementaire : 15 jours</p>
              <p className="text-xs text-orange-700 mt-1">
                Réponse attendue avant le <strong>{formatDate(deadline)}</strong>.
                Vous pouvez poursuivre l'onboarding en parallèle (contractualisation, KYC, etc.)
              </p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handlePreviewPdf}
              disabled={generatingPdf}
              className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 px-3 py-2 border border-gray-200 rounded-lg transition-all"
            >
              <Eye className="w-3.5 h-3.5" />
              {generatingPdf ? 'Génération…' : 'Voir le PDF'}
            </button>
            <button
              onClick={async () => {
                const result = generateLettrePdfBlob(buildPdfParams());
                const a = document.createElement('a');
                a.href = URL.createObjectURL(result.blob);
                a.download = result.filename;
                a.click();
                setTimeout(() => URL.revokeObjectURL(a.href), 5000);
              }}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 px-3 py-2 border border-blue-200 bg-blue-50 rounded-lg transition-all"
            >
              <Download className="w-3.5 h-3.5" /> Télécharger le PDF
            </button>
            <button
              onClick={() => setPhase('idle')}
              className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-800 px-3 py-2 border border-amber-200 bg-amber-50 rounded-lg transition-all"
            >
              <Send className="w-3.5 h-3.5" /> Renvoyer
            </button>
          </div>
        </div>
      )}

      {/* PDF Preview Modal */}
      {showPdfModal && pdfResult && (
        <PdfPreviewModal
          pdfResult={pdfResult}
          onSend={handleSendPdf}
          onClose={() => setShowPdfModal(false)}
          recipientEmail={clientData.confrereEmail}
          isSending={isSending}
        />
      )}

      {/* Template Library Modal */}
      {showTemplateModal && (
        <LetterPreviewModal
          type="confraternal"
          variables={templateVars}
          onSend={handleSendFromTemplateModal}
          onClose={() => setShowTemplateModal(false)}
          sendLabel={`Générer le PDF et envoyer à ${clientData.confrereEmail}`}
        />
      )}
    </StepShell>
  );
}