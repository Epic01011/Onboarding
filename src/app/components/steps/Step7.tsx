import { useState, useEffect, useCallback } from 'react';
import {
  Upload, CheckCircle2, Clock, ExternalLink, FolderOpen,
  RefreshCw, Copy, Check, Loader2, AlertCircle, FileCheck2, Link2,
} from 'lucide-react';
import { useOnboarding, DocumentItem } from '../../context/OnboardingContext';
import { useSharePoint } from '../../context/SharePointContext';
import { useMicrosoftAuth } from '../../context/MicrosoftAuthContext';
import { StepShell } from '../StepShell';
import {
  scanClientDocuments,
  createClientUploadLink,
  buildDocsClientPath,
  ScannedDocument,
} from '../../utils/sharepointGed';
import { toast } from 'sonner';

// ─── Listes de documents ────────────────────────────────────────────────────────────────────

const DEFAULT_DOCS_REPRISE: DocumentItem[] = [
  { id: '1', name: 'Extrait KBIS (- de 3 mois)', required: true, status: 'pending' },
  { id: '2', name: "Pièce d'identité du dirigeant", required: true, status: 'pending' },
  { id: '3', name: 'Statuts de la société', required: true, status: 'pending' },
  { id: '4', name: 'Derniers bilans comptables (3 ans)', required: true, status: 'pending' },
  { id: '5', name: 'Attestation de régularité fiscale (AF)', required: false, status: 'pending' },
  { id: '6', name: 'Attestation de vigilance URSSAF', required: false, status: 'pending' },
];

