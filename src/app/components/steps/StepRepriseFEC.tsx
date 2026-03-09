import { useState, useRef } from 'react';
import { Database, Upload, CheckCircle2, AlertCircle, FileText, RefreshCw } from 'lucide-react';
import { useOnboarding } from '../../context/OnboardingContext';
import { StepShell } from '../StepShell';

interface FECBalance {
  compte: string;
  libelle: string;
  debit: string;
  credit: string;
  verified: boolean;
}

const OPENING_BALANCES: Omit<FECBalance, 'verified'>[] = [
  { compte: '101xxx', libelle: 'Capital social', debit: '', credit: '' },
  { compte: '106xxx', libelle: 'Réserves', debit: '', credit: '' },
  { compte: '401xxx', libelle: 'Fournisseurs', debit: '', credit: '' },
  { compte: '411xxx', libelle: 'Clients', debit: '', credit: '' },
  { compte: '512xxx', libelle: 'Banques', debit: '', credit: '' },
  { compte: '401100', libelle: 'Fournisseurs divers', debit: '', credit: '' },
  { compte: '445xxx', libelle: 'TVA', debit: '', credit: '' },
];

type UploadStatus = 'idle' | 'uploading' | 'done' | 'error';

export function StepRepriseFEC() {
  const { goNext, goPrev, clientData } = useOnboarding();

  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [fecLines, setFecLines] = useState(0);
  const [balances, setBalances] = useState<FECBalance[]>(
    OPENING_BALANCES.map(b => ({ ...b, verified: false }))
  );
  const [notes, setNotes] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    setUploadStatus('uploading');
    setUploadedFileName(file.name);
    // Simulate FEC parsing
    await new Promise(r => setTimeout(r, 1500));
    const lines = Math.floor(Math.random() * 8000) + 2000;
    setFecLines(lines);
    setUploadStatus('done');
    // Auto-fill demo balances
    setBalances(prev => prev.map(b => ({
      ...b,
      debit: b.debit || String((Math.random() * 50000).toFixed(2)),
      credit: b.credit || String((Math.random() * 50000).toFixed(2)),
    })));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) void handleFileSelect(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFileSelect(file);
  };

  const toggleVerified = (idx: number) => {
    setBalances(prev => prev.map((b, i) => i === idx ? { ...b, verified: !b.verified } : b));
  };

  const updateBalance = (idx: number, field: 'debit' | 'credit', value: string) => {
    setBalances(prev => prev.map((b, i) => i === idx ? { ...b, [field]: value } : b));
  };

  const allVerified = balances.every(b => b.verified);
  const verifiedCount = balances.filter(b => b.verified).length;

  return (
    <StepShell
      step={8}
      title="Reprise Technique — FEC"
      subtitle="Upload du Fichier des Écritures Comptables (FEC) et validation des soldes d'ouverture pour la reprise comptable."
      type="manuel"
      icon={<Database className="w-5 h-5 text-white" />}
      onBack={goPrev}
      onNext={goNext}
      nextLabel="Étape suivante →"
      nextDisabled={uploadStatus !== 'done'}
    >
      {/* Client info */}
      <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl mb-5 text-sm text-gray-700">
        <FileText className="w-4 h-4 text-blue-600" />
        <span className="font-medium">{clientData.raisonSociale || clientData.nom}</span>
        <span className="text-gray-400">·</span>
        <span className="text-gray-500">SIREN {clientData.siren}</span>
      </div>

      {/* FEC upload zone */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-800 mb-3 flex items-center gap-2">
          <Upload className="w-4 h-4 text-blue-600" />
          1. Import du FEC (Fichier des Écritures Comptables)
        </h3>

        {uploadStatus === 'idle' || uploadStatus === 'uploading' ? (
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              uploadStatus === 'uploading'
                ? 'border-blue-300 bg-blue-50'
                : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.csv,.fec"
              className="hidden"
              onChange={handleFileChange}
            />
            {uploadStatus === 'uploading' ? (
              <div>
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
                <p className="text-sm text-blue-600">Analyse du FEC en cours...</p>
                <p className="text-xs text-blue-400 mt-1">{uploadedFileName}</p>
              </div>
            ) : (
              <div>
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-gray-600 font-medium">Déposer le FEC ici ou cliquer pour sélectionner</p>
                <p className="text-xs text-gray-400 mt-1">Formats acceptés : .txt, .csv, .fec — Format DGFiP obligatoire</p>
              </div>
            )}
          </div>
        ) : uploadStatus === 'done' ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-emerald-800">FEC importé avec succès</p>
              <p className="text-xs text-emerald-600">{uploadedFileName} — {fecLines.toLocaleString('fr-FR')} lignes d'écritures</p>
            </div>
            <button onClick={() => { setUploadStatus('idle'); setUploadedFileName(''); }}
              className="text-xs text-emerald-600 hover:text-emerald-700 underline">Changer</button>
          </div>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">Erreur lors du traitement du FEC. Vérifiez le format.</p>
          </div>
        )}
      </div>

      {/* Opening balances checklist */}
      {uploadStatus === 'done' && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              2. Validation des soldes d'ouverture ({verifiedCount}/{balances.length})
            </h3>
            <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(verifiedCount / balances.length) * 100}%` }} />
            </div>
          </div>

          <div className="space-y-2">
            {balances.map((balance, i) => (
              <div key={i} className={`border rounded-xl p-3 transition-all ${
                balance.verified ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white'
              }`}>
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleVerified(i)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      balance.verified ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 hover:border-emerald-400'
                    }`}>
                    {balance.verified && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">{balance.compte}</span>
                      <span className="text-sm text-gray-800 truncate">{balance.libelle}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col items-end gap-1">
                      <input
                        type="number"
                        placeholder="Débit"
                        value={balance.debit}
                        onChange={e => updateBalance(i, 'debit', e.target.value)}
                        className="w-24 px-2 py-1 text-xs border border-gray-200 rounded outline-none focus:border-blue-400 text-right"
                      />
                      <input
                        type="number"
                        placeholder="Crédit"
                        value={balance.credit}
                        onChange={e => updateBalance(i, 'credit', e.target.value)}
                        className="w-24 px-2 py-1 text-xs border border-gray-200 rounded outline-none focus:border-blue-400 text-right"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {allVerified && (
            <div className="mt-3 flex items-center gap-2 text-emerald-700 text-xs">
              <CheckCircle2 className="w-4 h-4" />
              Tous les soldes d'ouverture validés — Reprise comptable prête.
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      {uploadStatus === 'done' && (
        <div>
          <label className="block text-sm text-gray-700 mb-1.5">Notes de reprise (anomalies, écarts)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Ex : Écart de 150€ sur le compte 512 à régulariser..."
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 resize-none"
          />
        </div>
      )}
    </StepShell>
  );
}
