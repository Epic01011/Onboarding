import { useState, useRef } from 'react';
import { Landmark, Upload, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import { useOnboarding } from '../../context/OnboardingContext';
import { StepShell } from '../StepShell';
import { toast } from 'sonner';

export function StepAttestationCapital() {
  const { currentStep, clientData, updateClientData, goNext } = useOnboarding();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    const maxSize = 10 * 1024 * 1024;
    if (selected.size > maxSize) {
      toast.error('Le fichier ne doit pas depasser 10 Mo');
      return;
    }
    setFile(selected);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    await new Promise(r => setTimeout(r, 1500));

    updateClientData({
      attestationCapitalUploaded: true,
      attestationCapitalUrl: `sharepoint://documents/attestation_capital_${clientData.nom.replace(/\s/g, '_')}.pdf`,
    });

    setUploading(false);
    toast.success('Attestation de depot de capital enregistree');
  };

  const handleRemove = () => {
    setFile(null);
    updateClientData({
      attestationCapitalUploaded: false,
      attestationCapitalUrl: '',
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleNext = () => {
    if (!clientData.attestationCapitalUploaded) {
      toast.error('Veuillez uploader l\'attestation de depot de capital');
      return;
    }
    goNext();
  };

  return (
    <StepShell
      step={currentStep}
      title="Attestation de depot de capital"
      subtitle="Upload de l'attestation bancaire de depot du capital social"
      type="manuel"
      icon={<Landmark className="w-5 h-5 text-white" />}
      onNext={handleNext}
      nextDisabled={!clientData.attestationCapitalUploaded}
    >
      <div className="space-y-6">
        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm font-medium text-blue-800 mb-2">A propos de cette etape</p>
          <div className="space-y-1.5 text-xs text-blue-700">
            <p>L'attestation de depot de capital est un document bancaire qui certifie que les fonds constituant le capital social ont ete deposes sur un compte bancaire bloque.</p>
            <p>Ce document est obligatoire pour l'immatriculation de la societe au RCS.</p>
          </div>
        </div>

        {/* Capital info from collected data */}
        {clientData.capital && (
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Capital social declare</p>
                <p className="text-sm font-medium text-gray-900">{clientData.capital} EUR</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Forme juridique</p>
                <p className="text-sm font-medium text-gray-900">{clientData.formeJuridique || '-'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Upload area */}
        {!file && !clientData.attestationCapitalUploaded && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all"
          >
            <Landmark className="w-8 h-8 text-gray-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">Cliquez pour selectionner l'attestation</p>
            <p className="text-xs text-gray-500 mt-1">PDF uniquement - Max 10 Mo</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        )}

        {/* File selected */}
        {file && !clientData.attestationCapitalUploaded && (
          <div className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Landmark className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 truncate max-w-64">{file.name}</p>
                  <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(0)} Ko</p>
                </div>
              </div>
              <button onClick={handleRemove} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

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

        {/* Success */}
        {clientData.attestationCapitalUploaded && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-800">Attestation de depot de capital enregistree</p>
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

        {/* Warning */}
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            L'attestation doit etre delivree par la banque ou le notaire et mentionner le montant exact du capital depose,
            ainsi que la denomination de la societe en cours de constitution.
          </p>
        </div>
      </div>
    </StepShell>
  );
}
