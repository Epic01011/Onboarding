import { useState } from 'react';
import { Mail, Eye, X, Clock, Tag, MonitorSmartphone } from 'lucide-react';
import type { SentEmailRecord } from '@/app/utils/supabaseSync';

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  proposal:         { label: 'Devis',          color: 'bg-violet-100 text-violet-700' },
  ldm:              { label: 'LDM',            color: 'bg-emerald-100 text-emerald-700' },
  document_request: { label: 'Docs',           color: 'bg-blue-100 text-blue-700' },
  welcome:          { label: 'Bienvenue',      color: 'bg-teal-100 text-teal-700' },
  delegation:       { label: 'Délégation',     color: 'bg-orange-100 text-orange-700' },
  campaign:         { label: 'Campagne',       color: 'bg-pink-100 text-pink-700' },
  confraternelle:   { label: 'Confraternelle', color: 'bg-amber-100 text-amber-700' },
};

function typeBadge(emailType: string | null) {
  if (!emailType) return null;
  const cfg = TYPE_LABELS[emailType] ?? { label: emailType, color: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
      <Tag className="w-2.5 h-2.5" />
      {cfg.label}
    </span>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' · '
    + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

interface EmailEngineProps {
  emails: SentEmailRecord[];
  loading?: boolean;
}

export function EmailEngine({ emails, loading = false }: EmailEngineProps) {
  const [selected, setSelected] = useState<SentEmailRecord | null>(null);
  const [search, setSearch] = useState('');

  const filtered = emails.filter(e =>
    !search ||
    e.recipientEmail.toLowerCase().includes(search.toLowerCase()) ||
    e.subject.toLowerCase().includes(search.toLowerCase()) ||
    (e.recipientName ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
            <Mail className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Moteur E-mails</h2>
            <p className="text-xs text-muted-foreground">Historique des emails envoyés depuis l'application</p>
          </div>
        </div>
        <span className="text-xs text-slate-400 tabular-nums">{emails.length} email{emails.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Search */}
      <div className="px-5 py-3 border-b border-slate-100">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par destinataire ou sujet…"
          className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 bg-slate-50 placeholder:text-slate-400"
        />
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center px-6">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
            <Mail className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-sm text-slate-500">
            {search ? 'Aucun email ne correspond à votre recherche.' : 'Aucun email envoyé pour le moment.'}
          </p>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="mt-2 text-xs text-blue-500 hover:text-blue-700"
            >
              Effacer la recherche
            </button>
          )}
        </div>
      ) : (
        <div className={`flex ${selected ? 'flex-col lg:flex-row' : 'flex-col'}`}>
          {/* List */}
          <ul className={`divide-y divide-slate-100 ${selected ? 'lg:w-2/5 lg:border-r lg:border-slate-100' : 'w-full'} max-h-96 overflow-y-auto`}>
            {filtered.map(email => (
              <li key={email.id}>
                <button
                  onClick={() => setSelected(prev => prev?.id === email.id ? null : email)}
                  className={`w-full flex items-start gap-3 px-5 py-3.5 text-left hover:bg-slate-50 transition-colors ${
                    selected?.id === email.id ? 'bg-blue-50/60' : ''
                  }`}
                >
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Mail className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-800 truncate max-w-[180px]">
                        {email.recipientName ?? email.recipientEmail}
                      </span>
                      {typeBadge(email.emailType)}
                      {email.demo && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">démo</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 truncate mt-0.5">{email.subject}</p>
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {formatDate(email.sentAt)}
                    </p>
                  </div>
                  <Eye className="w-4 h-4 text-slate-300 flex-shrink-0 mt-1" />
                </button>
              </li>
            ))}
          </ul>

          {/* Preview panel */}
          {selected && (
            <div className="flex-1 flex flex-col border-t lg:border-t-0 border-slate-100">
              {/* Preview header */}
              <div className="flex items-start justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">{selected.subject}</p>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                    <MonitorSmartphone className="w-3 h-3" />
                    À : {selected.recipientName
                      ? `${selected.recipientName} <${selected.recipientEmail}>`
                      : selected.recipientEmail}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {typeBadge(selected.emailType)}
                    {selected.demo && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">démo</span>
                    )}
                    <span className="text-xs text-slate-400">{formatDate(selected.sentAt)}</span>
                  </div>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors flex-shrink-0 ml-2"
                  aria-label="Fermer la prévisualisation"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {/* HTML preview */}
              <div className="flex-1 overflow-auto bg-white" style={{ minHeight: 280 }}>
                {selected.htmlContent ? (
                  <iframe
                    srcDoc={selected.htmlContent}
                    title={`Prévisualisation : ${selected.subject}`}
                    className="w-full h-full border-0"
                    style={{ minHeight: 280 }}
                    sandbox=""
                  />
                ) : (
                  <div className="flex items-center justify-center h-full py-12 text-sm text-slate-400">
                    Aucune prévisualisation disponible.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default EmailEngine;
