/**
 * EmailCampaignModal — Campagne de cold-emailing depuis le module Prospection
 *
 * Flux en 2 étapes :
 *  1. Composer  — Choix du modèle, édition de l'objet/corps, aperçu live personnalisé
 *  2. Envoi     — Barre de progression + statut par destinataire en temps réel
 *
 * Connexion email : utilise sendEmail() de emailService.ts (Gmail / Outlook / SendGrid).
 * Variables supportées : {{prenom_dirigeant}}, {{nom_dirigeant}}, {{nom_societe}},
 *                        {{secteur}}, {{forme_juridique}}, {{ville}}.
 */

import { useState, useMemo, useRef } from 'react';
import {
  Mail, Send, Check, Loader2, AlertTriangle, Eye, Edit3,
  Zap, CheckCircle2, XCircle, Clock, Info, User,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from './ui/dialog';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { sendEmail } from '../services/emailService';
import { getCabinetInfo, getEmailConfig } from '../utils/servicesStorage';
import { useProspectStore, type ProspectRow } from '../store/useProspectStore';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Sous-ensemble des champs Prospect dont la modale a besoin */
export interface ProspectForCampaign {
  siren: string;
  nomSociete: string;
  formeJuridique: string;
  secteur: string;
  ville: string;
  email: string;
  dirigeantPrincipal: { nom: string; prenom: string; qualite: string } | null;
  icebreakerIa?: string;
}

/** Convert a Supabase ProspectRow to ProspectForCampaign */
function rowToCampaignProspect(p: ProspectRow): ProspectForCampaign {
  return {
    siren:            p.siren ?? '',
    nomSociete:       p.company_name,
    formeJuridique:   p.forme_juridique ?? '',
    secteur:          p.secteur_activite ?? '',
    ville:            p.city ?? '',
    email:            p.contact_email ?? '',
    dirigeantPrincipal: p.dirigeant_principal as { nom: string; prenom: string; qualite: string } | null,
    icebreakerIa:     p.icebreaker_ia ?? undefined,
  };
}

/** Configuration d'une étape de séquence */
export interface SequenceStepConfig {
  /** Délai en jours depuis l'envoi initial */
  delayDays: number;
  subject: string;
  body: string;
  enabled: boolean;
}

interface EmailCampaignModalProps {
  open: boolean;
  onClose: () => void;
  prospects: ProspectForCampaign[];
  /** Appelé après envoi avec le nombre d'emails effectivement envoyés et la config séquence */
  onSent?: (count: number, sequenceSteps: SequenceStepConfig[]) => void;
}

interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  emoji: string;
  subject: string;
  /** Corps en texte/HTML avec {{variables}} */
  body: string;
}

type SendStatus = 'pending' | 'sending' | 'sent' | 'error' | 'skipped';

interface SendResult {
  status: SendStatus;
  error?: string;
}

type Step = 'compose' | 'sending' | 'done';

// ─── Modèles d'email intégrés ─────────────────────────────────────────────────

