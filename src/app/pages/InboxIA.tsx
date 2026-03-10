import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  Mail, CheckCircle2, XCircle, Edit3, RefreshCw, Clock, ArrowLeft, Send,
  Wifi, WifiOff, InboxIcon, MailCheck, BookOpen, Copy, Printer, ExternalLink,
  AlertTriangle, Frown, FileText, Settings, X, Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { useEmailDraftStore } from '../../components/ai-assistant/useEmailDraftStore';
import { AIEmailDraft, SentimentTag, SystemPromptConfig } from '../../components/ai-assistant/types';
import { useMicrosoftAuth } from '../context/MicrosoftAuthContext';
import { useInboxSync } from '../hooks/useInboxSync';
import DOMPurify from 'dompurify';

type ActiveTab = 'drafts' | 'sent';

// ─── System prompt defaults ────────────────────────────────────────────────────

const DEFAULT_SYSTEM_PROMPTS: SystemPromptConfig = {
  claude: "Tu es un expert-comptable. Rédige des réponses précises, professionnelles et bienveillantes, fondées sur le droit fiscal et social français. Cite les textes légaux applicables (CGI, BOFiP, Code du travail). Formate la réponse en HTML valide.",
  openai: "Tu es un expert-comptable. Rédige des réponses claires et structurées, avec des références légales précises (CGI, BOFiP, URSSAF). Commence toujours par bonjour et termine par une formule de politesse. Formate la réponse en HTML valide.",
  perplexity: "Tu es un assistant IA avec accès à des recherches web en temps réel. Utilise tes capacités de recherche pour fournir des informations fiscales et comptables à jour, en citant les sources et textes réglementaires les plus récents (BOFiP, CGI, jurisprudence). Vérifie toujours l'actualité des références mentionnées.",
};

const LOCAL_STORAGE_PROMPTS_KEY = 'inbox_ia_system_prompts_v2';

// ─── Demo data ────────────────────────────────────────────────────────────────

