import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router';
import { Upload, CheckCircle2, AlertCircle, Trash2, Home, Loader2, CreditCard } from 'lucide-react';
import { useDossiersContext } from '../context/DossiersContext';
import { DossierData } from '../utils/localStorage';

/* ─── Upload section ────────────────────────────────────────────────────── */

interface UploadSectionProps {
  label: string;
  hint: string;
  uploaded: boolean;
  icon: React.ReactNode;
  accentColor: string;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => void;
}

function UploadSection({
  label,
  hint,
  uploaded,
  icon,
  accentColor,
  onUpload,
  onRemove,
}: UploadSectionProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.size > 10 * 1024 * 1024) {
      setError('Le fichier ne doit pas dépasser 10 Mo');
      return;
    }
    setError(null);
    setFile(selected);
    if (selected.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(selected);
    } else {
      setPreview(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await onUpload(file);
    } catch (err) {
      console.error('[ClientPortal] Upload failed:', err);
      setError('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
    onRemove();
  };

  if (uploaded) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-800">{label}</p>
            <p className="text-xs text-emerald-600 mt-0.5">Document bien reçu ✓</p>
          </div>
          <button
            onClick={handleRemove}
            className="text-xs text-emerald-600 hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
          >
            Remplacer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 ${accentColor} rounded-xl flex items-center justify-center shrink-0`}>
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800">{label}</p>
          <p className="text-xs text-gray-500">{hint}</p>
        </div>
      </div>

      {!file && (
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/40 transition-all"
        >
          <Upload className="w-7 h-7 text-gray-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-600">Cliquez pour sélectionner un fichier</p>
          <p className="text-xs text-gray-400 mt-1">PDF, JPG ou PNG — max 10 Mo</p>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleSelect}
            className="hidden"
          />
        </div>
      )}

      {file && (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-8 h-8 ${accentColor} rounded-lg flex items-center justify-center shrink-0`}>
                {icon}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(0)} Ko</p>
              </div>
            </div>
            <button onClick={handleRemove} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors ml-2">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {preview && (
            <div className="rounded-xl overflow-hidden border border-gray-100">
              <img src={preview} alt="Aperçu" className="w-full max-h-40 object-contain bg-gray-50" />
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Envoi en cours…
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Envoyer ce document
              </>
            )}
          </button>
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}

/* ─── Thank-you screen ──────────────────────────────────────────────────── */

