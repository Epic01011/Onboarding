/**
 * FiscalHealthPanel.tsx
 *
 * Onglet "Santé Fiscale" affiché dans la fiche client.
 *
 * Bloc 1 — Attestation Fiscale :
 *   Bouton "Télécharger l'attestation à jour" → appelle requestTaxCertificate(client.siren).
 *
 * Bloc 2 — Échéances & Déclarations :
 *   Tableau alimenté par pennylaneApi.getFiscalDeadlines(), affichant le statut
 *   des déclarations (TVA, IS, CFE…) tel qu'il est connu dans Pennylane.
 *
 * Si le client n'a pas de pennylane_company_id, une alerte explicite est affichée.
 */

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Download, FileText, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { requestTaxCertificate } from '../services/dgfipApi';
import { getFiscalDeadlines } from '../services/pennylaneApi';
import type { Client, FiscalTask, UrgencySemantic } from '../types/dashboard';

// ─── Props ────────────────────────────────────────────────────────────────────

interface FiscalHealthPanelProps {
  client: Client;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const URGENCY_BADGE: Record<UrgencySemantic, { label: string; className: string }> = {
  green:  { label: 'OK',     className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  orange: { label: 'Urgent', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  red:    { label: 'Critique', className: 'bg-red-50 text-red-700 border-red-200' },
};

const STATUS_LABEL: Record<FiscalTask['status'], string> = {
  preparation:  'En préparation',
  waiting_docs: 'En attente de documents',
  ready:        'Prête à déclarer',
  declared:     'Déclarée',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── Bloc 1 : Attestation Fiscale ─────────────────────────────────────────────

function AttestationBlock({ client }: { client: Client }) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const result = await requestTaxCertificate(client.siren, client.id);
      if (result.certificate_url.startsWith('#demo')) {
        toast.info('Mode démonstration — configurez VITE_API_ENTREPRISE_TOKEN pour obtenir un vrai PDF.');
        return;
      }
      const a = document.createElement('a');
      a.href = result.certificate_url;
      const safeName = client.name.replace(/[^a-z0-9]/gi, '_');
      const date = new Date(result.issued_at).toLocaleDateString('fr-FR').replace(/\//g, '-');
      a.download = `attestation-fiscale-${safeName}-${date}.pdf`;
      a.click();
      toast.success('Attestation téléchargée avec succès.');
    } catch {
      toast.error("Erreur lors de la récupération de l'attestation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-indigo-600 flex-shrink-0" />
        <h3 className="text-sm font-semibold text-gray-800">Attestation Fiscale</h3>
      </div>
      <p className="text-xs text-gray-500">
        Obtenu directement depuis l'API Entreprise de l'État (API Entreprise v4 / DGFIP).
        Le SIREN utilisé : <span className="font-mono font-medium text-gray-700">{client.siren || '—'}</span>
      </p>
      <Button
        onClick={handleDownload}
        disabled={loading || !client.siren}
        className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Récupération en cours…
          </>
        ) : (
          <>
            <Download className="w-4 h-4 mr-2" />
            Télécharger l'attestation à jour
          </>
        )}
      </Button>
      {!client.siren && (
        <p className="text-xs text-amber-600 flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          Aucun SIREN renseigné pour ce dossier.
        </p>
      )}
    </div>
  );
}

// ─── Bloc 2 : Échéances & Déclarations ────────────────────────────────────────

function DeadlinesBlock({ pennylaneCompanyId }: { pennylaneCompanyId: string }) {
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<FiscalTask[]>([]);
  const [isDemo, setIsDemo] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getFiscalDeadlines(pennylaneCompanyId);
      if (result.success && result.data) {
        setTasks(result.data);
        setIsDemo(result.demo ?? false);
      } else {
        toast.error(result.error ?? 'Erreur lors de la récupération des échéances.');
      }
    } catch {
      toast.error('Erreur lors de la récupération des échéances Pennylane.');
    } finally {
      setLoading(false);
    }
  }, [pennylaneCompanyId]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-indigo-600 flex-shrink-0" />
          <h3 className="text-sm font-semibold text-gray-800">Échéances &amp; Déclarations</h3>
          {isDemo && (
            <span className="text-xs text-gray-400 italic">(démo)</span>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        </Button>
      </div>

      {loading && tasks.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
        </div>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">Aucune échéance trouvée dans Pennylane.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500">
                <th className="text-left py-2 pr-4 font-medium">Type</th>
                <th className="text-left py-2 pr-4 font-medium">Échéance</th>
                <th className="text-left py-2 pr-4 font-medium">Statut</th>
                <th className="text-left py-2 font-medium">Urgence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tasks.map(task => {
                const urgency = URGENCY_BADGE[task.urgency_semantic];
                return (
                  <tr key={task.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 pr-4 font-medium text-gray-800">{task.task_type.replace(/_/g, ' ')}</td>
                    <td className="py-2.5 pr-4 text-gray-600 tabular-nums">{formatDate(task.due_date)}</td>
                    <td className="py-2.5 pr-4 text-gray-600">{STATUS_LABEL[task.status]}</td>
                    <td className="py-2.5">
                      <Badge variant="outline" className={`text-xs ${urgency.className}`}>
                        {urgency.label}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-400">Source : Pennylane — données de production du cabinet.</p>
    </div>
  );
}

// ─── Main Panel ────────────────────────────────────────────────────────────────

export function FiscalHealthPanel({ client }: FiscalHealthPanelProps) {
  if (!client.pennylane_company_id) {
    return (
      <div className="space-y-4">
        <AttestationBlock client={client} />

        {/* Alert: Pennylane not connected */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Connexion Pennylane manquante</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Veuillez connecter ce dossier à Pennylane pour voir les échéances fiscales.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AttestationBlock client={client} />
      <DeadlinesBlock pennylaneCompanyId={client.pennylane_company_id} />
    </div>
  );
}
