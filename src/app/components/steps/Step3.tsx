import { useState } from 'react';
import { Mail, Copy, CheckCircle2, Link, Eye, FileText, Send, PenLine } from 'lucide-react';
import { useOnboarding } from '../../context/OnboardingContext';
import { StepShell, AutoTask } from '../StepShell';
import {
  sendEmail,
  buildDocumentRequestEmail,
  buildCreationDocumentRequestEmail,
  buildMandatCreationEmail,
} from '../../services/emailService';
import { EmailPreviewModal } from '../EmailPreviewModal';
import { useCabinet } from '../../context/CabinetContext';
import { useServices } from '../../context/ServicesContext';
import { toast } from 'sonner';
import { delay } from '../../utils/delay';

type Phase = 'idle' | 'generating' | 'ready' | 'preview' | 'sent' | 'mandat_sending' | 'mandat_sent' | 'attestation_sent';

// Documents pour une reprise de dossier
const DOCUMENTS_REPRISE = [
  'Extrait KBIS de moins de 3 mois',
  "Pièce d'identité en cours de validité du dirigeant",
  'Statuts constitutifs et modifications éventuelles',
  'Derniers bilans comptables (3 exercices)',
  'Attestation de régularité fiscale (DGFIP)',
  'Attestation de vigilance URSSAF',
];

// Documents pour une création d'entreprise
const DOCUMENTS_CREATION = [
  "Pièce d'identité recto/verso de chaque associé / dirigeant",
  "Justificatif de domicile de moins de 3 mois (siège social)",
  "Justificatif de domicile du dirigeant",
  "Attestation de dépôt de capital (certificat bancaire)",
  "Attestation de non-condamnation et de filiation (chaque dirigeant)",
];