function buildDemoDrafts(): AIEmailDraft[] {
  const now = new Date();
  const h = (offset: number) => new Date(now.getTime() + offset * 3_600_000).toISOString();

  return [
    {
      id: 'demo1',
      status: 'pending_review',
      clientName: 'SARL Dupont & Fils',
      sentimentTags: ['document_request'],
      original_email: {
        from: 'martin.dupont@dupont-conseil.fr',
        to: 'cabinet@cabinetflow.fr',
        subject: 'Question sur la déductibilité des frais de voiture',
        body: "Bonjour,\n\nJ'aurais voulu savoir si les frais liés à mon véhicule personnel utilisé à titre professionnel sont déductibles de mon résultat imposable, et dans quelles conditions.\n\nMerci d'avance.",
        date: h(-1),
      },
      draft: {
        to: 'martin.dupont@dupont-conseil.fr',
        subject: 'Re: Question sur la déductibilité des frais de voiture',
        body: "<p>Bonjour M. Dupont,</p><p>Je vous remercie pour votre question concernant la déductibilité des frais de véhicule.</p><p>Conformément à l'article 39-1-1° du CGI et à la doctrine BOFiP (BOI-BIC-CHG-20-30), les frais de véhicule utilisé à titre professionnel sont déductibles sous réserve que :</p><ul><li>Le véhicule soit inscrit au bilan de l'entreprise, ou que les frais réels soient justifiés pour un véhicule personnel ;</li><li>L'utilisation professionnelle soit prouvée (carnet de bord, relevés kilométriques) ;</li><li>Pour les véhicules de tourisme, la déduction est plafonnée selon le barème fiscal en vigueur.</li></ul><p>Je vous propose que nous examinions ensemble votre situation lors de notre prochain rendez-vous.</p><p>Cordialement,</p>",
        generatedAt: h(-1),
      },
      bofip_sources_cited: [
        { title: 'Frais de véhicule', reference: 'BOI-BIC-CHG-20-30', url: 'https://bofip.impots.gouv.fr/bofip/4849-PGP' },
        { title: 'Charges déductibles', reference: 'CGI art. 39-1-1°', url: 'https://bofip.impots.gouv.fr/bofip/1072-PGP' },
      ],
      createdAt: h(-1),
      updatedAt: h(-1),
    },
    {
      id: 'demo2',
      status: 'pending_review',
      clientName: 'SAS Technova',
      sentimentTags: ['urgent'],
      original_email: {
        from: 'contact@technova.fr',
        to: 'cabinet@cabinetflow.fr',
        subject: 'Régime TVA — passage au réel normal',
        body: "Bonjour,\n\nNotre CA a dépassé 840 000 € cette année. Devons-nous passer au régime réel normal de TVA ? À partir de quand ?\n\nBien cordialement",
        date: h(-2),
      },
      draft: {
        to: 'contact@technova.fr',
        subject: 'Re: Régime TVA — passage au réel normal',
        body: "<p>Bonjour,</p><p>En effet, le dépassement du seuil de 840 000 € de chiffre d'affaires entraîne la sortie du régime simplifié d'imposition (RSI) de TVA.</p><p>Conformément à l'article 302 septies A bis du CGI (BOI-TVA-DECLA-20-20-10), le passage au régime réel normal intervient de plein droit à compter du 1er janvier de l'année suivant le dépassement, avec obligation de dépôt mensuel de la déclaration CA3.</p><p>Nous prendrons en charge ce changement de régime et vous contacterons prochainement.</p><p>Cordialement,</p>",
        generatedAt: h(-2),
      },
      bofip_sources_cited: [
        { title: "Régimes d'imposition TVA", reference: 'BOI-TVA-DECLA-20-20-10', url: 'https://bofip.impots.gouv.fr/bofip/2668-PGP' },
      ],
      createdAt: h(-2),
      updatedAt: h(-2),
    },
    {
      id: 'demo3',
      status: 'approved',
      clientName: 'EURL Martin Conseil',
      sentimentTags: ['unhappy'],
      original_email: {
        from: 'contact@martin-conseil.fr',
        to: 'cabinet@cabinetflow.fr',
        subject: 'Cotisations TNS 2026',
        body: 'Pouvez-vous me donner une estimation de mes cotisations TNS pour 2026 ? Je suis très mécontent de ne pas avoir eu de réponse depuis 2 semaines.',
        date: h(-3),
      },
      draft: {
        to: 'contact@martin-conseil.fr',
        subject: 'Re: Cotisations TNS 2026',
        body: "<p>Bonjour M. Martin,</p><p>Pour 2026, vos cotisations TNS sont calculées sur la base de votre revenu professionnel N-2, avec régularisation en N+1.</p><p>Les taux principaux (URSSAF 2026) sont : maladie 6,5 %, retraite de base 17,75 %, retraite complémentaire 7 %, invalidité-décès 1,3 %, CSG/CRDS 9,7 %.</p><p>Je vous préparerai une estimation personnalisée dès réception de votre résultat prévisionnel 2025.</p><p>Cordialement,</p>",
        generatedAt: h(-3),
      },
      bofip_sources_cited: [],
      createdAt: h(-3),
      updatedAt: h(-3),
    },
    {
      id: 'demo_sent1',
      status: 'sent',
      clientName: 'Cabinet Lefebvre & Associés',
      original_email: {
        from: 'contact@lefebvre-associes.fr',
        to: 'cabinet@cabinetflow.fr',
        subject: 'Provision pour congés payés — comptabilisation',
        body: "Bonjour,\n\nDans le cadre de notre clôture d'exercice, pouvez-vous me confirmer les modalités de comptabilisation de la provision pour congés payés et de sa déductibilité fiscale ?\n\nCordialement,\nMaître Lefebvre",
        date: h(-26),
      },
      draft: {
        to: 'contact@lefebvre-associes.fr',
        subject: "Re: Provision pour congés payés — comptabilisation",
        body: "<p>Bonjour Maître Lefebvre,</p><p>La provision pour congés payés doit être comptabilisée en charges à payer (compte 4282) lors de la clôture annuelle, conformément au Plan Comptable Général.</p><p><strong>Sur le plan fiscal :</strong> Cette provision est déductible dès l'exercice de comptabilisation, sous réserve qu'elle corresponde à des droits acquis et non encore pris au 31/12 (BOI-BIC-PROV-30-10-20).</p><p><strong>Calcul :</strong> La provision inclut le salaire brut des congés acquis non pris, majoré des charges patronales afférentes.</p><p>Nous intégrerons cette écriture dans votre dossier de clôture.</p><p>Cordialement,</p>",
        generatedAt: h(-25),
      },
      bofip_sources_cited: [
        { title: 'Provisions — Congés payés', reference: 'BOI-BIC-PROV-30-10-20', url: 'https://bofip.impots.gouv.fr/bofip/1762-PGP' },
        { title: 'PCG — Charges à payer', reference: 'PCG art. 322-1', url: 'https://bofip.impots.gouv.fr/bofip/6252-PGP' },
      ],
      createdAt: h(-26),
      updatedAt: h(-25),
    },
  ];
}

