import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Clock,
  FileX,
  Receipt,
  Zap,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useDossiersContext } from '../../app/context/DossiersContext';
import { DossierData } from '../../app/utils/localStorage';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RelanceType = 'facture_impayee' | 'doc_manquant';

export type EscaladeLevel = 'J-3' | 'J+7' | 'J+15' | 'J+30' | 'J+45';

export interface TrackingEntry {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  relanceType: RelanceType;
  lastActionAt: string;
  nextEscalade: EscaladeLevel;
  daysSince: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysBetween(dateStr: string): number {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getEscaladeLevel(daysSince: number): EscaladeLevel {
  if (daysSince < 0) return 'J-3';
  if (daysSince <= 7) return 'J+7';
  if (daysSince <= 15) return 'J+15';
  if (daysSince <= 30) return 'J+30';
  return 'J+45';
}

function getLevelBadgeClass(level: EscaladeLevel): string {
  switch (level) {
    case 'J-3':  return 'bg-yellow-100 text-yellow-800 border border-yellow-300';
    case 'J+7':  return 'bg-yellow-200 text-yellow-900 border border-yellow-400';
    case 'J+15': return 'bg-orange-200 text-orange-900 border border-orange-400';
    case 'J+30': return 'bg-orange-500 text-white border border-orange-600';
    case 'J+45': return 'bg-red-600 text-white border border-red-700';
  }
}

function getRowHighlight(level: EscaladeLevel): string {
  switch (level) {
    case 'J-3':  return 'bg-yellow-50';
    case 'J+7':  return 'bg-yellow-50';
    case 'J+15': return 'bg-orange-50';
    case 'J+30': return 'bg-orange-100';
    case 'J+45': return 'bg-red-50';
  }
}

function formatDate(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function nextEscaladeDate(lastActionAt: string, level: EscaladeLevel): string {
  const base = new Date(lastActionAt);
  const thresholds: Record<EscaladeLevel, number> = {
    'J-3': -3,
    'J+7': 7,
    'J+15': 15,
    'J+30': 30,
    'J+45': 45,
  };
  base.setDate(base.getDate() + thresholds[level]);
  return base.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Progress threshold above which the dossier is considered to be in the invoicing
// phase (facture impayée) rather than the document-collection phase (doc manquant).
const INVOICE_PHASE_THRESHOLD = 0.5;

// ─── Derive tracking entries from dossiers ────────────────────────────────────

function deriveEntries(dossiers: DossierData[]): TrackingEntry[] {
  const entries: TrackingEntry[] = [];

  for (const dossier of dossiers) {
    const { clientData, stepStatuses, updatedAt, id } = dossier;
    const completedCount = stepStatuses.filter(s => s === 'completed').length;
    const totalCount = stepStatuses.length;
    const progress = totalCount > 0 ? completedCount / totalCount : 0;

    // Skip fully-completed dossiers
    if (progress >= 1) continue;

    const days = daysBetween(updatedAt);
    const level = getEscaladeLevel(days);

    // Classify relance type: early steps = doc manquant, later steps = facture impayee
    const relanceType: RelanceType =
      progress < INVOICE_PHASE_THRESHOLD ? 'doc_manquant' : 'facture_impayee';

    entries.push({
      id: `track_${id}`,
      clientId: id,
      clientName: clientData.nom || clientData.raisonSociale || 'Client inconnu',
      clientEmail: clientData.email || '',
      relanceType,
      lastActionAt: updatedAt,
      nextEscalade: level,
      daysSince: days,
    });
  }

  // Sort by urgency (highest level first)
  const order: EscaladeLevel[] = ['J+45', 'J+30', 'J+15', 'J+7', 'J-3'];
  entries.sort((a, b) => order.indexOf(a.nextEscalade) - order.indexOf(b.nextEscalade));

  return entries;
}

// ─── n8n webhook ──────────────────────────────────────────────────────────────

async function triggerN8nWebhook(
  entry: TrackingEntry,
  immediate: boolean,
): Promise<{ success: boolean; demo?: boolean }> {
  const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL as string | undefined;
  const apiKey = import.meta.env.VITE_N8N_API_KEY as string | undefined;

  const payload = {
    type: immediate ? 'escalade_immediate' : 'escalade_auto',
    clientId: entry.clientId,
    clientName: entry.clientName,
    clientEmail: entry.clientEmail,
    relanceType: entry.relanceType,
    escaladeLevel: entry.nextEscalade,
    daysSince: entry.daysSince,
    triggeredAt: new Date().toISOString(),
  };

  if (!webhookUrl) {
    console.log('[n8n DEMO] Escalade déclenchée :', payload);
    return { success: true, demo: true };
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['x-api-key'] = apiKey;

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    return { success: res.ok };
  } catch (err) {
    console.error('[n8n] Erreur webhook :', err);
    return { success: false };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MissingDocumentsTracker() {
  const { dossiers, loading } = useDossiersContext();
  const [entries, setEntries] = useState<TrackingEntry[]>([]);
  const [loadingRows, setLoadingRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    setEntries(deriveEntries(dossiers));
  }, [dossiers]);

  const handleImmediateEscalation = useCallback(async (entry: TrackingEntry) => {
    setLoadingRows(prev => new Set(prev).add(entry.id));
    try {
      const result = await triggerN8nWebhook(entry, true);
      if (result.success) {
        toast.success(
          result.demo
            ? `[Demo] Escalade immédiate simulée pour ${entry.clientName}`
            : `Escalade immédiate déclenchée pour ${entry.clientName}`,
        );
      } else {
        toast.error(`Échec du webhook pour ${entry.clientName}`);
      }
    } finally {
      setLoadingRows(prev => {
        const next = new Set(prev);
        next.delete(entry.id);
        return next;
      });
    }
  }, []);

  const relanceLabel = (type: RelanceType) =>
    type === 'facture_impayee' ? 'Facture impayée' : 'Document manquant';

  const relanceIcon = (type: RelanceType) =>
    type === 'facture_impayee'
      ? <Receipt className="inline w-4 h-4 mr-1 text-orange-500" />
      : <FileX className="inline w-4 h-4 mr-1 text-blue-500" />;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
        Chargement des dossiers…
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-5 h-5 text-orange-500" />
        <h2 className="text-lg font-semibold text-gray-800">
          Suivi relances & documents manquants
        </h2>
        <span className="ml-auto text-xs text-gray-400">
          {entries.length} dossier{entries.length !== 1 ? 's' : ''} en attente
        </span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mb-4 text-xs">
        {(['J-3', 'J+7', 'J+15', 'J+30', 'J+45'] as EscaladeLevel[]).map(level => (
          <span
            key={level}
            className={`px-2 py-0.5 rounded-full font-medium ${getLevelBadgeClass(level)}`}
          >
            {level}
          </span>
        ))}
        <span className="text-gray-400 self-center ml-1">
          — niveaux d'escalade
        </span>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-12 text-gray-400 border border-dashed border-gray-200 rounded-lg">
          <FileX className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          Aucun dossier en attente de relance.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Type relance</th>
                <th className="px-4 py-3">Dernière action</th>
                <th className="px-4 py-3">Prochaine escalade</th>
                <th className="px-4 py-3">Niveau</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map(entry => {
                const isLoading = loadingRows.has(entry.id);
                return (
                  <tr
                    key={entry.id}
                    className={`transition-colors hover:brightness-95 ${getRowHighlight(entry.nextEscalade)}`}
                  >
                    {/* Client */}
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {entry.clientName}
                      {entry.clientEmail && (
                        <div className="text-xs text-gray-400 font-normal">
                          {entry.clientEmail}
                        </div>
                      )}
                    </td>

                    {/* Type relance */}
                    <td className="px-4 py-3 text-gray-700">
                      {relanceIcon(entry.relanceType)}
                      {relanceLabel(entry.relanceType)}
                    </td>

                    {/* Dernière action */}
                    <td className="px-4 py-3 text-gray-600">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        {formatDate(entry.lastActionAt)}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        il y a {entry.daysSince}j
                      </div>
                    </td>

                    {/* Prochaine escalade */}
                    <td className="px-4 py-3 text-gray-600">
                      {nextEscaladeDate(entry.lastActionAt, entry.nextEscalade)}
                    </td>

                    {/* Niveau */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getLevelBadgeClass(entry.nextEscalade)}`}
                      >
                        {entry.nextEscalade}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleImmediateEscalation(entry)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isLoading ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Zap className="w-3.5 h-3.5" />
                        )}
                        Escalade immédiate
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
