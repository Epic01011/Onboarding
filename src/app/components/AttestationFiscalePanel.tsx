import { useState } from 'react';
import { Download, FileText, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';
import { Button } from './ui/button';
import { EmailPreviewModal } from './EmailPreviewModal';
import { requestTaxCertificate } from '../services/dgfipApi';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AttestationRecord {
  id: string;
  /** ISO timestamp when the certificate was fetched */
  fetchedAt: string;
  status: 'Valide';
  certificateUrl: string;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AttestationFiscalePanelProps {
  open: boolean;
  onClose: () => void;
  /** Internal dossier identifier sent to the DGFIP API */
  dossierId: string;
  /** Client display name shown in the panel title and email */
  raisonSociale: string;
  /** Optional client email pre-filled in the share modal */
  clientEmail?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AttestationFiscalePanel({
  open,
  onClose,
  dossierId,
  raisonSociale,
  clientEmail = '',
}: AttestationFiscalePanelProps) {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<AttestationRecord[]>([]);
  const [emailModal, setEmailModal] = useState<{
    open: boolean;
    record: AttestationRecord | null;
  }>({ open: false, record: null });

  // ── Fetch a new attestation from the DGFIP API ──────────────────────────────

  const handleRequestAttestation = async () => {
    setLoading(true);
    try {
      const result = await requestTaxCertificate(dossierId);
      const newRecord: AttestationRecord = {
        id: crypto.randomUUID(),
        fetchedAt: result.issued_at,
        status: 'Valide',
        certificateUrl: result.certificate_url,
      };
      setHistory(prev => [newRecord, ...prev]);
      toast.success('Attestation de régularité fiscale récupérée avec succès');
    } catch {
      toast.error("Erreur lors de la récupération de l'attestation");
    } finally {
      setLoading(false);
    }
  };

  // ── Download the PDF locally ────────────────────────────────────────────────

  const handleDownload = (record: AttestationRecord) => {
    if (record.certificateUrl.startsWith('#demo')) {
      toast.info('Mode démonstration — aucun PDF réel à télécharger');
      return;
    }
    const safeName = raisonSociale.replace(/[^a-z0-9]/gi, '_');
    const date = new Date(record.fetchedAt).toLocaleDateString('fr-FR').replace(/\//g, '-');
    const a = document.createElement('a');
    a.href = record.certificateUrl;
    a.download = `attestation-fiscale-${safeName}-${date}.pdf`;
    a.click();
  };

  // ── Open email preview modal ────────────────────────────────────────────────

  const handleShareEmail = (record: AttestationRecord) => {
    setEmailModal({ open: true, record });
  };

  const handleEmailSent = async () => {
    setEmailModal({ open: false, record: null });
    toast.success('Email envoyé au client');
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const activeRecord = emailModal.record;

  const buildEmailHtml = (record: AttestationRecord): string => {
    const safeName = raisonSociale.replace(/[^a-z0-9]/gi, '_');
    const date = new Date(record.fetchedAt).toLocaleDateString('fr-FR').replace(/\//g, '-');
    const filename = `attestation-fiscale-${safeName}-${date}.pdf`;
    return `<p>Bonjour,</p>
<p>Veuillez trouver ci-joint votre attestation de régularité fiscale à jour, récupérée ce jour sur votre espace impots.gouv.fr.</p>
<p>Cordialement,</p>
<div style="margin-top:16px;padding:10px 14px;background:#f5f7ff;border:1px solid #d0d5e8;border-radius:6px;display:inline-flex;align-items:center;gap:8px;">
  <span style="font-size:18px;">📎</span>
  <span style="font-size:13px;color:#374151;">${filename}</span>
</div>`;
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[520px] flex flex-col p-0 overflow-hidden"
        >
          {/* Header */}
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              <SheetTitle className="text-base font-bold text-gray-900 leading-tight">
                Attestations fiscales
              </SheetTitle>
            </div>
            <p className="text-sm text-gray-500 mt-1">{raisonSociale}</p>
          </SheetHeader>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

            {/* Primary action */}
            <Button
              onClick={handleRequestAttestation}
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Récupération en cours…
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Demander une nouvelle attestation
                </>
              )}
            </Button>

            {/* History list */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Historique des attestations
              </h3>

              {history.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
                  Aucune attestation récupérée pour ce dossier.
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map(record => (
                    <div
                      key={record.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg"
                    >
                      {/* Date + status */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500">{formatDate(record.fetchedAt)}</p>
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full mt-1">
                          ✓ {record.status}
                        </span>
                      </div>

                      {/* Download */}
                      <button
                        onClick={() => handleDownload(record)}
                        title="Télécharger le PDF"
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      {/* Share by email */}
                      <button
                        onClick={() => handleShareEmail(record)}
                        title="Partager au client par email"
                        className="flex items-center gap-1 text-xs text-gray-600 hover:text-indigo-700 hover:bg-indigo-50 px-2 py-1.5 rounded border border-gray-200 hover:border-indigo-200 transition-all"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        Partager au client
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Email preview modal (rendered outside the Sheet to avoid stacking issues) */}
      {activeRecord && (
        <EmailPreviewModal
          isOpen={emailModal.open}
          onClose={() => setEmailModal({ open: false, record: null })}
          onSend={handleEmailSent}
          subject={`Votre attestation de régularité fiscale - ${raisonSociale}`}
          recipient={clientEmail}
          recipientName={raisonSociale}
          htmlContent={buildEmailHtml(activeRecord)}
        />
      )}
    </>
  );
}