// ─── Sentiment analysis ────────────────────────────────────────────────────────

/**
 * Analyse the body and subject of an email to detect sentiment signals.
 * Returns an array of detected SentimentTag values.
 */
export function analyzeSentiment(subject: string, body: string): SentimentTag[] {
  const text = `${subject} ${body}`.toLowerCase();
  const tags = new Set<SentimentTag>();

  // Urgency signals
  const urgentKeywords = [
    'urgent', 'immédiatement', 'immédiat', 'asap', 'dès que possible',
    'délai', 'délais', 'date limite', 'échéance', 'rapidement', 'au plus vite',
  ];
  if (urgentKeywords.some(kw => text.includes(kw))) {
    tags.add('urgent');
  }

  // Unhappy / dissatisfied signals
  const unhappyKeywords = [
    'mécontent', 'insatisfait', 'déçu', 'déception', 'inacceptable',
    'scandaleux', 'honteux', 'inadmissible', 'pas normal', 'aucune réponse',
    'toujours pas', 'encore une fois', 'relance', 'sans réponse', 'inexcusable',
  ];
  if (unhappyKeywords.some(kw => text.includes(kw))) {
    tags.add('unhappy');
  }

  // Document request signals
  const docKeywords = [
    'document', 'documents', 'pièce', 'pièces', 'justificatif', 'justificatifs',
    'envoyer', 'transmettre', 'fournir', 'attestation', 'relevé', 'relevés',
    'facture', 'bilan', 'liasse', 'déclaration', 'formulaire', 'bulletin',
  ];
  if (docKeywords.some(kw => text.includes(kw))) {
    tags.add('document_request');
  }

  return Array.from(tags);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

/** Extract plain text from an HTML string for clipboard copy. */
function htmlToPlainText(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = DOMPurify.sanitize(html);
  return tmp.textContent ?? '';
}

// ─── Status badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AIEmailDraft['status'] }) {
  if (status === 'pending_review') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
        <Clock className="w-3 h-3" /> À valider
      </span>
    );
  }
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
        <CheckCircle2 className="w-3 h-3" /> Approuvé
      </span>
    );
  }
  if (status === 'sent') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
        <Send className="w-3 h-3" /> Envoyé
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
      <XCircle className="w-3 h-3" /> Rejeté
    </span>
  );
}

// ─── Sentiment badge ──────────────────────────────────────────────────────────

function SentimentBadge({ tag }: { tag: SentimentTag }) {
  if (tag === 'urgent') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
        <AlertTriangle className="w-3 h-3" /> Urgent
      </span>
    );
  }
  if (tag === 'unhappy') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold">
        <Frown className="w-3 h-3" /> Mécontent
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">
      <FileText className="w-3 h-3" /> Demande de document
    </span>
  );
}

function SentimentBadges({ tags }: { tags?: SentimentTag[] }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {tags.map(tag => <SentimentBadge key={tag} tag={tag} />)}
    </div>
  );
}

// ─── System prompt panel ──────────────────────────────────────────────────────