const BUILT_IN_TEMPLATES: EmailTemplate[] = [
  {
    id: 'prise-contact',
    name: 'Prise de contact initiale',
    description: 'Email de prospection standard, bienveillant et professionnel.',
    emoji: '👋',
    subject: 'Optimisation comptable pour {{nom_societe}}',
    body: `<p>Bonjour {{prenom_dirigeant}},</p>

<p>Je me permets de vous contacter à propos de <strong>{{nom_societe}}</strong>.</p>

<p>Notre cabinet d'expertise comptable accompagne de nombreux dirigeants dans le secteur <em>{{secteur}}</em>, et nous avons développé une expertise précise des enjeux spécifiques à votre activité.</p>

<p>Nous proposons notamment :</p>
<ul>
  <li>La tenue et supervision de votre comptabilité</li>
  <li>L'optimisation fiscale adaptée à votre structure ({{forme_juridique}})</li>
  <li>Un accompagnement dans vos décisions de gestion</li>
</ul>

<p>Seriez-vous disponible pour un échange de 20 minutes afin d'évaluer si nous pouvons vous apporter de la valeur ?</p>

<p>Dans l'attente de vous lire,</p>`,
  },
  {
    id: 'proposition-rdv',
    name: 'Proposition de rendez-vous',
    description: 'Email court et direct pour décrocher un premier rendez-vous.',
    emoji: '📅',
    subject: 'Échange rapide — {{nom_societe}} & notre cabinet',
    body: `<p>Bonjour {{prenom_dirigeant}} {{nom_dirigeant}},</p>

<p>Je souhaitais prendre contact avec vous directement.</p>

<p>Nous travaillons avec plusieurs {{forme_juridique}} basées à <strong>{{ville}}</strong> et dans le secteur <em>{{secteur}}</em>. Nos retours d'expérience pourraient vous être utiles.</p>

<p>Seriez-vous ouvert à un appel de 15 minutes cette semaine ou la suivante ? Je m'adapte entièrement à vos disponibilités.</p>

<p>Bien à vous,</p>`,
  },
  {
    id: 'presentation-services',
    name: 'Présentation services secteur',
    description: 'Présentation personnalisée sur le secteur d\'activité du prospect.',
    emoji: '📊',
    subject: 'Notre expertise {{secteur}} au service de {{nom_societe}}',
    body: `<p>Bonjour {{prenom_dirigeant}},</p>

<p>Notre cabinet comptable a une forte présence dans le secteur <strong>{{secteur}}</strong> et accompagne de nombreuses structures comme <em>{{nom_societe}}</em>.</p>

<p>Nous connaissons parfaitement :</p>
<ul>
  <li>Les spécificités fiscales et sociales de votre secteur</li>
  <li>Les opportunités d'optimisation pour les {{forme_juridique}}</li>
  <li>Les échéances réglementaires à ne pas manquer</li>
</ul>

<p>Je serais ravi de vous présenter nos services lors d'un rendez-vous téléphonique ou en présentiel à <strong>{{ville}}</strong>.</p>

<p>N'hésitez pas à me répondre directement à cet email.</p>

<p>Cordialement,</p>`,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Remplace {{variables}} dans le corps (HTML) par les valeurs HTML-échappées */
function substituteBodyVars(body: string, prospect: ProspectForCampaign): string {
  const vars: Record<string, string> = {
    prenom_dirigeant:  escapeHtml(prospect.dirigeantPrincipal?.prenom ?? ''),
    nom_dirigeant:     escapeHtml(prospect.dirigeantPrincipal?.nom ?? ''),
    nom_societe:       escapeHtml(prospect.nomSociete),
    secteur:           escapeHtml(prospect.secteur),
    forme_juridique:   escapeHtml(prospect.formeJuridique),
    ville:             escapeHtml(prospect.ville),
    icebreaker_ia:     escapeHtml(prospect.icebreakerIa ?? ''),
  };
  return body.replace(/\{\{([^}]+)\}\}/g, (_, key) => vars[key.trim()] ?? `{{${key}}}`);
}

/** Remplace {{variables}} dans l'objet (texte simple) */
function substituteSubjectVars(subject: string, prospect: ProspectForCampaign): string {
  const vars: Record<string, string> = {
    prenom_dirigeant:  prospect.dirigeantPrincipal?.prenom ?? '',
    nom_dirigeant:     prospect.dirigeantPrincipal?.nom ?? '',
    nom_societe:       prospect.nomSociete,
    secteur:           prospect.secteur,
    forme_juridique:   prospect.formeJuridique,
    ville:             prospect.ville,
    icebreaker_ia:     prospect.icebreakerIa ?? '',
  };
  return subject.replace(/\{\{([^}]+)\}\}/g, (_, key) => vars[key.trim()] ?? `{{${key}}}`);
}

/**
 * Enveloppe le corps dans un template HTML email complet.
 * Inclut un pixel de tracking invisible (1×1 px) pour détecter les ouvertures.
 * @param body        Corps HTML de l'email
 * @param trackingId  Identifiant unique (SIREN encodé) pour le pixel de tracking
 */