const DEFAULT_DOCS_CREATION: DocumentItem[] = [
  { id: 'c1', name: "Pièce d'identité recto — Dirigeant", required: true, status: 'pending' },
  { id: 'c2', name: "Pièce d'identité verso — Dirigeant", required: true, status: 'pending' },
  { id: 'c3', name: 'Mandat de réalisation des formalités (signé)', required: true, status: 'pending' },
  { id: 'c4', name: 'Attestation de non-condamnation et de filiation', required: true, status: 'pending' },
  { id: 'c5', name: 'Statuts de la société (projet signé)', required: true, status: 'pending' },
  { id: 'c6', name: 'Certificat de dépôt de capital', required: true, status: 'pending' },
  { id: 'c7', name: 'Liste des bénéficiaires effectifs (DBE)', required: true, status: 'pending' },
  { id: 'c8', name: 'Justificatif de domiciliation (siège social)', required: true, status: 'pending' },
  { id: 'c9', name: "Pièces d'identité des associés (recto/verso)", required: false, status: 'pending' },
  { id: 'c10', name: 'Attestation de parution annonce légale', required: false, status: 'pending' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

function formatDate(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  } catch { return iso; }
}

// ─── Composant Bouton Copier ─────────────────────────────────────────────────────────────────

function CopyButton({ text, label = 'Copier' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2.5 py-1 rounded-lg transition-all flex-shrink-0"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copié !' : label}
    </button>
  );
}

// ─── Composant principale Step7 ─────────────────────────────────────────────────────────────────

export function Step7() {
  const { clientData, updateClientData, goNext, goPrev } = useOnboarding();
  const { isConfigured, configuredSiteId } = useSharePoint();
  const { graphToken, isConnected: msConnected } = useMicrosoftAuth();
  const isCreation = clientData.missionType === 'creation';

  const [scanning, setScanning] = useState(false);
  const [scanResults, setScanResults] = useState<ScannedDocument[] | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);

  // Initialise les bons documents si pas encore fait
  useEffect(() => {
    const current = clientData.documents;
    const isCreationDocs = current.some(d => d.id.startsWith('c'));
    const isRepriseDocs = current.some(d => !d.id.startsWith('c'));
    if (isCreation && !isCreationDocs) updateClientData({ documents: DEFAULT_DOCS_CREATION });
    else if (!isCreation && !isRepriseDocs) updateClientData({ documents: DEFAULT_DOCS_REPRISE });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreation]);

  const docs = clientData.documents;
  const received = docs.filter(d => d.status !== 'pending').length;
  const requiredDocs = docs.filter(d => d.required);
  const requiredReceived = requiredDocs.filter(d => d.status !== 'pending').length;
  const allRequired = requiredReceived === requiredDocs.length;

  // URL du dossier de dépôt
  const hasFolder = !!clientData.sharepointFolderUrl;
  const docsSubfolderPath = hasFolder
    ? buildDocsClientPath(clientData.siren, clientData.raisonSociale || clientData.nom)
    : null;

  // — Scan SharePoint réel
  const handleScanSharePoint = useCallback(async () => {
    if (!graphToken || !configuredSiteId) {
      toast.error('Connexion Microsoft ou site SharePoint non configuré');
      return;
    }
    if (!clientData.siren) {
      toast.error('SIREN client manquant');
      return;
    }

    setScanning(true);
    setScanError(null);

    try {
      const results = await scanClientDocuments(
        graphToken,
        configuredSiteId,
        clientData.siren,
        clientData.raisonSociale || clientData.nom,
        docs.map(d => ({ id: d.id, name: d.name, required: d.required })),
      );

      setScanResults(results);

      // Auto-marquer reçus les documents trouvés dans SharePoint
      const updated = docs.map(d => {
        const scanned = results.find(r => r.id === d.id);
        if (scanned?.foundInSharePoint && d.status === 'pending') {
          return {
            ...d,
            status: 'received' as const,
            uploadedAt: scanned.sharepointFile
              ? formatDate(scanned.sharepointFile.lastModifiedDateTime)
              : new Date().toLocaleDateString('fr-FR'),
            sharepointUrl: scanned.sharepointFile?.webUrl,
          };
        }
        return d;
      });
      updateClientData({ documents: updated });

      const found = results.filter(r => r.foundInSharePoint).length;
      toast.success(
        found > 0
          ? `${found} document(s) trouvé(s) et validés depuis SharePoint`
          : 'Aucun document trouvé dans le dossier SharePoint pour l\'instant',
      );
    } catch (err: any) {
      const msg = err.message || 'Erreur lors du scan SharePoint';
      setScanError(msg);
      toast.error(msg);
    } finally {
      setScanning(false);
    }
  }, [graphToken, configuredSiteId, clientData, docs, updateClientData]);

  // — Générer / régénérer le lien de dépôt
  const handleGenerateUploadLink = async () => {
    if (!graphToken || !configuredSiteId || !clientData.siren) return;
    setGeneratingLink(true);
    try {
      const link = await createClientUploadLink(
        graphToken,
        configuredSiteId,
        clientData.siren,
        clientData.raisonSociale || clientData.nom,
      );
      updateClientData({ sharepointUploadLink: link });
      toast.success('Lien de dépôt généré');
    } catch (err: any) {
      toast.error(err.message || 'Erreur génération du lien');
    } finally {
      setGeneratingLink(false);
    }
  };

  // — Toggle manuel (sans SharePoint)
  const toggleDoc = (id: string) => {
    const updated = docs.map(d =>
      d.id === id
        ? {
            ...d,
            status: (d.status === 'pending' ? 'received' : 'pending') as DocumentItem['status'],
            uploadedAt: d.status === 'pending' ? new Date().toLocaleDateString('fr-FR') : undefined,
            sharepointUrl: d.status === 'pending' ? (clientData.sharepointFolderUrl || undefined) : undefined,
          }
        : d,
    );
    updateClientData({ documents: updated });
  };

  const statusStyle = (status: DocumentItem['status']) => {
    if (status === 'validated') return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (status === 'received')  return 'text-blue-600 bg-blue-50 border-blue-200';
    if (status === 'rejected')  return 'text-red-600 bg-red-50 border-red-200';
    return 'text-gray-400 bg-gray-50 border-gray-200';
  };

  const statusLabel = (status: DocumentItem['status']) => {
    if (status === 'validated') return 'Validé';
    if (status === 'received')  return 'Reçu';
    if (status === 'rejected')  return 'Rejeté';
    return 'En attente';
  };

  const canScan = msConnected && isConfigured && hasFolder;

  return (
    <StepShell
      step={7}
      title={isCreation ? 'Collecte Documentaire — Création' : 'Collecte Documentaire KYC'}
      subtitle={
        isCreation
          ? 'Réception et validation des pièces de création — vérification automatique dans SharePoint'
          : 'Suivi de la réception des documents via le lien SharePoint — scan automatique du dossier client'
      }
      type="manuel"
      icon={<Upload className="w-5 h-5 text-white" />}
      onBack={goPrev}
      onNext={goNext}
      nextLabel="Analyse IA →"
      nextDisabled={!allRequired}
    >

      {/* ── Lien de dépôt client ────────────────────────────────────────────────── */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-2">
            <Link2 className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-blue-800">Lien de dépôt client (SharePoint)</p>
              <p className="text-xs text-blue-500 mt-0.5">
                Sous-dossier : 06 - Documents client
              </p>
              {clientData.sharepointUploadLink ? (
                <p className="text-xs text-blue-600 font-mono break-all mt-1">
                  {clientData.sharepointUploadLink}
                </p>
              ) : (
                <p className="text-xs text-amber-600 mt-1">
                  Aucun lien généré. Créez le dossier à l'étape 4 d'abord.
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            {clientData.sharepointUploadLink && (
              <>
                <CopyButton text={clientData.sharepointUploadLink} label="Copier le lien" />
                <a
                  href={clientData.sharepointUploadLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs bg-blue-600 text-white px-2.5 py-1 rounded-lg hover:bg-blue-700 transition-all"
                >
                  <ExternalLink className="w-3 h-3" /> Ouvrir
                </a>
              </>
            )}
            {canScan && (
              <button
                onClick={handleGenerateUploadLink}
                disabled={generatingLink}
                className="flex items-center gap-1 text-xs bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 px-2.5 py-1 rounded-lg transition-all disabled:opacity-50"
              >
                {generatingLink
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <Link2 className="w-3 h-3" />}
                {clientData.sharepointUploadLink ? 'Regénérer' : 'Générer le lien'}
              </button>
            )}
          </div>
        </div>

        {/* Lien direct vers le sous-dossier */}
        {hasFolder && docsSubfolderPath && (
          <div className="mt-3 pt-3 border-t border-blue-100 flex items-center gap-2">
            <FolderOpen className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
            <p className="text-xs text-blue-600 font-mono flex-1 truncate">{docsSubfolderPath}</p>
            <a
              href={`${clientData.sharepointFolderUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-0.5 flex-shrink-0"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>

      {/* ── Bouton scan SharePoint ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <p className="text-sm font-medium text-gray-800">Pièces à réceptionner</p>
          <p className="text-xs text-gray-500">
            {received}/{docs.length} reçus — {requiredReceived}/{requiredDocs.length} obligatoires
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canScan ? (
            <button
              onClick={handleScanSharePoint}
              disabled={scanning}
              className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-3 py-1.5 rounded-lg transition-all"
            >
              {scanning
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <RefreshCw className="w-3.5 h-3.5" />}
              {scanning ? 'Scan en cours...' : 'Vérifier dans SharePoint'}
            </button>
          ) : (
            <span className="text-xs text-gray-400 italic">
              {!msConnected
                ? 'Connectez Microsoft 365'
                : !isConfigured
                ? 'Configurez un site SharePoint'
                : 'Créez d\'abord le dossier (étape 4)'}
            </span>
          )}
        </div>
      </div>

      {/* Barre de progression */}
      <div className="mb-5">
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${docs.length ? (received / docs.length) * 100 : 0}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-400">
            {docs.length ? Math.round((received / docs.length) * 100) : 0}%
          </span>
          {allRequired && (
            <span className="text-xs text-emerald-600 font-medium">✅ Obligatoires OK</span>
          )}
        </div>
      </div>

      {/* Erreur scan */}
      {scanError && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg p-3 mb-4">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{scanError}</p>
        </div>
      )}

      {/* Info scan réussi */}
      {scanResults && !scanError && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-lg p-3 mb-4">
          <FileCheck2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <p className="text-xs text-emerald-700">
            Scan SharePoint terminé —{' '}
            <strong>{scanResults.filter(r => r.foundInSharePoint).length}</strong>
            /{scanResults.length} document(s) trouvé(s) dans le sous-dossier.
            {scanResults.filter(r => r.foundInSharePoint).length > 0 &&
              ' Les documents trouvés ont été marqués "Reçu" automatiquement.'}
          </p>
        </div>
      )}

      {/* ── Liste des documents ───────────────────────────────────────────────── */}
      <div className="space-y-2">
        {docs.map(doc => {
          const scanResult = scanResults?.find(r => r.id === doc.id);
          const spFile = scanResult?.sharepointFile ?? (
            doc.sharepointUrl ? { webUrl: doc.sharepointUrl, name: doc.name, size: 0, lastModifiedDateTime: doc.uploadedAt ?? '' } : null
          );

          return (
            <div
              key={doc.id}
              className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                doc.status !== 'pending'
                  ? 'bg-white border-blue-100'
                  : 'bg-gray-50 border-gray-100'
              }`}
            >
              {/* Icône */}
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                doc.status !== 'pending' ? 'bg-blue-50' : 'bg-gray-100'
              }`}>
                <Upload className={`w-4 h-4 ${
                  doc.status !== 'pending' ? 'text-blue-500' : 'text-gray-400'
                }`} />
              </div>

              {/* Contenu */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm text-gray-800">{doc.name}</p>
                  {doc.required && <span className="text-red-400 text-xs">requis</span>}
                </div>

                {/* Infos fichier SharePoint */}
                {spFile && (
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {doc.uploadedAt && (
                      <span className="text-xs text-gray-400">
                        Déposé le {doc.uploadedAt}
                      </span>
                    )}
                    {(spFile as any).size > 0 && (
                      <span className="text-xs text-gray-400">
                        · {formatSize((spFile as any).size)}
                      </span>
                    )}
                    <a
                      href={spFile.webUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-0.5 text-xs text-blue-500 hover:text-blue-700 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" /> Voir dans SharePoint
                    </a>
                  </div>
                )}

                {/* Indicateur trouvé dans le scan mais pas encore marqué */}
                {scanResult?.foundInSharePoint && doc.status === 'pending' && (
                  <p className="text-xs text-emerald-600 mt-0.5">
                    ✅ Trouvé dans SharePoint : {scanResult.sharepointFile?.name}
                  </p>
                )}
              </div>

              {/* Statut + action */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${statusStyle(doc.status)}`}>
                  {statusLabel(doc.status)}
                </span>
                <button
                  onClick={() => toggleDoc(doc.id)}
                  className={`text-xs px-2 py-1 rounded-lg transition-all ${
                    doc.status !== 'pending'
                      ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                  }`}
                >
                  {doc.status !== 'pending' ? 'Annuler' : '+ Reçu'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Bas de page ───────────────────────────────────────────────────────────────── */}
      {!allRequired && (
        <div className="mt-4 flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg p-3">
          <Clock className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-700">
            <p>
              <strong>{requiredDocs.length - requiredReceived} pièce(s) obligatoire(s) manquante(s).</strong>
            </p>
            {clientData.sharepointUploadLink ? (
              <p className="mt-0.5">
                Lien de dépôt envoyé au client : 
                <a
                  href={clientData.sharepointUploadLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                >
                  06 - Documents client
                </a>
                . Cliquez sur « Vérifier dans SharePoint » pour scanner les dépôts récents.
              </p>
            ) : (
              <p className="mt-0.5">
                Créez le dossier SharePoint (étape 4) et envoyez le lien de dépôt au client.
              </p>
            )}
          </div>
        </div>
      )}

      {allRequired && (
        <div className="mt-4 flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-lg p-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <p className="text-xs text-emerald-700">
            Toutes les pièces obligatoires reçues et classées dans SharePoint. Lancer l'analyse IA.
          </p>
        </div>
      )}
    </StepShell>
  );
}
