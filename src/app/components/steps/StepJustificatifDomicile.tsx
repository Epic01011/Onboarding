import { useState, useRef } from 'react';
import { Home, Upload, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import { useOnboarding } from '../../context/OnboardingContext';
import { StepShell } from '../StepShell';
import { toast } from 'sonner';

export function StepJustificatifDomicile() {
  const { currentStep, clientData, updateClientData, goNext } = useOnboarding();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (selected.size > maxSize) {
      toast.error('Le fichier ne doit pas depasser 10 Mo');
      return;
    }

    setFile(selected);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(selected);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);

    // Simulate upload (in real app, would upload to SharePoint)
    await new Promise(r => setTimeout(r, 1500));

    updateClientData({
      justificatifDomicileUploaded: true,
      justificatifDomicileUrl: `sharepoint://documents/justificatif_domicile_${clientData.nom.replace(/\s/g, '_')}.pdf`,
    });

    setUploading(false);
    toast.success('Justificatif de domicile enregistre');
  };

  const handleRemove = () => {
    setFile(null);
    setPreview(null);
    updateClientData({
      justificatifDomicileUploaded: false,
      justificatifDomicileUrl: '',
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleNext = () => {
    if (!clientData.justificatifDomicileUploaded) {
      toast.error('Veuillez uploader un justificatif de domicile');
      return;
    }
    goNext();
  };

  const acceptedTypes = [
    'Facture electricite / gaz / eau (moins de 3 mois)',
    'Avis d\'imposition',
    'Quittance de loyer',
    'Attestation d\'hebergement + piece d\'identite de l\'hebergeant',
    'Titre de propriete',
  ];

  return (
    <StepShell
      step={currentStep}
      title="Justificatif de domicile"
      subtitle="Upload du justificatif de domicile du dirigeant ou du siege social de la societe"
      type="manuel"
      icon={<Home className="w-5 h-5 text-white" />}
      onNext={handleNext}
      nextDisabled={!clientData.justificatifDomicileUploaded}
    >
      <div className="space-y-6">
        {/* Accepted documents */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm font-medium text-blue-800 mb-2">Documents acceptes</p>
          <ul className="space-y-1.5">
            {acceptedTypes.map((type, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-blue-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                {type}
              </li>
            ))}
          </ul>
        </div>

        {/* Upload area */}
        {!file && !clientData.justificatifDomicileUploaded && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all"
          >
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">Cliquez pour selectionner un fichier</p>
            <p className="text-xs text-gray-500 mt-1">PDF, JPG ou PNG - Max 10 Mo</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        )}

        {/* File preview */}
        {file && !clientData.justificatifDomicileUploaded && (
          <div className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Home className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 truncate max-w-64">{file.name}</p>
                  <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(0)} Ko</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleRemove} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {preview && file.type.startsWith('image/') && (
              <div className="mb-3 rounded-lg overflow-hidden border border-gray-100">
                <img src={preview} alt="Apercu justificatif" className="w-full max-h-48 object-contain bg-gray-50" />
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Upload en cours...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" /> Valider et enregistrer
                </>
              )}
            </button>
          </div>
        )}

        {/* Success state */}
        {clientData.justificatifDomicileUploaded && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-800">Justificatif de domicile enregistre</p>
                <p className="text-xs text-emerald-600 mt-0.5">Le document sera archive dans l'espace client SharePoint</p>
              </div>
              <button
                onClick={handleRemove}
                className="text-xs text-emerald-600 hover:text-red-600 px-2 py-1 rounded transition-colors"
              >
                Remplacer
              </button>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            Le justificatif doit dater de moins de 3 mois et indiquer clairement le nom et l'adresse du dirigeant ou du siege social.
          </p>
        </div>
      </div>
    </StepShell>
  );
}