function ThankYouScreen({ cabinetNom }: { cabinetNom: string }) {
  return (
    <div className="text-center py-8 space-y-5">
      <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-100 rounded-full">
        <CheckCircle2 className="w-10 h-10 text-emerald-500" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-gray-800">Documents bien transmis !</h2>
        <p className="text-gray-600 text-sm leading-relaxed max-w-xs mx-auto">
          Vos documents ont bien été transmis à votre expert-comptable
          {cabinetNom ? ` — ${cabinetNom}` : ''}.
        </p>
        <p className="text-gray-400 text-xs mt-3">
          Votre expert-comptable traitera vos documents dans les meilleurs délais et reviendra vers vous si nécessaire.
        </p>
      </div>
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-left space-y-2">
        <div className="flex items-center gap-2 text-emerald-700 text-sm font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Pièce d'identité reçue
        </div>
        <div className="flex items-center gap-2 text-emerald-700 text-sm font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Justificatif de domicile reçu
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ────────────────────────────────────────────────────── */

export function ClientPortal() {
  const { dossierId } = useParams<{ dossierId: string }>();
  const { getDossier, saveDossier, loading } = useDossiersContext();
  const [dossier, setDossier] = useState<DossierData | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!dossierId) {
      setNotFound(true);
      return;
    }
    const d = getDossier(dossierId);
    if (!d) {
      setNotFound(true);
    } else {
      setDossier(d);
    }
  }, [dossierId, getDossier, loading]);

  const persist = async (patch: Partial<DossierData['clientData']>) => {
    if (!dossier) return;
    const updated: DossierData = {
      ...dossier,
      clientData: { ...dossier.clientData, ...patch },
    };
    setDossier(updated);
    await saveDossier(updated);
  };

  const cabinetNom = dossier?.clientData.raisonSociale ?? dossier?.clientData.nom ?? '';

  const bothDone =
    dossier?.clientData.carteIdentiteUploaded &&
    dossier?.clientData.justificatifDomicileUploaded;

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
          <p className="text-sm text-gray-500">Chargement…</p>
        </div>
      </div>
    );
  }

  /* ── Not found ── */
  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-lg p-8 max-w-sm w-full text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-800">Lien invalide</h2>
          <p className="text-sm text-gray-500">
            Ce lien est introuvable ou a expiré. Veuillez contacter votre expert-comptable.
          </p>
        </div>
      </div>
    );
  }

  if (!dossier) return null;

  return (
    <div className="min-h-screen bg-gray-100/60 flex flex-col items-center py-10 px-4">
      {/* Header — cabinet branding */}
      <header className="mb-8 text-center space-y-1">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl shadow-md mb-3">
          <span className="text-white text-xl font-extrabold select-none">
            {cabinetNom ? cabinetNom.charAt(0).toUpperCase() : 'C'}
          </span>
        </div>
        {cabinetNom && (
          <p className="text-base font-bold text-gray-800">{cabinetNom}</p>
        )}
        <p className="text-xs text-gray-400 uppercase tracking-widest">Espace client sécurisé</p>
      </header>

      {/* Card */}
      <div className="bg-white rounded-3xl shadow-lg w-full max-w-md overflow-hidden">
        <div className="px-6 py-6 border-b border-gray-100">
          <h1 className="text-lg font-bold text-gray-800">Transmettez vos documents</h1>
          <p className="text-sm text-gray-500 mt-1">
            Merci de nous faire parvenir les deux pièces justificatives ci-dessous pour finaliser votre dossier.
          </p>
        </div>

        <div className="px-6 py-6 space-y-4">
          {bothDone ? (
            <ThankYouScreen cabinetNom={cabinetNom} />
          ) : (
            <>
              {/* Progress indicator */}
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                    style={{
                      width: `${
                        (Number(!!dossier.clientData.carteIdentiteUploaded) +
                          Number(!!dossier.clientData.justificatifDomicileUploaded)) *
                        50
                      }%`,
                    }}
                  />
                </div>
                <span className="text-xs text-gray-500 shrink-0">
                  {Number(!!dossier.clientData.carteIdentiteUploaded) +
                    Number(!!dossier.clientData.justificatifDomicileUploaded)}
                  /2 documents
                </span>
              </div>

              {/* Carte d'identité */}
              <UploadSection
                label="Pièce d'identité"
                hint="CNI ou Passeport (recto/verso) — PDF, JPG ou PNG"
                uploaded={!!dossier.clientData.carteIdentiteUploaded}
                icon={<CreditCard className="w-5 h-5 text-indigo-600" />}
                accentColor="bg-indigo-100"
                onUpload={async (file) => {
                  await new Promise((r) => setTimeout(r, 1500));
                  await persist({
                    carteIdentiteUploaded: true,
                    carteIdentiteUrl: `portal://identite_${file.name}`,
                  });
                }}
                onRemove={() =>
                  persist({ carteIdentiteUploaded: false, carteIdentiteUrl: '', carteIdentiteType: '' })
                }
              />

              {/* Justificatif de domicile */}
              <UploadSection
                label="Justificatif de domicile"
                hint="Facture, avis d'imposition ou quittance (- de 3 mois)"
                uploaded={!!dossier.clientData.justificatifDomicileUploaded}
                icon={<Home className="w-5 h-5 text-blue-600" />}
                accentColor="bg-blue-100"
                onUpload={async (file) => {
                  await new Promise((r) => setTimeout(r, 1500));
                  await persist({
                    justificatifDomicileUploaded: true,
                    justificatifDomicileUrl: `portal://domicile_${file.name}`,
                  });
                }}
                onRemove={() =>
                  persist({ justificatifDomicileUploaded: false, justificatifDomicileUrl: '' })
                }
              />

              {/* Info notice */}
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 mt-2">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 leading-relaxed">
                  Vos documents sont transmis de façon sécurisée et ne seront utilisés que dans le cadre de votre dossier.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-8 text-center">
        <p className="text-xs text-gray-400">
          Transmis via CabinetFlow · Données protégées
        </p>
      </footer>
    </div>
  );
}
