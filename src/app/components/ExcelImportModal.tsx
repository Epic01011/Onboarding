/**
 * Excel Import Modal Component
 *
 * Allows users to import prospect data from Excel files with:
 * - Drag & drop or click to upload
 * - Template download option
 * - Real-time validation and error reporting
 * - Import preview before confirmation
 */

import { useState, useRef } from 'react';
import { X, Upload, Download, CheckCircle2, AlertCircle, FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  parseExcelFile,
  validateExcelFile,
  downloadExcelTemplate,
  type ExcelImportResult,
} from '../utils/excelUtils';
import type { Prospect } from '../services/prospectApi';
import { useProspectStore, type ProspectInput } from '../store/useProspectStore';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (prospects: Partial<Prospect>[]) => void;
}

type ImportStatus = 'idle' | 'uploading' | 'parsing' | 'preview' | 'importing' | 'done' | 'error';

export function ExcelImportModal({ isOpen, onClose, onImport }: ExcelImportModalProps) {
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ExcelImportResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progressCount, setProgressCount] = useState<{ done: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const batchImportProspects = useProspectStore(state => state.batchImportProspects);

  if (!isOpen) return null;

  // ── File selection handlers ──────────────────────────────────────────────

  const handleFileSelect = async (selectedFile: File) => {
    // Validate file
    const validation = validateExcelFile(selectedFile);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setFile(selectedFile);
    setStatus('parsing');

    try {
      // Parse Excel file
      const result = await parseExcelFile(selectedFile);
      setParseResult(result);

      if (result.success && result.prospects.length > 0) {
        setStatus('preview');
        toast.success(`${result.prospects.length} prospect(s) détecté(s)`);
      } else {
        setStatus('error');
        toast.error('Aucun prospect valide trouvé dans le fichier');
      }
    } catch (error) {
      setStatus('error');
      toast.error('Erreur lors de l\'analyse du fichier');
      console.error('Parse error:', error);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) void handleFileSelect(droppedFile);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) void handleFileSelect(selectedFile);
  };

  // ── Import confirmation ──────────────────────────────────────────────────

  const handleConfirmImport = async () => {
    if (!parseResult || parseResult.prospects.length === 0) return;

    setStatus('importing');
    setProgressCount({ done: 0, total: parseResult.prospects.length });

    // Convert Partial<Prospect> → ProspectInput for the store
    const inputs: ProspectInput[] = parseResult.prospects.map(p => ({
      company_name:            p.nomSociete ?? '',
      siren:                   p.siren,
      siret:                   p.siret,
      contact_email:           p.email,
      telephone:               p.telephone,
      naf_code:                p.codeNAF,
      libelle_naf:             p.libelleNAF,
      secteur_activite:        p.secteur,
      forme_juridique:         p.formeJuridique,
      libelle_forme_juridique: p.libelleFormeJuridique,
      // Map Prospect's French camelCase fields to the English DB column names
      address:                 p.adresse,
      postal_code:             p.codePostal,
      city:                    p.ville,
      departement:             p.departement,
      date_creation:           p.dateCreation,
      effectif:                p.effectif,
      capital_social:          p.capitalSocial,
      categorie_entreprise:    p.categorieEntreprise,
      dirigeants:              p.dirigeants,
      dirigeant_principal:     p.dirigeantPrincipal as Record<string, unknown> | undefined,
    }));

    try {
      const result = await batchImportProspects(
        inputs,
        (done, total) => setProgressCount({ done, total })
      );

      // Also call the local-state callback so Prospection.tsx stays in sync
      onImport(parseResult.prospects);

      if (!result.success) {
        setStatus('error');
        toast.error(`Erreur d'import : ${result.error}`);
        return;
      }

      setStatus('done');
      toast.success(
        `${result.added} prospect(s) sauvegardé(s)${result.skipped > 0 ? ` · ${result.skipped} ignoré(s) (doublons)` : ''}`
      );

      // Close modal after 1.5s
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err) {
      setStatus('error');
      toast.error('Erreur lors de l\'import. Veuillez réessayer.');
      console.error('[ExcelImportModal] batchImportProspects:', err);
    }
  };

  // ── Reset and close ──────────────────────────────────────────────────────

  const handleClose = () => {
    setStatus('idle');
    setFile(null);
    setParseResult(null);
    setIsDragging(false);
    setProgressCount(null);
    onClose();
  };

  const handleReset = () => {
    setStatus('idle');
    setFile(null);
    setParseResult(null);
    setProgressCount(null);
  };

  const handleDownloadTemplate = () => {
    downloadExcelTemplate();
    toast.success('Modèle Excel téléchargé');
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Importer des prospects depuis Excel
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Utilisez notre modèle pour faciliter l'import
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Download Template Section */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-start gap-3">
              <Download className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-blue-900 mb-1">
                  Télécharger le modèle d'import
                </h3>
                <p className="text-sm text-blue-700 mb-3">
                  Utilisez notre modèle Excel pré-formaté avec des exemples et des instructions pour faciliter votre import.
                </p>
                <button
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  Télécharger le modèle
                </button>
              </div>
            </div>
          </div>

          {/* Upload Zone */}
          {(status === 'idle' || status === 'error') && (
            <div>
              <h3 className="font-medium text-gray-900 mb-3">
                Charger votre fichier Excel
              </h3>
              <div
                onDrop={handleDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                className={`
                  border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer
                  ${isDragging
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                  }
                `}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                    <Upload className="w-8 h-8 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-gray-700 font-medium mb-1">
                      Glissez-déposez votre fichier Excel ici
                    </p>
                    <p className="text-sm text-gray-500">
                      ou cliquez pour parcourir vos fichiers
                    </p>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Formats acceptés : .xlsx, .xls • Taille max : 10 Mo
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Parsing State */}
          {status === 'parsing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
              <p className="text-gray-700 font-medium mb-1">
                Analyse du fichier en cours...
              </p>
              <p className="text-sm text-gray-500">
                {file?.name}
              </p>
            </div>
          )}

          {/* Preview State */}
          {status === 'preview' && parseResult && (
            <div>
              <div className="mb-4">
                <h3 className="font-medium text-gray-900 mb-2">
                  Aperçu de l'import
                </h3>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>{file?.name}</span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-900">Valides</span>
                  </div>
                  <p className="text-2xl font-bold text-emerald-600">
                    {parseResult.prospects.length}
                  </p>
                </div>

                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-900">Avertissements</span>
                  </div>
                  <p className="text-2xl font-bold text-amber-600">
                    {parseResult.warnings.length}
                  </p>
                </div>

                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <X className="w-4 h-4 text-red-600" />
                    <span className="text-sm font-medium text-red-900">Erreurs</span>
                  </div>
                  <p className="text-2xl font-bold text-red-600">
                    {parseResult.errors.length}
                  </p>
                </div>
              </div>

              {/* Errors */}
              {parseResult.errors.length > 0 && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="font-medium text-red-900 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Erreurs bloquantes
                  </h4>
                  <ul className="text-sm text-red-700 space-y-1 max-h-32 overflow-y-auto">
                    {parseResult.errors.slice(0, 10).map((error, i) => (
                      <li key={i}>• {error}</li>
                    ))}
                    {parseResult.errors.length > 10 && (
                      <li className="text-red-600 italic">
                        ... et {parseResult.errors.length - 10} autre(s) erreur(s)
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Warnings */}
              {parseResult.warnings.length > 0 && (
                <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <h4 className="font-medium text-amber-900 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Avertissements
                  </h4>
                  <ul className="text-sm text-amber-700 space-y-1 max-h-32 overflow-y-auto">
                    {parseResult.warnings.slice(0, 10).map((warning, i) => (
                      <li key={i}>• {warning}</li>
                    ))}
                    {parseResult.warnings.length > 10 && (
                      <li className="text-amber-600 italic">
                        ... et {parseResult.warnings.length - 10} autre(s) avertissement(s)
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Preview Table */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <h4 className="font-medium text-gray-700 text-sm">
                    Aperçu des données ({parseResult.prospects.slice(0, 5).length} premières lignes)
                  </h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">SIREN</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Société</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Forme</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Ville</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parseResult.prospects.slice(0, 5).map((prospect, i) => (
                        <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-700">{prospect.siren}</td>
                          <td className="px-4 py-2 text-gray-900 font-medium">{prospect.nomSociete}</td>
                          <td className="px-4 py-2 text-gray-600">{prospect.formeJuridique}</td>
                          <td className="px-4 py-2 text-gray-600">{prospect.ville}</td>
                          <td className="px-4 py-2 text-gray-600">{prospect.email || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Importing State */}
          {status === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
              <p className="text-gray-700 font-medium mb-1">
                {progressCount
                  ? `Enrichissement via API SIREN… ${progressCount.done}/${progressCount.total}`
                  : 'Import en cours…'}
              </p>
              {progressCount && progressCount.total > 0 && (
                <div className="w-full max-w-xs mt-3">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-300"
                      style={{ width: `${Math.round((progressCount.done / progressCount.total) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 text-center mt-1">
                    {Math.round((progressCount.done / progressCount.total) * 100)}%
                  </p>
                </div>
              )}
              <p className="text-sm text-gray-500 mt-3">
                Les données sont enrichies (NAF, secteur, dirigeant) avant sauvegarde
              </p>
            </div>
          )}

          {/* Done State */}
          {status === 'done' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <p className="text-gray-900 font-semibold text-lg mb-1">
                Import réussi !
              </p>
              <p className="text-sm text-gray-500">
                Les prospects ont été ajoutés à votre liste
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              {status === 'preview' && (
                <button
                  onClick={handleReset}
                  className="text-sm text-gray-600 hover:text-gray-900 font-medium"
                >
                  ← Changer de fichier
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium"
              >
                Annuler
              </button>
              {status === 'preview' && parseResult && parseResult.prospects.length > 0 && (
                <button
                  onClick={handleConfirmImport}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <Upload className="w-4 h-4" />
                  Importer {parseResult.prospects.length} prospect{parseResult.prospects.length > 1 ? 's' : ''}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