function SystemPromptPanel({
  config,
  onSave,
  onClose,
}: {
  config: SystemPromptConfig;
  onSave: (cfg: SystemPromptConfig) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<SystemPromptConfig>({ ...config });

  const handleSave = () => {
    onSave(draft);
    toast.success('Pré-instructions sauvegardées.');
    onClose();
  };

  const categories: { key: keyof SystemPromptConfig; label: string; icon: string; labelClass: string; borderClass: string; ringClass: string; bgClass: string }[] = [
    { key: 'claude', label: 'Claude (Anthropic)', icon: '🤖', labelClass: 'text-orange-700', borderClass: 'border-orange-200', ringClass: 'focus:ring-orange-300', bgClass: 'bg-orange-50/30' },
    { key: 'openai', label: 'GPT (OpenAI)', icon: '✨', labelClass: 'text-blue-700', borderClass: 'border-blue-200', ringClass: 'focus:ring-blue-300', bgClass: 'bg-blue-50/30' },
    { key: 'perplexity', label: 'Perplexity AI', icon: '🔍', labelClass: 'text-purple-700', borderClass: 'border-purple-200', ringClass: 'focus:ring-purple-300', bgClass: 'bg-purple-50/30' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-600" />
            <h2 className="text-base font-semibold text-gray-900">Pré-instructions IA par fournisseur</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          <p className="text-xs text-gray-500">
            Chaque fournisseur IA peut recevoir une instruction système personnalisée.
            L'instruction du fournisseur actif est automatiquement appliquée lors de la génération de brouillons.
            Configurez le fournisseur actif dans les <strong>Paramètres → Configuration de l'IA</strong>.
          </p>
          {categories.map(({ key, label, icon, labelClass, borderClass, ringClass, bgClass }) => (
            <div key={key}>
              <label className={`block text-xs font-semibold mb-1.5 ${labelClass}`}>
                {icon} {label}
              </label>
              <textarea
                rows={4}
                value={draft[key]}
                onChange={e => setDraft(prev => ({ ...prev, [key]: e.target.value }))}
                className={`w-full p-3 text-sm border ${borderClass} rounded-xl focus:outline-none focus:ring-2 ${ringClass} resize-none ${bgClass} font-mono`}
                placeholder={`Instruction système pour ${label}…`}
              />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Save className="w-3.5 h-3.5" />
            Sauvegarder
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Draft list item ─────────────────────────────────────────────────────────

function DraftListItem({
  draft,
  selected,
  onSelect,
}: {
  draft: AIEmailDraft;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${selected ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-sm font-medium text-gray-900 truncate">{draft.clientName}</p>
        <StatusBadge status={draft.status} />
      </div>
      <p className="text-xs text-gray-600 truncate">{draft.original_email.subject ?? '(Sans objet)'}</p>
      <p className="text-xs text-gray-400 mt-0.5">{formatDateShort(draft.original_email.date)}</p>
      <SentimentBadges tags={draft.sentimentTags} />
    </button>
  );
}

// ─── Sent email list item ────────────────────────────────────────────────────

function SentListItem({
  draft,
  selected,
  onSelect,
}: {
  draft: AIEmailDraft;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${selected ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <MailCheck className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
        <p className="text-sm font-medium text-gray-900 truncate">{draft.clientName}</p>
      </div>
      <p className="text-xs text-gray-600 truncate">{draft.draft.subject ?? '(Sans objet)'}</p>
      <p className="text-xs text-gray-400 mt-0.5">
        Envoyé le {formatDateShort(draft.updatedAt)}
      </p>
      {draft.bofip_sources_cited.length > 0 && (
        <p className="text-xs text-indigo-500 mt-0.5 flex items-center gap-1">
          <BookOpen className="w-3 h-3" />
          {draft.bofip_sources_cited.length} référence{draft.bofip_sources_cited.length > 1 ? 's' : ''} juridique{draft.bofip_sources_cited.length > 1 ? 's' : ''}
        </p>
      )}
    </button>
  );
}

// ─── Draft detail panel ───────────────────────────────────────────────────────

function DraftDetail({
  draft,
  onApproveAndSend,
  onApprove,
  onReject,
  isConnected,
}: {
  draft: AIEmailDraft;
  onApproveAndSend: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isConnected: boolean;
}) {
  const [editMode, setEditMode] = useState(false);
  const [editedBody, setEditedBody] = useState(draft.draft.body);
  const { updateDraftBody } = useEmailDraftStore();

  useEffect(() => {
    setEditMode(false);
    setEditedBody(draft.draft.body);
  }, [draft.id, draft.draft.body]);

  const isPending = draft.status === 'pending_review';
  const isApproved = draft.status === 'approved';

  const handleSaveEdit = () => {
    updateDraftBody(draft.id, editedBody);
    setEditMode(false);
  };

  const handleQuickAction = (action: 'mark_urgent' | 'request_document') => {
    if (action === 'mark_urgent') {
      toast('Email marqué comme Urgent.', { icon: '🔴' });
    } else {
      toast('Demande de document générée.', { icon: '📄' });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 truncate">{draft.original_email.subject ?? '(Sans objet)'}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{draft.clientName}</p>
            {draft.sentimentTags && draft.sentimentTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {draft.sentimentTags.map(tag => <SentimentBadge key={tag} tag={tag} />)}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <StatusBadge status={draft.status} />
            {isPending && (
              <div className="flex gap-1.5">
                <button
                  onClick={() => handleQuickAction('mark_urgent')}
                  title="Marquer comme urgent"
                  className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <AlertTriangle className="w-3 h-3" /> Urgent
                </button>
                <button
                  onClick={() => handleQuickAction('request_document')}
                  title="Générer une demande de document"
                  className="flex items-center gap-1 px-2 py-1 text-xs text-purple-600 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                >
                  <FileText className="w-3 h-3" /> Demande doc
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Original email */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Email original du client
          </h3>
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap border border-gray-200">
            {draft.original_email.body}
          </div>
        </div>

        {/* AI Draft */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Brouillon IA
            </h3>
            {isPending && (
              <div className="flex gap-2">
                {editMode ? (
                  <button
                    onClick={handleSaveEdit}
                    className="flex items-center gap-1 text-green-600 hover:text-green-800 text-xs font-medium"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    Sauvegarder
                  </button>
                ) : null}
                <button
                  onClick={() => setEditMode(e => !e)}
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs"
                >
                  <Edit3 className="w-3 h-3" />
                  {editMode ? 'Annuler' : 'Modifier'}
                </button>
              </div>
            )}
          </div>
          {editMode ? (
            <textarea
              className="w-full h-56 p-3 text-sm border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none font-mono"
              value={editedBody}
              onChange={e => setEditedBody(e.target.value)}
            />
          ) : (
            <div
              className="bg-white rounded-lg p-4 text-sm text-gray-700 border border-gray-200 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(draft.draft.body) }}
            />
          )}
        </div>

        {/* BOFiP sources */}
        {draft.bofip_sources_cited.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Références juridiques citées
            </h3>
            <ul className="space-y-1">
              {draft.bofip_sources_cited.map((src, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 rounded px-3 py-1.5"
                >
                  <span className="font-medium">{src.reference}</span>
                  {' — '}
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline truncate"
                  >
                    {src.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {(isPending || isApproved) && (
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          {isPending && (
            <>
              <button
                onClick={() => onApprove(draft.id)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <CheckCircle2 className="w-4 h-4" />
                Approuver
              </button>
              <button
                onClick={() => onReject(draft.id)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
              >
                <XCircle className="w-4 h-4" />
                Rejeter
              </button>
            </>
          )}
          {(isPending || isApproved) && isConnected && (
            <button
              onClick={() => onApproveAndSend(draft.id)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
            >
              <Send className="w-4 h-4" />
              Approuver &amp; Envoyer
            </button>
          )}
          {(isPending || isApproved) && !isConnected && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <WifiOff className="w-3 h-3" />
              Connexion Microsoft requise pour l'envoi
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sent email detail panel ─────────────────────────────────────────────────

function SentEmailDetail({ draft }: { draft: AIEmailDraft }) {
  const handleCopy = () => {
    const plain = htmlToPlainText(draft.draft.body);
    navigator.clipboard.writeText(plain).then(
      () => toast.success('Contenu copié dans le presse-papiers'),
      () => toast.error('Impossible de copier le contenu'),
    );
  };

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) {
      toast.error("La fenêtre d'impression a été bloquée. Autorisez les pop-ups pour ce site.");
      return;
    }
    const sanitizedBody = DOMPurify.sanitize(draft.draft.body);
    const sanitizedOriginal = draft.original_email.body
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    win.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Email envoyé — ${draft.draft.subject}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 13px; color: #1f2937; max-width: 720px; margin: 40px auto; padding: 0 20px; }
    h1 { font-size: 18px; margin-bottom: 4px; }
    .meta { color: #6b7280; font-size: 12px; margin-bottom: 24px; }
    .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #9ca3af; margin: 24px 0 8px; }
    .email-block { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; white-space: pre-wrap; }
    .sent-block { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
    .ref-list { list-style: none; padding: 0; margin: 0; }
    .ref-list li { padding: 6px 12px; background: #eff6ff; border-radius: 6px; margin-bottom: 6px; font-size: 12px; color: #1d4ed8; }
    .ref-list li span { font-weight: 700; margin-right: 4px; }
    hr { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <h1>${draft.draft.subject}</h1>
  <p class="meta">
    Client : <strong>${draft.clientName}</strong> &nbsp;|&nbsp;
    Envoyé le <strong>${formatDateTime(draft.updatedAt)}</strong>
  </p>
  <hr />
  <p class="section-title">Email original du client</p>
  <p class="meta">De : ${draft.original_email.from} &nbsp;|&nbsp; Reçu le ${formatDateTime(draft.original_email.date)}</p>
  <div class="email-block">${sanitizedOriginal}</div>
  <p class="section-title">Réponse envoyée</p>
  <p class="meta">De : cabinet &nbsp;→&nbsp; À : ${draft.draft.to}</p>
  <div class="sent-block">${sanitizedBody}</div>
  ${draft.bofip_sources_cited.length > 0 ? `
  <p class="section-title">Références juridiques citées (${draft.bofip_sources_cited.length})</p>
  <ul class="ref-list">
    ${draft.bofip_sources_cited.map(s => `<li><span>${s.reference}</span>— ${s.title}</li>`).join('')}
  </ul>` : ''}
</body>
</html>`);
    win.document.close();
    win.print();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{draft.draft.subject ?? '(Sans objet)'}</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {draft.clientName} &nbsp;·&nbsp; Envoyé le {formatDateTime(draft.updatedAt)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleCopy}
            title="Copier la réponse dans le presse-papiers"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" /> Copier
          </button>
          <button
            onClick={handlePrint}
            title="Imprimer ou exporter en PDF"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" /> Imprimer
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* ── Original client email ─────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
              <Mail className="w-3 h-3 text-gray-500" />
            </div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Email original du client
            </h3>
          </div>
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 space-y-1">
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span className="font-semibold w-10">De :</span>
                <span>{draft.original_email.from}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span className="font-semibold w-10">À :</span>
                <span>{draft.original_email.to}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span className="font-semibold w-10">Objet :</span>
                <span className="font-semibold text-gray-800">{draft.original_email.subject}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Clock className="w-3 h-3" />
                <span>{formatDateTime(draft.original_email.date)}</span>
              </div>
            </div>
            <div className="px-4 py-4 text-sm text-gray-700 whitespace-pre-wrap bg-white">
              {draft.original_email.body}
            </div>
          </div>
        </div>

        {/* ── Sent reply ───────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <MailCheck className="w-3 h-3 text-blue-600" />
            </div>
            <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
              Réponse envoyée
            </h3>
          </div>
          <div className="border border-blue-200 rounded-xl overflow-hidden">
            <div className="bg-blue-50 px-4 py-2.5 border-b border-blue-200 space-y-1">
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span className="font-semibold w-10">À :</span>
                <span>{draft.draft.to}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span className="font-semibold w-10">Objet :</span>
                <span className="font-semibold text-gray-800">{draft.draft.subject}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-blue-500">
                <Send className="w-3 h-3" />
                <span>Envoyé le {formatDateTime(draft.updatedAt)}</span>
              </div>
            </div>
            <div
              className="px-4 py-4 text-sm text-gray-700 bg-white prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(draft.draft.body) }}
            />
          </div>
        </div>

        {/* ── BOFiP legal references ────────────────────────────────────────── */}
        {draft.bofip_sources_cited.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-3 h-3 text-indigo-600" />
              </div>
              <h3 className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
                Références juridiques citées ({draft.bofip_sources_cited.length})
              </h3>
            </div>
            <ul className="space-y-2">
              {draft.bofip_sources_cited.map((src, i) => (
                <li
                  key={i}
                  className="flex items-start justify-between gap-3 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-indigo-700 font-mono">{src.reference}</p>
                    <p className="text-xs text-gray-700 mt-0.5 leading-snug">{src.title}</p>
                  </div>
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Consulter sur BOFiP"
                    className="flex-shrink-0 flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    BOFiP
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {draft.bofip_sources_cited.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-2">
            Aucune référence juridique citée pour cet email.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function InboxIA() {
  const navigate = useNavigate();
  const { graphToken, isConnected } = useMicrosoftAuth();
  const {
    drafts,
    loading,
    approveEmailDraft,
    rejectEmailDraft,
  } = useEmailDraftStore();
  const { fetchInboxDrafts, sendApprovedDraft } = useInboxSync();

  const [activeTab, setActiveTab] = useState<ActiveTab>('drafts');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showPromptPanel, setShowPromptPanel] = useState(false);

  // System prompt configuration — persisted in localStorage
  const [systemPrompts, setSystemPrompts] = useState<SystemPromptConfig>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_PROMPTS_KEY);
      if (stored) return JSON.parse(stored) as SystemPromptConfig;
      // Migrate Perplexity instruction from v1 storage (fiscal/social/relance/perplexity format)
      const v1 = localStorage.getItem('inbox_ia_system_prompts');
      if (v1) {
        const v1Data = JSON.parse(v1) as { perplexity?: string };
        if (v1Data.perplexity?.trim()) {
          return { ...DEFAULT_SYSTEM_PROMPTS, perplexity: v1Data.perplexity };
        }
      }
      return DEFAULT_SYSTEM_PROMPTS;
    } catch {
      return DEFAULT_SYSTEM_PROMPTS;
    }
  });

  const handleSaveSystemPrompts = useCallback((cfg: SystemPromptConfig) => {
    setSystemPrompts(cfg);
    try {
      localStorage.setItem(LOCAL_STORAGE_PROMPTS_KEY, JSON.stringify(cfg));
    } catch {
      // ignore storage errors
    }
  }, []);

  const displayDrafts = useMemo(
    () => (drafts.length > 0 ? drafts : buildDemoDrafts()),
    [drafts],
  );
  const isDemo = drafts.length === 0;

  // Items for each tab (memoized)
  const draftTabItems = useMemo(
    () => displayDrafts.filter(d => d.status !== 'sent'),
    [displayDrafts],
  );

  const sentTabItems = useMemo(
    () =>
      [...displayDrafts.filter(d => d.status === 'sent')].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [displayDrafts],
  );

  const pendingCount = useMemo(
    () => displayDrafts.filter(d => d.status === 'pending_review').length,
    [displayDrafts],
  );

  // Reset selection and auto-select first item when the active tab changes
  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    setSelectedId(null);
  };

  useEffect(() => {
    if (selectedId) return; // Already have a selection

    if (activeTab === 'drafts') {
      const first = draftTabItems.find(d => d.status === 'pending_review') ?? draftTabItems[0];
      if (first) setSelectedId(first.id);
    } else {
      if (sentTabItems.length > 0) setSelectedId(sentTabItems[0].id);
    }
  }, [activeTab, selectedId, draftTabItems, sentTabItems]);

  const currentList = activeTab === 'drafts' ? draftTabItems : sentTabItems;
  const selected = currentList.find(d => d.id === selectedId) ?? null;

  const handleRefresh = () => {
    if (graphToken) {
      void fetchInboxDrafts(systemPrompts);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-screen bg-white">
      {/* System prompt configuration panel (modal) */}
      {showPromptPanel && (
        <SystemPromptPanel
          config={systemPrompts}
          onSave={handleSaveSystemPrompts}
          onClose={() => setShowPromptPanel(false)}
        />
      )}

      {/* Back navigation */}
      <div className="px-4 py-3 border-b border-gray-100">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au tableau de bord
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left panel ─────────────────────────────────────────────────────── */}
        <div className="w-80 flex-shrink-0 border-r border-gray-200 flex flex-col">
          {/* Panel header */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-gray-600" />
              <span className="font-semibold text-gray-900 text-sm">Inbox IA</span>
            </div>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <span title="Microsoft connecté">
                  <Wifi className="w-3.5 h-3.5 text-green-500" />
                </span>
              ) : (
                <span title="Microsoft non connecté">
                  <WifiOff className="w-3.5 h-3.5 text-gray-400" />
                </span>
              )}
              <button
                onClick={() => setShowPromptPanel(true)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                title="Configurer les pré-instructions IA"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleRefresh}
                disabled={loading || !graphToken}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-40"
                title={graphToken ? 'Récupérer les emails clients' : 'Connexion Microsoft requise'}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => handleTabChange('drafts')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
                activeTab === 'drafts'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <InboxIcon className="w-3.5 h-3.5" />
              Brouillons IA
              {pendingCount > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold leading-none ${
                  activeTab === 'drafts' ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-700'
                }`}>
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => handleTabChange('sent')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors border-l border-gray-200 ${
                activeTab === 'sent'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <MailCheck className="w-3.5 h-3.5" />
              Envoyés
              {sentTabItems.length > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold leading-none ${
                  activeTab === 'sent' ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-700'
                }`}>
                  {sentTabItems.length}
                </span>
              )}
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {currentList.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 px-4 text-center text-gray-400">
                {activeTab === 'drafts' ? (
                  <>
                    <InboxIcon className="w-8 h-8 mb-2 opacity-40" />
                    <p className="text-sm">Aucun brouillon à traiter</p>
                  </>
                ) : (
                  <>
                    <MailCheck className="w-8 h-8 mb-2 opacity-40" />
                    <p className="text-sm">Aucun email envoyé</p>
                  </>
                )}
              </div>
            ) : activeTab === 'drafts' ? (
              draftTabItems.map(d => (
                <DraftListItem
                  key={d.id}
                  draft={d}
                  selected={selectedId === d.id}
                  onSelect={() => setSelectedId(d.id)}
                />
              ))
            ) : (
              sentTabItems.map(d => (
                <SentListItem
                  key={d.id}
                  draft={d}
                  selected={selectedId === d.id}
                  onSelect={() => setSelectedId(d.id)}
                />
              ))
            )}
          </div>

          {isDemo && (
            <p className="px-3 py-2 text-xs text-gray-400 text-center border-t border-gray-100">
              Mode démonstration
            </p>
          )}
        </div>

        {/* ── Right panel ────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden">
          {selected ? (
            activeTab === 'drafts' ? (
              <DraftDetail
                key={selected.id}
                draft={selected}
                onApproveAndSend={sendApprovedDraft}
                onApprove={approveEmailDraft}
                onReject={rejectEmailDraft}
                isConnected={isConnected}
              />
            ) : (
              <SentEmailDetail key={selected.id} draft={selected} />
            )
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                {activeTab === 'drafts' ? (
                  <>
                    <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Sélectionnez un brouillon</p>
                  </>
                ) : (
                  <>
                    <MailCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Sélectionnez un email envoyé</p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