function buildEmailHtml(body: string, trackingId?: string): string {
  const cabinet = getCabinetInfo();
  const expertLine = [cabinet.expertNom, 'Expert-Comptable'].filter(Boolean).join(' — ');
  const contactLine = [cabinet.telephone, cabinet.expertEmail].filter(Boolean).join(' | ');
  const addressLine = [cabinet.adresse, cabinet.codePostal, cabinet.ville].filter(Boolean).join(' ');

  const trackingBase = typeof window !== 'undefined' ? window.location.origin : '';
  const trackingPixel = trackingId && trackingBase
    ? `<img src="${trackingBase}/api/track-open?id=${encodeURIComponent(trackingId)}" width="1" height="1" style="display:block;width:1px;height:1px;border:0;" alt="" />`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.12);">
        <!-- Header -->
        <tr>
          <td style="background:#1e3a5f;padding:24px 32px;">
            <p style="margin:0;font-size:18px;font-weight:bold;color:#ffffff;">${escapeHtml(cabinet.nom || 'Cabinet Comptable')}</p>
            ${addressLine ? `<p style="margin:4px 0 0;font-size:12px;color:#94b4d4;">${escapeHtml(addressLine)}</p>` : ''}
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;font-size:14px;line-height:1.7;color:#333333;">
            ${body}
          </td>
        </tr>
        <!-- Signature -->
        <tr>
          <td style="padding:0 32px 32px;font-size:13px;color:#555555;border-top:1px solid #eeeeee;">
            <p style="margin:16px 0 4px;font-weight:bold;color:#1e3a5f;">${escapeHtml(expertLine)}</p>
            ${cabinet.nom ? `<p style="margin:0 0 2px;">${escapeHtml(cabinet.nom)}</p>` : ''}
            ${contactLine ? `<p style="margin:0;color:#888;">${escapeHtml(contactLine)}</p>` : ''}
          </td>
        </tr>
        <!-- Tracking pixel -->
        ${trackingPixel ? `<tr><td>${trackingPixel}</td></tr>` : ''}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

const PROVIDER_LABEL: Record<string, string> = {
  google:    'Gmail',
  microsoft: 'Outlook',
  sendgrid:  'SendGrid',
};

