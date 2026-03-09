import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import {
  Mail, ArrowLeft, Search, Trash2, Download, Archive,
  CheckSquare, Square, Eye, X, Clock, Tag, MonitorSmartphone,
  RefreshCw, ChevronDown, ChevronUp, Inbox, ArchiveX,
  Filter, MoreHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getSentEmails, deleteEmailRecords,
  type SentEmailRecord,
} from '@/app/utils/supabaseSync';

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  proposal:         { label: 'Devis',          color: 'bg-violet-100 text-violet-700 border-violet-200' },
  ldm:              { label: 'LDM',            color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  document_request: { label: 'Docs',           color: 'bg-blue-100 text-blue-700 border-blue-200' },
  welcome:          { label: 'Bienvenue',      color: 'bg-teal-100 text-teal-700 border-teal-200' },
  delegation:       { label: 'Délégation',     color: 'bg-orange-100 text-orange-700 border-orange-200' },
  campaign:         { label: 'Campagne',       color: 'bg-pink-100 text-pink-700 border-pink-200' },
  confraternelle:   { label: 'Confraternelle', color: 'bg-amber-100 text-amber-700 border-amber-200' },
};

type Folder = 'inbox' | 'archived';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function typeBadge(emailType: string | null) {
  if (!emailType) return null;
  const cfg = TYPE_LABELS[emailType] ?? { label: emailType, color: 'bg-gray-100 text-gray-600 border-gray-200' };
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border ${cfg.color}`}>
      <Tag className="w-2.5 h-2.5" />
      {cfg.label}
    </span>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' · '
    + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  );
}

function exportToCSV(emails: SentEmailRecord[]) {
  const headers = ['Date', 'Destinataire', 'Email', 'Sujet', 'Type', 'Démo'];
  const rows = emails.map(e => [
    formatDate(e.sentAt),
    e.recipientName ?? '',
    e.recipientEmail,
    e.subject,
    e.emailType ?? '',
    e.demo ? 'Oui' : 'Non',
  ]);
  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `emails-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Component ────────────────────────────────────────────────────────────────

const ARCHIVED_KEY = 'email_engine_archived_ids';

function getArchivedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(ARCHIVED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveArchivedIds(ids: Set<string>) {
  localStorage.setItem(ARCHIVED_KEY, JSON.stringify([...ids]));
}

export function EmailEnginePage() {
  const navigate = useNavigate();

  // ── Data ──────────────────────────────────────────────────────────────────
  const [emails, setEmails] = useState<SentEmailRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [archivedIds, setArchivedIds] = useState<Set<string>>(getArchivedIds);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [folder, setFolder] = useState<Folder>('inbox');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<SentEmailRecord | null>(null);
  const [sectionOpen, setSectionOpen] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadEmails = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getSentEmails();
      if (result.success) setEmails(result.emails);
    } catch (err) {
      console.error('Error loading emails:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEmails(); }, [loadEmails]);

  // ── Derived list ──────────────────────────────────────────────────────────
  const visibleEmails = emails
    .filter(e => folder === 'archived' ? archivedIds.has(e.id) : !archivedIds.has(e.id))
    .filter(e =>
      !search ||
      e.recipientEmail.toLowerCase().includes(search.toLowerCase()) ||
      e.subject.toLowerCase().includes(search.toLowerCase()) ||
      (e.recipientName ?? '').toLowerCase().includes(search.toLowerCase()),
    )
    .filter(e => typeFilter === 'all' || e.emailType === typeFilter);

  // ── Select all indeterminate state ────────────────────────────────────────
  const allSelected = visibleEmails.length > 0 && visibleEmails.every(e => selected.has(e.id));
  const someSelected = visibleEmails.some(e => selected.has(e.id)) && !allSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(visibleEmails.map(e => e.id)));
    }
  }

  async function handleDelete() {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!confirm(`Supprimer ${ids.length} email(s) ? Cette action est irréversible.`)) return;
    setDeleting(true);
    try {
      const result = await deleteEmailRecords(ids);
      if (result.success) {
        setEmails(prev => prev.filter(e => !ids.includes(e.id)));
        setSelected(new Set());
        if (preview && ids.includes(preview.id)) setPreview(null);
        toast.success(`${ids.length} email(s) supprimé(s)`);
      } else {
        toast.error('Erreur lors de la suppression');
      }
    } finally {
      setDeleting(false);
    }
  }

  function handleArchive() {
    const ids = [...selected];
    if (ids.length === 0) return;
    const next = new Set(archivedIds);
    if (folder === 'inbox') {
      ids.forEach(id => next.add(id));
      toast.success(`${ids.length} email(s) archivé(s)`);
    } else {
      ids.forEach(id => next.delete(id));
      toast.success(`${ids.length} email(s) restauré(s)`);
    }
    saveArchivedIds(next);
    setArchivedIds(next);
    setSelected(new Set());
    if (preview && ids.includes(preview.id)) setPreview(null);
  }

  function handleExport() {
    const toExport = selected.size > 0
      ? visibleEmails.filter(e => selected.has(e.id))
      : visibleEmails;
    if (toExport.length === 0) {
      toast.error('Aucun email à exporter');
      return;
    }
    exportToCSV(toExport);
    toast.success(`${toExport.length} email(s) exporté(s) en CSV`);
  }

  function handleDeleteFromPreview(email: SentEmailRecord) {
    setSelected(new Set([email.id]));
    // Directly deletes the email without using the bulk handleDelete function
    // since we need immediate execution for single-item preview actions.
    if (!confirm('Supprimer cet email ? Cette action est irréversible.')) return;
    setDeleting(true);
    deleteEmailRecords([email.id]).then(result => {
      if (result.success) {
        setEmails(prev => prev.filter(e => e.id !== email.id));
        setSelected(new Set());
        setPreview(null);
        toast.success('Email supprimé');
      } else {
        toast.error('Erreur lors de la suppression');
      }
    }).finally(() => setDeleting(false));
  }

  function handleArchiveFromPreview(email: SentEmailRecord) {
    const next = new Set(archivedIds);
    if (archivedIds.has(email.id)) {
      next.delete(email.id);
      toast.success('Email restauré dans la boîte de réception');
    } else {
      next.add(email.id);
      toast.success('Email archivé');
    }
    saveArchivedIds(next);
    setArchivedIds(next);
    setPreview(null);
  }

  const selectedCount = [...selected].filter(id => visibleEmails.some(e => e.id === id)).length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Top navigation bar ── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Retour"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 flex-1">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-gray-900">Moteur E-mails</h1>
              <p className="text-xs text-gray-500">Historique complet des emails envoyés</p>
            </div>
          </div>
          <button
            onClick={loadEmails}
            disabled={loading}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Actualiser"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* ── Email engine card ── */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Card header — collapsible */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              {/* Folder tabs */}
              <button
                onClick={() => { setFolder('inbox'); setSelected(new Set()); setPreview(null); }}
                className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  folder === 'inbox'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <Inbox className="w-4 h-4" />
                Boîte de réception
                <span className="text-xs tabular-nums ml-0.5">
                  ({emails.filter(e => !archivedIds.has(e.id)).length})
                </span>
              </button>
              <button
                onClick={() => { setFolder('archived'); setSelected(new Set()); setPreview(null); }}
                className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  folder === 'archived'
                    ? 'bg-amber-100 text-amber-700'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <Archive className="w-4 h-4" />
                Archives
                <span className="text-xs tabular-nums ml-0.5">
                  ({emails.filter(e => archivedIds.has(e.id)).length})
                </span>
              </button>
            </div>
            <button
              onClick={() => setSectionOpen(v => !v)}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label={sectionOpen ? 'Réduire' : 'Développer'}
            >
              {sectionOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {sectionOpen && (
            <>
              {/* Toolbar */}
              <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap">
                {/* Search */}
                <div className="relative flex-1 min-w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Rechercher destinataire, sujet…"
                    className="w-full text-sm pl-9 pr-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 bg-gray-50"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter toggle */}
                <button
                  onClick={() => setShowFilters(v => !v)}
                  className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border transition-colors ${
                    showFilters || typeFilter !== 'all'
                      ? 'bg-blue-50 border-blue-200 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  Filtrer
                </button>

                <div className="flex-1" />

                {/* Action buttons (visible when items selected) */}
                {selectedCount > 0 && (
                  <>
                    <span className="text-xs text-gray-500 tabular-nums">
                      {selectedCount} sélectionné{selectedCount > 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={handleArchive}
                      className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                    >
                      {folder === 'inbox' ? <Archive className="w-3.5 h-3.5" /> : <ArchiveX className="w-3.5 h-3.5" />}
                      {folder === 'inbox' ? 'Archiver' : 'Restaurer'}
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Supprimer
                    </button>
                  </>
                )}

                {/* Export */}
                <button
                  onClick={handleExport}
                  className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Exporter CSV
                </button>
              </div>

              {/* Type filter row */}
              {showFilters && (
                <div className="px-6 py-2.5 border-b border-gray-100 flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-500 font-medium">Type :</span>
                  {[{ key: 'all', label: 'Tous' }, ...Object.entries(TYPE_LABELS).map(([k, v]) => ({ key: k, label: v.label }))].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setTypeFilter(opt.key)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        typeFilter === opt.key
                          ? 'bg-blue-100 border-blue-300 text-blue-700 font-medium'
                          : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Body */}
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-gray-400">Chargement des emails…</p>
                  </div>
                </div>
              ) : visibleEmails.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                  <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                    <Mail className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-500 font-medium">
                    {search || typeFilter !== 'all'
                      ? 'Aucun email ne correspond à votre recherche.'
                      : folder === 'archived'
                        ? 'Aucun email archivé.'
                        : 'Aucun email envoyé pour le moment.'}
                  </p>
                  {(search || typeFilter !== 'all') && (
                    <button
                      onClick={() => { setSearch(''); setTypeFilter('all'); }}
                      className="mt-2 text-xs text-blue-500 hover:text-blue-700"
                    >
                      Effacer les filtres
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col lg:flex-row min-h-96">
                  {/* ── Email list ── */}
                  <div className={`flex flex-col ${preview ? 'lg:w-2/5 lg:border-r lg:border-gray-100' : 'w-full'}`}>
                    {/* Select all row */}
                    <div className="px-6 py-2 border-b border-gray-100 flex items-center gap-3 bg-gray-50/50">
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                        aria-label="Tout sélectionner"
                      />
                      <span className="text-xs text-gray-500">
                        {visibleEmails.length} email{visibleEmails.length !== 1 ? 's' : ''}
                        {typeFilter !== 'all' && ` · filtrés par ${TYPE_LABELS[typeFilter]?.label ?? typeFilter}`}
                      </span>
                    </div>

                    <ul className="divide-y divide-gray-100 overflow-y-auto" style={{ maxHeight: 560 }}>
                      {visibleEmails.map(email => (
                        <li key={email.id} className={`group ${selected.has(email.id) ? 'bg-blue-50/40' : ''}`}>
                          <div className="flex items-start gap-3 px-6 py-3.5 hover:bg-gray-50 transition-colors">
                            {/* Checkbox */}
                            <button
                              onClick={() => toggleOne(email.id)}
                              className="mt-0.5 flex-shrink-0 text-gray-400 hover:text-blue-600 transition-colors"
                              aria-label={selected.has(email.id) ? 'Désélectionner' : 'Sélectionner'}
                            >
                              {selected.has(email.id)
                                ? <CheckSquare className="w-4 h-4 text-blue-600" />
                                : <Square className="w-4 h-4" />}
                            </button>

                            {/* Row content — clickable to preview */}
                            <button
                              onClick={() => setPreview(prev => prev?.id === email.id ? null : email)}
                              className="flex-1 flex items-start gap-3 text-left min-w-0"
                            >
                              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                                <Mail className="w-4 h-4 text-blue-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-sm font-medium truncate max-w-[180px] ${
                                    preview?.id === email.id ? 'text-blue-700' : 'text-gray-800'
                                  }`}>
                                    {email.recipientName ?? email.recipientEmail}
                                  </span>
                                  {typeBadge(email.emailType)}
                                  {email.demo && (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">démo</span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-600 truncate mt-0.5">{email.subject}</p>
                                <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5" />
                                  {formatDate(email.sentAt)}
                                </p>
                              </div>
                              <Eye className={`w-4 h-4 flex-shrink-0 mt-1 transition-colors ${
                                preview?.id === email.id ? 'text-blue-400' : 'text-gray-300 group-hover:text-gray-400'
                              }`} />
                            </button>

                            {/* Quick actions */}
                            <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleArchiveFromPreview(email)}
                                className="p-1 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                                title={archivedIds.has(email.id) ? 'Restaurer' : 'Archiver'}
                              >
                                {archivedIds.has(email.id)
                                  ? <ArchiveX className="w-3.5 h-3.5" />
                                  : <Archive className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={() => handleDeleteFromPreview(email)}
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Supprimer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* ── Preview panel ── */}
                  {preview && (
                    <div className="flex-1 flex flex-col border-t lg:border-t-0 border-gray-100 min-h-96">
                      {/* Preview header */}
                      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-900">{preview.subject}</p>
                            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                              <MonitorSmartphone className="w-3 h-3" />
                              À : {preview.recipientName
                                ? `${preview.recipientName} <${preview.recipientEmail}>`
                                : preview.recipientEmail}
                            </p>
                            <div className="flex items-center gap-2 flex-wrap mt-1.5">
                              {typeBadge(preview.emailType)}
                              {preview.demo && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">démo</span>
                              )}
                              <span className="text-xs text-gray-400">{formatDate(preview.sentAt)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {/* Archive from preview */}
                            <button
                              onClick={() => handleArchiveFromPreview(preview)}
                              className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              title={archivedIds.has(preview.id) ? 'Restaurer dans la boîte de réception' : 'Archiver'}
                            >
                              {archivedIds.has(preview.id)
                                ? <ArchiveX className="w-4 h-4" />
                                : <Archive className="w-4 h-4" />}
                            </button>
                            {/* Export single */}
                            <button
                              onClick={() => exportToCSV([preview])}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Exporter cet email"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            {/* Delete from preview */}
                            <button
                              onClick={() => handleDeleteFromPreview(preview)}
                              disabled={deleting}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Supprimer cet email"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            {/* Close preview */}
                            <button
                              onClick={() => setPreview(null)}
                              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                              aria-label="Fermer la prévisualisation"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* HTML content */}
                      <div className="flex-1 overflow-auto bg-white">
                        {preview.htmlContent ? (
                          <iframe
                            srcDoc={preview.htmlContent}
                            title={`Prévisualisation : ${preview.subject}`}
                            className="w-full h-full border-0"
                            style={{ minHeight: 400 }}
                            sandbox=""
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full py-16 text-sm text-gray-400">
                            <MoreHorizontal className="w-8 h-8 mb-2 text-gray-300" />
                            Aucune prévisualisation disponible.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default EmailEnginePage;
