import { useState, useMemo, useEffect } from 'react';
import {
  Mail, Send, X, Edit3, ChevronRight, ExternalLink,
  BookOpen, Clock, CheckCircle2, XCircle, InboxIcon,
  User, Sparkles, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import DOMPurify from 'dompurify';
import { AIEmailDraft } from './types';
import { EmailDraftProvider, useEmailDraftStore } from './useEmailDraftStore';
import { useInboxSync } from '../../app/hooks/useInboxSync';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60 * 1000) return 'à l\'instant';
  if (diff < 3600 * 1000) return `il y a ${Math.floor(diff / 60000)} min`;
  if (diff < 24 * 3600 * 1000) return `il y a ${Math.floor(diff / 3600000)} h`;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function StatusBadge({ status }: { status: AIEmailDraft['status'] }) {
  const map = {
    pending_review: { label: 'En attente', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    approved: { label: 'Validé', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    sent: { label: 'Envoyé', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
    rejected: { label: 'Rejeté', cls: 'bg-red-100 text-red-700 border-red-200' },
  };
  const { label, cls } = map[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {label}
    </span>
  );
}

// ─── Draft body renderer ──────────────────────────────────────────────────────
function BodyRenderer({ body }: { body: string }) {
  // AI-generated content is HTML; plain text uses markdown-like formatting.
  // Require a well-formed opening HTML tag (letter, optionally alphanumeric, then
  // whitespace, '/', or '>') to avoid false-positives like "< 5 items".
  const isHtml = /^\s*<[a-zA-Z][a-zA-Z0-9]*[\s/>]/i.test(body);
  if (isHtml) {
    return (
      <div
        className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(body) }}
      />
    );
  }
  const escaped = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const html = escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br />');
  return (
    <div
      className="text-sm text-gray-700 leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ─── Inbox list item ──────────────────────────────────────────────────────────
function InboxItem({
  draft,
  isSelected,
  onClick,
}: {
  draft: AIEmailDraft;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors relative ${
        isSelected ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'border-l-2 border-l-transparent'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
          <User className="w-4 h-4 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className="text-sm font-semibold text-gray-900 truncate">{draft.clientName}</span>
            <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(draft.original_email.date)}</span>
          </div>
          <p className="text-xs font-medium text-gray-700 truncate mb-0.5">{draft.original_email.subject}</p>
          <p className="text-xs text-gray-400 truncate">{draft.original_email.body.slice(0, 80)}…</p>
          <div className="mt-1.5">
            <StatusBadge status={draft.status} />
          </div>
        </div>
        {isSelected && <ChevronRight className="w-4 h-4 text-blue-500 flex-shrink-0 mt-1" />}
      </div>
    </button>
  );
}

// ─── Split screen viewer ──────────────────────────────────────────────────────
function DraftDetail({ draft }: { draft: AIEmailDraft }) {
  const { rejectEmailDraft, updateDraftBody, updateDraftSubject } = useEmailDraftStore();
  const { sendApprovedDraft } = useInboxSync();
  const [editing, setEditing] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const [editBody, setEditBody] = useState(draft.draft.body);
  const [editSubject, setEditSubject] = useState(draft.draft.subject);
  const [isSending, setIsSending] = useState(false);

  // Sync edit state when the draft content changes (e.g. after a save)
  useEffect(() => {
    setEditBody(draft.draft.body);
    setEditSubject(draft.draft.subject);
    setEditing(false);
  }, [draft.id, draft.draft.body, draft.draft.subject]);

  const isPending = draft.status === 'pending_review';

  const handleApprove = async () => {
    setIsSending(true);
    try {
      await sendApprovedDraft(draft.id);
    } catch {
      toast.error("Erreur lors de l'envoi");
    } finally {
      setIsSending(false);
    }
  };

  const handleReject = async () => {
    if (!confirmReject) {
      setConfirmReject(true);
      return;
    }
    setConfirmReject(false);
    await rejectEmailDraft(draft.id);
    toast.success('Brouillon rejeté');
  };

  const handleSaveEdit = () => {
    updateDraftBody(draft.id, editBody);
    updateDraftSubject(draft.id, editSubject);
    setEditing(false);
    toast.success('Modifications enregistrées');
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{draft.clientName}</p>
            <p className="text-xs text-gray-500">Brouillon IA · {formatDate(draft.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={draft.status} />
        </div>
      </div>

      {/* ── Split screen ── */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {/* Original email (top half) */}
        <div className="flex-1 min-h-0 border-b border-gray-200 overflow-y-auto">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
            <Mail className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email original du client</span>
          </div>
          <div className="px-5 py-4">
            {/* Email meta */}
            <div className="space-y-1 mb-4 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span className="font-medium w-12">De :</span>
                <span>{draft.original_email.from}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span className="font-medium w-12">À :</span>
                <span>{draft.original_email.to}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span className="font-medium w-12">Objet :</span>
                <span className="font-semibold text-gray-800">{draft.original_email.subject}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Clock className="w-3 h-3" />
                <span>{new Date(draft.original_email.date).toLocaleString('fr-FR')}</span>
              </div>
            </div>
            <BodyRenderer body={draft.original_email.body} />
          </div>
        </div>

        {/* AI draft (bottom half) */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-5 py-3 bg-violet-50 border-b border-violet-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-500" />
              <span className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Brouillon IA</span>
            </div>
            {isPending && !editing && (
              <button
                onClick={() => { setEditBody(draft.draft.body); setEditSubject(draft.draft.subject); setEditing(true); }}
                className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" /> Modifier
              </button>
            )}
          </div>

          <div className="px-5 py-4">
            {/* Draft meta */}
            <div className="space-y-1 mb-4 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span className="font-medium w-12">À :</span>
                <span>{draft.draft.to}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span className="font-medium w-12">Objet :</span>
                {editing ? (
                  <input
                    value={editSubject}
                    onChange={e => setEditSubject(e.target.value)}
                    className="flex-1 border border-violet-300 rounded px-2 py-0.5 text-xs outline-none focus:ring-1 focus:ring-violet-400"
                  />
                ) : (
                  <span className="font-semibold text-gray-800">{draft.draft.subject}</span>
                )}
              </div>
            </div>

            {editing ? (
              <div className="space-y-3">
                <textarea
                  value={editBody}
                  onChange={e => setEditBody(e.target.value)}
                  rows={10}
                  className="w-full border border-violet-300 rounded-lg p-3 text-sm font-mono resize-y outline-none focus:ring-2 focus:ring-violet-300"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs px-3 py-2 rounded-lg transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Enregistrer
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="flex items-center gap-1.5 border border-gray-200 text-gray-600 text-xs px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" /> Annuler
                  </button>
                </div>
              </div>
            ) : (
              <BodyRenderer body={draft.draft.body} />
            )}
          </div>
        </div>
      </div>

      {/* ── Action bar ── */}
      {isPending && !editing && (
        <div className="flex-shrink-0 px-5 py-4 border-t border-gray-200 bg-white flex items-center justify-between gap-3">
          {confirmReject ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-600 font-medium">Confirmer le rejet ?</span>
              <button
                onClick={handleReject}
                className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-2 rounded-lg transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" /> Oui, rejeter
              </button>
              <button
                onClick={() => setConfirmReject(false)}
                className="flex items-center gap-1.5 border border-gray-200 text-gray-600 text-xs px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Annuler
              </button>
            </div>
          ) : (
            <button
              onClick={handleReject}
              className="flex items-center gap-2 border border-red-200 text-red-600 hover:bg-red-50 text-sm px-4 py-2.5 rounded-xl transition-colors"
            >
              <XCircle className="w-4 h-4" /> Rejeter
            </button>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setEditBody(draft.draft.body); setEditSubject(draft.draft.subject); setEditing(true); }}
              className="flex items-center gap-2 border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm px-4 py-2.5 rounded-xl transition-colors"
            >
              <Edit3 className="w-4 h-4" /> Modifier
            </button>
            <button
              onClick={handleApprove}
              disabled={isSending}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm px-5 py-2.5 rounded-xl transition-colors shadow-sm"
            >
              <Send className="w-4 h-4" />
              {isSending ? 'Envoi…' : 'Valider & envoyer'}
            </button>
          </div>
        </div>
      )}

      {!isPending && (
        <div className="flex-shrink-0 px-5 py-3 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <AlertCircle className="w-3.5 h-3.5" />
            {draft.status === 'sent' && 'Ce brouillon a été validé et envoyé.'}
            {draft.status === 'approved' && 'Ce brouillon a été approuvé.'}
            {draft.status === 'rejected' && 'Ce brouillon a été rejeté.'}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BOFiP sidebar ────────────────────────────────────────────────────────────
function BofipSidebar({ draft }: { draft: AIEmailDraft | null }) {
  if (!draft) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400 p-6 text-center">
        <BookOpen className="w-8 h-8 mb-3 opacity-40" />
        <p className="text-sm">Sélectionnez un brouillon pour voir les sources BOFiP citées.</p>
      </div>
    );
  }

  const sources = draft.bofip_sources_cited;

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-semibold text-gray-800">Sources BOFiP</span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{sources.length} référence{sources.length > 1 ? 's' : ''} citée{sources.length > 1 ? 's' : ''}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {sources.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">Aucune source citée pour ce brouillon.</p>
        )}
        {sources.map((source, i) => (
          <div key={i} className="bg-white border border-indigo-100 rounded-xl p-3 hover:border-indigo-300 transition-colors">
            <p className="text-xs font-semibold text-gray-800 mb-1 leading-snug">{source.title}</p>
            <p className="text-xs text-indigo-600 font-mono mb-2">{source.reference}</p>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Consulter sur BOFiP
            </a>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex-shrink-0">
        <a
          href="https://bofip.impots.gouv.fr"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Accéder au portail BOFiP
        </a>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
function EmailDraftValidatorInner() {
  const { drafts, loading } = useEmailDraftStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending_review' | 'all'>('pending_review');

  const filtered = useMemo(
    () => (filter === 'pending_review' ? drafts.filter(d => d.status === 'pending_review') : drafts),
    [drafts, filter],
  );

  const selectedDraft = drafts.find(d => d.id === selectedId) ?? null;
  const pendingCount = drafts.filter(d => d.status === 'pending_review').length;

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* ── Left panel: inbox ── */}
      <div className="w-80 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900">Assistant IA</h1>
              <p className="text-xs text-gray-500">Validation des brouillons</p>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setFilter('pending_review')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium transition-colors ${
                filter === 'pending_review'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <InboxIcon className="w-3.5 h-3.5" />
              En attente
              {pendingCount > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold leading-none ${
                  filter === 'pending_review' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
                }`}>
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium transition-colors border-l border-gray-200 ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Tous ({drafts.length})
            </button>
          </div>
        </div>

        {/* Inbox list */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 px-4 text-center">
              <CheckCircle2 className="w-8 h-8 mb-3 text-emerald-400" />
              <p className="text-sm font-medium text-gray-600">Tout est à jour !</p>
              <p className="text-xs text-gray-400 mt-1">Aucun brouillon en attente de validation.</p>
            </div>
          )}
          {filtered.map(draft => (
            <InboxItem
              key={draft.id}
              draft={draft}
              isSelected={selectedId === draft.id}
              onClick={() => setSelectedId(draft.id)}
            />
          ))}
        </div>
      </div>

      {/* ── Center panel: split screen ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-white border-r border-gray-200">
        {selectedDraft ? (
          <DraftDetail key={selectedDraft.id} draft={selectedDraft} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
            <Mail className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-base font-medium text-gray-500">Sélectionnez un brouillon</p>
            <p className="text-sm text-gray-400 mt-1">
              Cliquez sur un email dans la liste pour visualiser et valider le brouillon IA.
            </p>
            {pendingCount > 0 && (
              <div className="mt-4 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <p className="text-xs text-amber-700">
                  <strong>{pendingCount}</strong> brouillon{pendingCount > 1 ? 's' : ''} en attente de votre validation
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Right panel: BOFiP sidebar ── */}
      <div className="w-72 flex-shrink-0 bg-white border-l border-gray-200">
        <BofipSidebar draft={selectedDraft} />
      </div>
    </div>
  );
}

export function EmailDraftValidator() {
  return (
    <EmailDraftProvider>
      <EmailDraftValidatorInner />
    </EmailDraftProvider>
  );
}