export function EmailCampaignModal({
  open, onClose, prospects, onSent,
}: EmailCampaignModalProps) {

  const [step, setStep]                       = useState<Step>('compose');
  const [templateId, setTemplateId]           = useState(BUILT_IN_TEMPLATES[0].id);
  const [customSubject, setCustomSubject]     = useState(BUILT_IN_TEMPLATES[0].subject);
  const [customBody, setCustomBody]           = useState(BUILT_IN_TEMPLATES[0].body);
  const [bodyTab, setBodyTab]                 = useState<'edit' | 'preview'>('edit');
  const [results, setResults]                 = useState<Record<string, SendResult>>({});
  const sendingRef                            = useRef(false);
  const [selectedColumn, setSelectedColumn]   = useState<string>('');

  // Read store prospects for column-based targeting
  const storeProspects = useProspectStore(state => state.prospects);

  // Active prospect list: use store column filter when set, otherwise use prop
  const activeProspects: ProspectForCampaign[] = useMemo(() => {
    if (selectedColumn) {
      return storeProspects
        .filter(p => p.kanban_column === selectedColumn)
        .map(rowToCampaignProspect);
    }
    return prospects;
  }, [selectedColumn, storeProspects, prospects]);

  // ── Sequence steps state (Chantier 6) ─────────────────────────────────────
  const [sequenceSteps, setSequenceSteps] = useState<SequenceStepConfig[]>([
    { delayDays: 4,  subject: 'Relance — {{nom_societe}}', body: `<p>Bonjour {{prenom_dirigeant}},</p>\n\n<p>Je me permets de revenir vers vous suite à mon précédent message concernant <strong>{{nom_societe}}</strong>.</p>\n\n<p>Avez-vous eu l'occasion de le consulter ? Je serais ravi d'échanger avec vous quelques minutes.</p>\n\n<p>Cordialement,</p>`, enabled: true },
    { delayDays: 10, subject: 'Dernière relance — {{nom_societe}}', body: `<p>Bonjour {{prenom_dirigeant}},</p>\n\n<p>Je me permets de vous envoyer ce dernier message. Si vous n'êtes pas intéressé(e), je comprends tout à fait.</p>\n\n<p>Si le moment est venu, je reste disponible pour un échange sur votre comptabilité chez <strong>{{nom_societe}}</strong>.</p>\n\n<p>Belle journée,</p>`, enabled: true },
  ]);
  const [showSequenceConfig, setShowSequenceConfig] = useState(false);

  // Reset to compose when modal opens
  const resetCompose = () => {
    setStep('compose');
    setResults({});
    sendingRef.current = false;
    setSelectedColumn('');
    const tpl = BUILT_IN_TEMPLATES[0];
    setTemplateId(tpl.id);
    setCustomSubject(tpl.subject);
    setCustomBody(tpl.body);
    setBodyTab('edit');
  };

  const handleOpenChange = (o: boolean) => {
    if (!o && step !== 'sending') { resetCompose(); onClose(); }
    if (!o && step === 'done') { resetCompose(); onClose(); }
  };

  // Select a template → populate editor
  function selectTemplate(tpl: EmailTemplate) {
    setTemplateId(tpl.id);
    setCustomSubject(tpl.subject);
    setCustomBody(tpl.body);
  }

  // Preview data: first prospect that has a dirigeant principal
  const previewProspect = useMemo(
    () => activeProspects.find(p => p.dirigeantPrincipal) ?? activeProspects[0] ?? null,
    [activeProspects],
  );

  const emailConfig = getEmailConfig();
  const prospectsWithEmail    = activeProspects.filter(p => p.email);
  const prospectsWithoutEmail = activeProspects.filter(p => !p.email);

  const enabledSequenceSteps = sequenceSteps.filter(s => s.enabled);

  // ── Sending logic ─────────────────────────────────────────────────────────

  async function handleSend() {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setStep('sending');

    // Mark skipped (no email)
    const initialResults: Record<string, SendResult> = {};
    activeProspects.forEach(p => {
      initialResults[p.siren] = p.email
        ? { status: 'pending' }
        : { status: 'skipped' };
    });
    setResults(initialResults);

    let sentCount = 0;

    for (const prospect of prospectsWithEmail) {
      // Mark as sending
      setResults(prev => ({ ...prev, [prospect.siren]: { status: 'sending' } }));

      const subject     = substituteSubjectVars(customSubject, prospect);
      const body        = substituteBodyVars(customBody, prospect);
      // Tracking ID: SIREN + timestamp for open tracking pixel (Chantier 7)
      const trackingId  = `${prospect.siren}_${Date.now()}`;
      const htmlContent = buildEmailHtml(body, trackingId);
      const toName      = [
        prospect.dirigeantPrincipal?.prenom,
        prospect.dirigeantPrincipal?.nom,
      ].filter(Boolean).join(' ');

      const result = await sendEmail({ to: prospect.email, toName, subject, htmlContent });

      if (result.success) {
        sentCount++;
        setResults(prev => ({ ...prev, [prospect.siren]: { status: 'sent' } }));
      } else {
        setResults(prev => ({
          ...prev,
          [prospect.siren]: { status: 'error', error: result.error ?? 'Erreur inconnue' },
        }));
      }
    }

    setStep('done');
    onSent?.(sentCount, enabledSequenceSteps);
    sendingRef.current = false;
  }

  // ── Computed stats ────────────────────────────────────────────────────────

  const sentCount    = Object.values(results).filter(r => r.status === 'sent').length;
  const errorCount   = Object.values(results).filter(r => r.status === 'error').length;
  const sendingCount = Object.values(results).filter(r => r.status === 'sending').length;
  const doneCount    = sentCount + errorCount + Object.values(results).filter(r => r.status === 'skipped').length;
  const progress     = activeProspects.length > 0 ? Math.round((doneCount / activeProspects.length) * 100) : 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">

        {/* ── Header ── */}
        <DialogHeader className="flex-shrink-0 px-6 py-5 border-b border-gray-100 bg-white">
          <DialogTitle className="flex items-center gap-2.5 text-base font-semibold text-gray-900">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Mail className="w-4 h-4 text-white" />
            </div>
            {step === 'compose' && <>Campagne d'emails — {activeProspects.length} prospect{activeProspects.length !== 1 ? 's' : ''}</>}
            {step === 'sending' && <>Envoi en cours… ({sentCount + errorCount} / {prospectsWithEmail.length})</>}
            {step === 'done'    && <>Campagne terminée</>}
          </DialogTitle>

          {/* Config badge */}
          <div className={`flex items-center gap-1.5 text-xs mt-1 ${emailConfig.isDemo ? 'text-amber-600' : 'text-emerald-600'}`}>
            {emailConfig.isDemo
              ? <><AlertTriangle className="w-3.5 h-3.5" /> Mode démo — les emails ne seront pas réellement envoyés</>
              : <><Check className="w-3.5 h-3.5" /> Connecté via {PROVIDER_LABEL[emailConfig.provider ?? ''] ?? emailConfig.provider} ({emailConfig.fromEmail})</>
            }
          </div>
        </DialogHeader>

        {/* ══ STEP 1 — Compose ══════════════════════════════════════════════ */}
        {step === 'compose' && (
          <div className="flex flex-1 overflow-hidden">

            {/* Left — Template editor */}
            <div className="w-[55%] flex flex-col border-r border-gray-100 overflow-y-auto">
              <div className="px-6 py-5 space-y-5 flex-1">

                {/* Column / audience selector — from store */}
                <div className="space-y-2 pb-2 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> Cible de la campagne
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setSelectedColumn('')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        !selectedColumn
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      Sélection manuelle ({prospects.length})
                    </button>
                    {[
                      { col: 'a-contacter',    label: '📋 À contacter' },
                      { col: 'email-envoye',   label: '📧 Email envoyé' },
                      { col: 'en-negociation', label: '🤝 En négociation' },
                      { col: 'gagne',          label: '🏆 Gagné' },
                      { col: 'perdu',          label: '❌ Perdu' },
                    ].map(({ col, label }) => {
                      const count = storeProspects.filter(p => p.kanban_column === col).length;
                      if (count === 0) return null;
                      return (
                        <button
                          key={col}
                          onClick={() => setSelectedColumn(col)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            selectedColumn === col
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {label} ({count})
                        </button>
                      );
                    })}
                  </div>
                  {selectedColumn && (
                    <p className="text-xs text-blue-600 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      {activeProspects.length} prospect{activeProspects.length !== 1 ? 's' : ''} ciblé{activeProspects.length !== 1 ? 's' : ''} depuis le Kanban
                    </p>
                  )}
                </div>

                {/* Template selection */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    1. Choisir un modèle
                  </p>
                  <div className="space-y-2">
                    {BUILT_IN_TEMPLATES.map(tpl => (
                      <button
                        key={tpl.id}
                        onClick={() => selectTemplate(tpl)}
                        className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg border text-left transition-all ${
                          templateId === tpl.id
                            ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-300'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <span className="text-lg flex-shrink-0 mt-0.5">{tpl.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${templateId === tpl.id ? 'text-blue-800' : 'text-gray-800'}`}>
                            {tpl.name}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5 truncate">{tpl.description}</p>
                        </div>
                        {templateId === tpl.id && (
                          <Check className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subject */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    2. Objet de l'email
                  </p>
                  <Input
                    value={customSubject}
                    onChange={e => setCustomSubject(e.target.value)}
                    className="h-9 text-sm"
                    placeholder="Objet de l'email…"
                  />
                  {/* Subject preview */}
                  {previewProspect && (
                    <p className="text-xs text-gray-400 italic">
                      Aperçu : « {substituteSubjectVars(customSubject, previewProspect)} »
                    </p>
                  )}
                </div>

                {/* Body editor */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      3. Corps de l'email
                    </p>
                    <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                      <button
                        onClick={() => setBodyTab('edit')}
                        className={`flex items-center gap-1 px-2.5 py-1 text-xs transition-colors ${bodyTab === 'edit' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                      >
                        <Edit3 className="w-3 h-3" /> Éditer
                      </button>
                      <button
                        onClick={() => setBodyTab('preview')}
                        className={`flex items-center gap-1 px-2.5 py-1 text-xs transition-colors ${bodyTab === 'preview' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                      >
                        <Eye className="w-3 h-3" /> Aperçu
                      </button>
                    </div>
                  </div>

                  {bodyTab === 'edit' ? (
                    <div className="relative">
                      <Textarea
                        value={customBody}
                        onChange={e => setCustomBody(e.target.value)}
                        className="min-h-[180px] text-sm font-mono resize-none"
                        placeholder="Corps de l'email (HTML autorisé)…"
                      />
                    </div>
                  ) : (
                    <div
                      className="min-h-[180px] border border-gray-200 rounded-md px-3 py-2 text-sm bg-gray-50 overflow-y-auto leading-relaxed"
                      dangerouslySetInnerHTML={{
                        __html: previewProspect
                          ? substituteBodyVars(customBody, previewProspect)
                          : customBody,
                      }}
                    />
                  )}

                  {/* Variable legend */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      ['{{prenom_dirigeant}}', 'Prénom dirigeant'],
                      ['{{nom_dirigeant}}', 'Nom dirigeant'],
                      ['{{nom_societe}}', 'Nom société'],
                      ['{{secteur}}', 'Secteur'],
                      ['{{forme_juridique}}', 'Forme juridique'],
                      ['{{ville}}', 'Ville'],
                      ['{{icebreaker_ia}}', 'Icebreaker IA ✨'],
                    ].map(([variable, label]) => (
                      <button
                        key={variable}
                        onClick={() => setCustomBody(b => b + variable)}
                        title={`Insérer ${label}`}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 border rounded text-xs font-mono hover:opacity-80 transition-colors ${
                          variable === '{{icebreaker_ia}}'
                            ? 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100'
                            : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                        }`}
                      >
                        <Zap className="w-2.5 h-2.5" />
                        {variable}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sequence config (Chantier 6) */}
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => setShowSequenceConfig(v => !v)}
                    className="w-full flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      4. Séquence de relances
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-normal ${enabledSequenceSteps.length > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                      {enabledSequenceSteps.length} relance{enabledSequenceSteps.length !== 1 ? 's' : ''} configurée{enabledSequenceSteps.length !== 1 ? 's' : ''}
                    </span>
                  </button>

                  {showSequenceConfig && (
                    <div className="space-y-3 mt-2">
                      {/* Step J+0 (initial) */}
                      <div className="px-3 py-2.5 rounded-lg border border-blue-200 bg-blue-50">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-blue-700 bg-blue-200 px-2 py-0.5 rounded-full">J+0</span>
                          <p className="text-xs font-medium text-blue-700">Email initial (en cours d'édition)</p>
                        </div>
                        <p className="text-[10px] text-blue-500 italic truncate">Objet : {customSubject || '—'}</p>
                      </div>

                      {/* Follow-up steps */}
                      {sequenceSteps.map((seq, idx) => (
                        <div key={idx} className={`px-3 py-2.5 rounded-lg border ${seq.enabled ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${seq.enabled ? 'bg-amber-200 text-amber-700' : 'bg-gray-200 text-gray-500'}`}>
                              J+{seq.delayDays}
                            </span>
                            <p className="text-xs font-medium text-gray-700 flex-1">Relance {idx + 1}</p>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={seq.enabled}
                                onChange={e => setSequenceSteps(prev => prev.map((s, i) => i === idx ? { ...s, enabled: e.target.checked } : s))}
                                className="w-3.5 h-3.5"
                              />
                              <span className="text-[10px] text-gray-500">Activée</span>
                            </label>
                          </div>
                          {seq.enabled && (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-400 w-16 flex-shrink-0">Délai (j)</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={30}
                                  value={seq.delayDays}
                                  onChange={e => setSequenceSteps(prev => prev.map((s, i) => i === idx ? { ...s, delayDays: Number(e.target.value) } : s))}
                                  className="w-16 h-6 text-xs border border-amber-200 rounded px-1.5 bg-white"
                                />
                                <span className="text-[10px] text-gray-400">jours après J+0</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-400 w-16 flex-shrink-0">Objet</span>
                                <input
                                  type="text"
                                  value={seq.subject}
                                  onChange={e => setSequenceSteps(prev => prev.map((s, i) => i === idx ? { ...s, subject: e.target.value } : s))}
                                  className="flex-1 h-6 text-xs border border-amber-200 rounded px-1.5 bg-white"
                                  placeholder="Objet de la relance…"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      <p className="text-[10px] text-gray-400 italic">
                        💡 Les relances seront planifiées automatiquement si le prospect ne répond pas.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right — Live preview */}
            <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
              <div className="px-5 py-4 border-b border-gray-100 bg-white">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" /> Aperçu — {previewProspect?.nomSociete ?? 'aucun prospect'}
                </p>
              </div>

              {previewProspect ? (
                <div className="flex-1 overflow-y-auto p-5">
                  {/* Recipient */}
                  <div className="flex items-center gap-2 mb-4 p-3 bg-white rounded-lg border border-gray-200">
                    <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-700 truncate">
                        {previewProspect.dirigeantPrincipal
                          ? `${previewProspect.dirigeantPrincipal.prenom} ${previewProspect.dirigeantPrincipal.nom}`
                          : previewProspect.nomSociete
                        }
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {previewProspect.email || <span className="italic text-amber-500">Pas d'email</span>}
                      </p>
                    </div>
                  </div>

                  {/* Subject */}
                  <div className="mb-3 px-3 py-2 bg-white rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-400">Objet</p>
                    <p className="text-sm font-medium text-gray-800 mt-0.5">
                      {substituteSubjectVars(customSubject, previewProspect)}
                    </p>
                  </div>

                  {/* Body preview */}
                  <div
                    className="bg-white rounded-lg border border-gray-200 px-4 py-4 text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: substituteBodyVars(customBody, previewProspect),
                    }}
                  />
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                  Aucun prospect sélectionné
                </div>
              )}

              {/* Prospects without email warning */}
              {prospectsWithoutEmail.length > 0 && (
                <div className="mx-5 mb-5 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-700">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>{prospectsWithoutEmail.length} prospect{prospectsWithoutEmail.length !== 1 ? 's' : ''}</strong> sans email seront ignorés lors de l'envoi.
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ STEP 2 / 3 — Sending / Done ══════════════════════════════════ */}
        {(step === 'sending' || step === 'done') && (
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Progress bar */}
            <div className="px-6 pt-5 pb-3 flex-shrink-0 space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{sendingCount > 0 ? 'Envoi en cours…' : step === 'done' ? 'Terminé' : 'En attente…'}</span>
                <span>{doneCount} / {prospects.length}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {step === 'done' && (
                <div className="flex items-center gap-4 pt-1">
                  <span className="flex items-center gap-1 text-xs text-emerald-600">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {sentCount} envoyé{sentCount !== 1 ? 's' : ''}
                  </span>
                  {errorCount > 0 && (
                    <span className="flex items-center gap-1 text-xs text-red-500">
                      <XCircle className="w-3.5 h-3.5" /> {errorCount} erreur{errorCount !== 1 ? 's' : ''}
                    </span>
                  )}
                  {prospectsWithoutEmail.length > 0 && (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Info className="w-3.5 h-3.5" /> {prospectsWithoutEmail.length} ignoré{prospectsWithoutEmail.length !== 1 ? 's' : ''} (sans email)
                    </span>
                  )}
                  {emailConfig.isDemo && (
                    <span className="flex items-center gap-1 text-xs text-amber-500">
                      <AlertTriangle className="w-3.5 h-3.5" /> Mode démo
                    </span>
                  )}
                  {step === 'done' && enabledSequenceSteps.length > 0 && (
                    <span className="flex items-center gap-1 text-xs text-blue-500">
                      <Clock className="w-3.5 h-3.5" /> {enabledSequenceSteps.length} relance{enabledSequenceSteps.length !== 1 ? 's' : ''} planifiée{enabledSequenceSteps.length !== 1 ? 's' : ''} (J+{enabledSequenceSteps.map(s => s.delayDays).join(', J+')})
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Per-prospect status list */}
            <div className="flex-1 overflow-y-auto px-6 pb-4">
              <ul className="space-y-2">
                {activeProspects.map(prospect => {
                  const result = results[prospect.siren];
                  const status = result?.status ?? 'pending';
                  return (
                    <li
                      key={prospect.siren}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm transition-colors ${
                        status === 'sent'    ? 'bg-emerald-50 border-emerald-200'    :
                        status === 'error'   ? 'bg-red-50 border-red-200'            :
                        status === 'sending' ? 'bg-blue-50 border-blue-200 animate-pulse' :
                        status === 'skipped' ? 'bg-gray-50 border-gray-200 opacity-50' :
                        'bg-white border-gray-200'
                      }`}
                    >
                      {/* Status icon */}
                      <span className="flex-shrink-0">
                        {status === 'sent'    && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                        {status === 'error'   && <XCircle      className="w-4 h-4 text-red-400"     />}
                        {status === 'sending' && <Loader2      className="w-4 h-4 text-blue-500 animate-spin" />}
                        {status === 'skipped' && <Info         className="w-4 h-4 text-gray-400"    />}
                        {status === 'pending' && <Clock        className="w-4 h-4 text-gray-300"    />}
                      </span>

                      {/* Prospect info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 truncate">{prospect.nomSociete}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {prospect.dirigeantPrincipal
                            ? `${prospect.dirigeantPrincipal.prenom} ${prospect.dirigeantPrincipal.nom}`
                            : '—'
                          }
                          {prospect.email
                            ? ` · ${prospect.email}`
                            : <span className="text-amber-500 ml-1">· Pas d'adresse email</span>
                          }
                        </p>
                      </div>

                      {/* Status label */}
                      <span className={`text-xs font-medium flex-shrink-0 ${
                        status === 'sent'    ? 'text-emerald-600' :
                        status === 'error'   ? 'text-red-500'     :
                        status === 'sending' ? 'text-blue-600'    :
                        status === 'skipped' ? 'text-gray-400'    :
                        'text-gray-300'
                      }`}>
                        {status === 'sent'    && '✓ Envoyé'}
                        {status === 'error'   && (result?.error ? `Erreur : ${result.error.slice(0, 55)}…` : 'Erreur')}
                        {status === 'sending' && 'Envoi…'}
                        {status === 'skipped' && 'Ignoré'}
                        {status === 'pending' && 'En attente'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <DialogFooter className="flex-shrink-0 px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          {step === 'compose' && (
            <>
              <button
                onClick={() => { resetCompose(); onClose(); }}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSend}
                disabled={prospectsWithEmail.length === 0}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                  prospectsWithEmail.length > 0
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Send className="w-4 h-4" />
                Lancer la campagne
                <span className="ml-1 bg-white/25 text-white text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">
                  {prospectsWithEmail.length}
                </span>
              </button>
            </>
          )}
          {step === 'sending' && (
            <p className="text-xs text-gray-400 italic w-full text-center">
              Envoi en cours, ne fermez pas cette fenêtre…
            </p>
          )}
          {step === 'done' && (
            <button
              onClick={() => { resetCompose(); onClose(); }}
              className="ml-auto flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              <Check className="w-4 h-4" /> Fermer
            </button>
          )}
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