export function Step3() {
  const { clientData, updateClientData, goNext, goPrev } = useOnboarding();
  const [phase, setPhase] = useState<Phase>('idle');
  const [copied, setCopied] = useState(false);
  const [emailResult, setEmailResult] = useState<{ success: boolean; demo?: boolean } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const { cabinet } = useCabinet();
  const { getEmailConfig } = useServices();
  const emailConfig = getEmailConfig();

  const isCreation = clientData.missionType === 'creation';
  const documentsRequis = isCreation ? DOCUMENTS_CREATION : DOCUMENTS_REPRISE;

  const generate = async () => {
    setPhase('generating');
    await delay(800);

    const siren = clientData.siren.replace(/\s/g, '');
    const uploadLink = `https://cabinet.sharepoint.com/:f:/g/clients/depot/${siren}?e=xYzDemo&key=cab_${Date.now()}`;
    updateClientData({ sharepointUploadLink: uploadLink });
    setPhase('ready');
  };

  const openPreview = () => {
    setShowPreview(true);
  };

  const sendRequest = async () => {
    setShowPreview(false);

    let html: string;
    let subject: string;

    if (isCreation) {
      html = buildCreationDocumentRequestEmail({
        clientName: clientData.nom,
        cabinetName: cabinet.nom,
        uploadLink: clientData.sharepointUploadLink,
        denomination: clientData.denominationCreation || clientData.nom,
        formeJuridique: clientData.formeJuridiqueCreation || 'SAS',
        documents: documentsRequis,
      });
      subject = `[${cabinet.nom}] Création d'entreprise — Documents requis pour ${clientData.denominationCreation || clientData.nom}`;
    } else {
      html = buildDocumentRequestEmail({
        clientName: clientData.nom,
        cabinetName: cabinet.nom,
        uploadLink: clientData.sharepointUploadLink,
        documents: documentsRequis,
      });
      subject = `[${cabinet.nom}] Documents requis pour l'ouverture de votre dossier`;
    }

    const result = await sendEmail({
      to: clientData.email,
      toName: clientData.nom,
      subject,
      htmlContent: html,
    });

    setEmailResult(result);
    if (result.success) {
      updateClientData({ documentDemandeSent: true });
      setPhase('sent');

      if (result.demo) {
        toast.info('Email de demande documentaire simulé — Configurez SendGrid dans /setup pour l\'envoi réel');
      } else {
        toast.success(`Email envoyé à ${clientData.email}`);
      }
    } else {
      toast.error(`Erreur d'envoi : ${result.error}`);
    }
  };

  // Envoi du mandat de création
  const sendMandat = async () => {
    setPhase('mandat_sending');
    await delay(600);

    const html = buildMandatCreationEmail({
      clientName: clientData.nom,
      cabinetName: cabinet.nom,
      denomination: clientData.denominationCreation || clientData.nom,
      formeJuridique: clientData.formeJuridiqueCreation || 'SAS',
    });

    const result = await sendEmail({
      to: clientData.email,
      toName: clientData.nom,
      subject: `[${cabinet.nom}] Mandat de création d'entreprise — ${clientData.denominationCreation || clientData.nom}`,
      htmlContent: html,
    });

    if (result.success) {
      updateClientData({ mandatCreationEnvoye: true });
      setPhase('mandat_sent');
      toast.success(result.demo ? 'Mandat de création envoyé (mode démo)' : `Mandat envoyé à ${clientData.email}`);
    } else {
      toast.error(`Erreur d'envoi du mandat`);
      setPhase('sent');
    }
  };

  // Simuler signature du mandat
  const simulateSignMandat = async () => {
    await delay(600);
    updateClientData({ mandatCreationSigne: true });
    toast.success('Mandat de création signé par le client');
  };

  // Envoi attestation de non-condamnation
  const sendAttestation = async () => {
    await delay(800);
    updateClientData({ attestationNonCondamnationEnvoyee: true });
    toast.success('Attestation de non-condamnation et de filiation envoyée au client');
    setPhase('attestation_sent');
  };

  // Simuler réception attestation
  const simulateAttestationReceived = async () => {
    await delay(500);
    updateClientData({ attestationNonCondamnationRecue: true });
    toast.success('Attestation de non-condamnation et filiation reçue');
  };

  const copyLink = () => {
    navigator.clipboard.writeText(clientData.sharepointUploadLink).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Condition pour passer à l'étape suivante
  const canProceed = isCreation
    ? clientData.documentDemandeSent && clientData.mandatCreationEnvoye && clientData.mandatCreationSigne && clientData.attestationNonCondamnationRecue
    : clientData.documentDemandeSent;

  return (
    <StepShell
      step={3}
      title={isCreation ? 'Collecte Documentaire — Création d\'entreprise' : 'Demande Documentaire Client'}
      subtitle={
        isCreation
          ? 'Envoi du mandat de création, demande des pièces justificatives, attestation de non-condamnation et filiation'
          : 'Génération du lien de dépôt SharePoint sécurisé et envoi de l\'email de demande de documents légaux au client'
      }
      type="automatisé"
      icon={<Mail className="w-5 h-5 text-white" />}
      onBack={goPrev}
      onNext={goNext}
      nextLabel="Initialisation espace client →"
      nextDisabled={!canProceed}
    >
      {/* Client info recap */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-gray-50 rounded-lg px-4 py-3">
          <p className="text-xs text-gray-500 mb-0.5">Destinataire</p>
          <p className="text-sm font-medium text-gray-900">{clientData.nom}</p>
        </div>
        <div className="bg-gray-50 rounded-lg px-4 py-3">
          <p className="text-xs text-gray-500 mb-0.5">Email</p>
          <p className="text-sm text-gray-900 truncate">{clientData.email}</p>
        </div>
        {isCreation && (
          <>
            <div className="bg-blue-50 rounded-lg px-4 py-3">
              <p className="text-xs text-blue-500 mb-0.5">Dénomination</p>
              <p className="text-sm font-medium text-blue-900">{clientData.denominationCreation || clientData.nom}</p>
            </div>
            <div className="bg-blue-50 rounded-lg px-4 py-3">
              <p className="text-xs text-blue-500 mb-0.5">Forme juridique</p>
              <p className="text-sm font-medium text-blue-900">{clientData.formeJuridiqueCreation || '—'}</p>
            </div>
          </>
        )}
      </div>

      {/* Email config indicator */}
      <div className="flex items-center gap-2 mb-5">
        <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${emailConfig.isDemo ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${emailConfig.isDemo ? 'bg-amber-500' : 'bg-emerald-500'}`} />
          {emailConfig.isDemo ? 'Email mode démo (configurez SendGrid dans /setup)' : `SendGrid — Envoi depuis ${emailConfig.fromEmail}`}
        </div>
      </div>

      {/* ═══ SECTION 1 : Documents list ═══ */}
      <div className="mb-5">
        <p className="text-sm font-medium text-gray-800 mb-2">
          {isCreation ? 'Pièces requises pour la création' : 'Pièces demandées au client'}
        </p>
        <div className="border border-gray-100 rounded-xl overflow-hidden">
          {documentsRequis.map((doc, i) => (
            <div
              key={i}
              className={`flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 ${i < documentsRequis.length - 1 ? 'border-b border-gray-50' : ''}`}
            >
              <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              {doc}
            </div>
          ))}
        </div>
      </div>

      {/* Actions — Generate + Send docs request */}
      {phase === 'idle' && (
        <button
          onClick={generate}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-medium transition-all shadow-sm mb-4"
        >
          <Link className="w-4 h-4" />
          Générer le lien SharePoint + préparer l'email
        </button>
      )}

      {phase === 'generating' && (
        <div className="space-y-2.5 mb-5">
          <AutoTask label="Génération du dossier de dépôt SharePoint (Documents Légaux)" status="done" />
          <AutoTask label="Création du lien de dépôt sécurisé (valable 30 jours)" status="loading" />
        </div>
      )}

      {(phase === 'ready' || phase === 'preview' || phase === 'sent' || phase === 'mandat_sending' || phase === 'mandat_sent' || phase === 'attestation_sent') && (
        <div className="space-y-4">
          <AutoTask
            label="Lien de dépôt SharePoint généré"
            status="done"
            sublabel={isCreation ? 'Dossier : Création Entreprise — Classement automatique' : 'Dossier : Documents Légaux — Classement automatique activé'}
          />

          {/* Upload link */}
          <div className="border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-2 flex items-center gap-1.5">
              <Link className="w-3.5 h-3.5" />
              Lien de dépôt SharePoint (à envoyer au client)
            </p>
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
              <code className="text-xs text-blue-700 flex-1 truncate">{clientData.sharepointUploadLink}</code>
              <button
                onClick={copyLink}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-all flex-shrink-0 ${
                  copied ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                {copied ? <><CheckCircle2 className="w-3 h-3" /> Copié</> : <><Copy className="w-3 h-3" /> Copier</>}
              </button>
            </div>
          </div>

          {/* Send email */}
          {phase === 'ready' && (
            <button
              onClick={openPreview}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl text-sm font-medium transition-all shadow-sm"
            >
              <Eye className="w-4 h-4" />
              {isCreation ? 'Prévisualiser l\'email de demande (création)' : 'Prévisualiser l\'email de demande documentaire'}
            </button>
          )}

          {showPreview && (
            <EmailPreviewModal
              isOpen={showPreview}
              onClose={() => setShowPreview(false)}
              onSend={sendRequest}
              subject={
                isCreation
                  ? `[${cabinet.nom}] Création d'entreprise — Documents requis`
                  : `[${cabinet.nom}] Documents requis pour l'ouverture de votre dossier`
              }
              recipient={clientData.email}
              recipientName={clientData.nom}
              htmlContent={
                isCreation
                  ? buildCreationDocumentRequestEmail({
                      clientName: clientData.nom,
                      cabinetName: cabinet.nom,
                      uploadLink: clientData.sharepointUploadLink,
                      denomination: clientData.denominationCreation || clientData.nom,
                      formeJuridique: clientData.formeJuridiqueCreation || 'SAS',
                      documents: documentsRequis,
                    })
                  : buildDocumentRequestEmail({
                      clientName: clientData.nom,
                      cabinetName: cabinet.nom,
                      uploadLink: clientData.sharepointUploadLink,
                      documents: documentsRequis,
                    })
              }
              senderName={cabinet.nom}
              senderEmail={emailConfig.fromEmail}
            />
          )}

          {/* Documents request sent */}
          {phase !== 'ready' && phase !== 'preview' && clientData.documentDemandeSent && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <p className="text-sm font-medium text-emerald-800">Email de demande documentaire envoyé</p>
                {emailResult?.demo && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Mode démo</span>
                )}
              </div>
              <p className="text-xs text-emerald-700">
                {isCreation
                  ? `Demande de pièces pour la création envoyée à ${clientData.email}. Le client peut déposer via SharePoint.`
                  : `Email avec liste de documents et lien SharePoint envoyé à ${clientData.email}.`}
              </p>
            </div>
          )}

          {/* ═══ SECTION 2 (CRÉATION UNIQUEMENT) : Mandat de création ═══ */}
          {isCreation && clientData.documentDemandeSent && (
            <div className="border-t border-gray-100 pt-4 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  clientData.mandatCreationSigne ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {clientData.mandatCreationSigne ? '✓' : '2'}
                </div>
                <p className="text-sm font-medium text-gray-800">Mandat de réalisation des formalités de création</p>
              </div>

              {!clientData.mandatCreationEnvoye && phase === 'sent' && (
                <div className="space-y-3">
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <PenLine className="w-4 h-4 text-blue-600" />
                      <p className="text-xs font-medium text-blue-800">Mandat personnalisable (modèle cabinet)</p>
                    </div>
                    <p className="text-xs text-blue-700">
                      Le mandat autorise le cabinet à accomplir les formalités d'immatriculation auprès du guichet unique (INPI),
                      rédiger les statuts, publier l'annonce légale et effectuer les déclarations fiscales et sociales.
                    </p>
                  </div>
                  <button
                    onClick={sendMandat}
                    className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white py-3 rounded-xl text-sm font-medium transition-all shadow-sm"
                  >
                    <Send className="w-4 h-4" />
                    Envoyer le mandat de création au client (Yousign)
                  </button>
                </div>
              )}

              {phase === 'mandat_sending' && (
                <div className="space-y-2.5">
                  <AutoTask label="Génération du mandat de création (modèle cabinet)" status="done" />
                  <AutoTask label="Envoi au client pour signature (Yousign)" status="loading" sublabel={`Email → ${clientData.email}`} />
                </div>
              )}

              {clientData.mandatCreationEnvoye && (
                <div className={`border rounded-xl p-4 ${clientData.mandatCreationSigne ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      {clientData.mandatCreationSigne ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <PenLine className="w-4 h-4 text-amber-600" />
                      )}
                      <p className={`text-sm font-medium ${clientData.mandatCreationSigne ? 'text-emerald-800' : 'text-amber-800'}`}>
                        {clientData.mandatCreationSigne ? 'Mandat de création signé' : 'En attente de signature du mandat'}
                      </p>
                    </div>
                    {!clientData.mandatCreationSigne && (
                      <button
                        onClick={simulateSignMandat}
                        className="text-xs bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 px-3 py-1.5 rounded-lg transition-all"
                      >
                        Simuler signature client
                      </button>
                    )}
                  </div>
                  {clientData.mandatCreationSigne && (
                    <p className="text-xs text-emerald-700 mt-1">
                      Le client a signé le mandat de réalisation des formalités de création. Le cabinet est autorisé à procéder.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══ SECTION 3 (CRÉATION UNIQUEMENT) : Attestation de non-condamnation ═══ */}
          {isCreation && clientData.mandatCreationSigne && (
            <div className="border-t border-gray-100 pt-4 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  clientData.attestationNonCondamnationRecue ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {clientData.attestationNonCondamnationRecue ? '✓' : '3'}
                </div>
                <p className="text-sm font-medium text-gray-800">Attestation de non-condamnation et de filiation</p>
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                <p className="text-xs text-amber-700">
                  Ce document est <strong>obligatoire</strong> pour toute immatriculation au RCS/RNE. Chaque dirigeant et
                  associé doit fournir une attestation sur l'honneur de non-condamnation et de filiation (art. L123-5-1 du Code de commerce).
                </p>
              </div>

              {!clientData.attestationNonCondamnationEnvoyee && (
                <button
                  onClick={sendAttestation}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-medium transition-all"
                >
                  <Send className="w-4 h-4" />
                  Envoyer le formulaire au client
                </button>
              )}

              {clientData.attestationNonCondamnationEnvoyee && (
                <div className={`border rounded-xl p-4 ${clientData.attestationNonCondamnationRecue ? 'bg-emerald-50 border-emerald-200' : 'bg-blue-50 border-blue-200'}`}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      {clientData.attestationNonCondamnationRecue ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <FileText className="w-4 h-4 text-blue-600" />
                      )}
                      <p className={`text-sm font-medium ${clientData.attestationNonCondamnationRecue ? 'text-emerald-800' : 'text-blue-800'}`}>
                        {clientData.attestationNonCondamnationRecue
                          ? 'Attestation reçue et archivée'
                          : 'Formulaire envoyé — En attente de retour'}
                      </p>
                    </div>
                    {!clientData.attestationNonCondamnationRecue && (
                      <button
                        onClick={simulateAttestationReceived}
                        className="text-xs bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-all"
                      >
                        Simuler réception
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SharePoint info — toujours visible */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-xs font-medium text-blue-800 mb-2">
              {isCreation ? '🏗️ Workflow création d\'entreprise' : '🔗 Classement automatique SharePoint (Microsoft Graph API)'}
            </p>
            <div className="space-y-1 text-xs text-blue-700">
              {isCreation ? (
                <>
                  <p>1. <strong>Demande documentaire</strong> envoyée (pièces d'identité, justificatifs)</p>
                  <p>2. <strong>Mandat de création</strong> signé via Yousign</p>
                  <p>3. <strong>Attestation de non-condamnation</strong> et filiation reçue</p>
                  <p>4. Documents juridiques (statuts, dépôt capital, bénéficiaires) à l'étape suivante</p>
                </>
              ) : (
                <>
                  <p>Event webhook déclenché à chaque dépôt de fichier</p>
                  <p>Azure Logic App : déplace et renomme automatiquement le fichier</p>
                  <p>Destination : /Sites/Clients/{clientData.raisonSociale || '[Client]'}/Documents Légaux/</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </StepShell>
  );
}
