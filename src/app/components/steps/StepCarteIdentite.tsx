import { useState, useRef } from 'react';
import { CreditCard, Upload, CheckCircle2, AlertCircle, Trash2, IdCard } from 'lucide-react';
import { useOnboarding } from '../../context/OnboardingContext';
import { StepShell } from '../StepShell';
import { toast } from 'sonner';

export function StepCarteIdentite() {
  const { currentStep, clientData, updateClientData, goNext } = useOnboarding();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState<'cni' | 'passeport'>(
    clientData.carteIdentiteType === 'passeport' ? 'passeport' : 'cni',
  );
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
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(selected);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    await new Promise(r => setTimeout(r, 1500));

    updateClientData({
      carteIdentiteUploaded: true,
      carteIdentiteUrl: `sharepoint://documents/identite_${docType}_${clientData.nom.replace(/\s/g, '_')}.pdf`,
      carteIdentiteType: docType,
    });

    setUploading(false);
    toast.success('Piece d\'identite enregistree');
  };

  const handleRemove = () => {
    setFile(null);
    setPreview(null);
    updateClientData({
      carteIdentiteUploaded: false,
      carteIdentiteUrl: '',
      carteIdentiteType: '',
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleNext = () => {
    if (!clientData.carteIdentiteUploaded) {
      toast.error('Veuillez uploader une piece d\'identite');
      return;
    }
    goNext();
  };

  return (
    <StepShell
      step={currentStep}
      title="Pieces d'identite"
      subtitle="Upload de la carte nationale d'identite ou du passeport du dirigeant"
      type="manuel"
      icon={<CreditCard className="w-5 h-5 text-white" />}
      onNext={handleNext}
      nextDisabled={!clientData.carteIdentiteUploaded}
    >
      <div className="space-y-6">
        {/* Document type selector */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-3">Type de document</p>
          <div className="flex gap-3">
            {[
              { id: 'cni' as const, label: 'Carte nationale d\'identite', desc: 'Recto + Verso' },
              { id: 'passeport' as const, label: 'Passeport', desc: 'Page d\'identite' },
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => setDocType(opt.id)}
                className={`flex-1 border rounded-xl p-4 text-left transition-all ${
                  docType === opt.id
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/20'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <IdCard className={`w-4 h-4 ${docType === opt.id ? 'text-blue-600' : 'text-gray-400'}`} />
                  <p className={`text-sm font-medium ${docType === opt.id ? 'text-blue-800' : 'text-gray-700'}`}>{opt.label}</p>
                </div>
                <p className="text-xs text-gray-500">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Upload area */}
        {!file && !clientData.carteIdentiteUploaded && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all"
          >
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">
              {'Cliquez pour selectionner votre ' + (docType === 'cni' ? 'carte d\'identite' : 'passeport')}
            </p>
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
        {file && !clientData.carteIdentiteUploaded && (
          <div className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 truncate max-w-64">{file.name}</p>
                  <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(0)} Ko - {docType === 'cni' ? 'CNI' : 'Passeport'}</p>
                </div>
              </div>
              <button onClick={handleRemove} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {preview && file.type.startsWith('image/') && (
              <div className="mb-3 rounded-lg overflow-hidden border border-gray-100">
                <img src={preview} alt="Apercu piece identite" className="w-full max-h-48 object-contain bg-gray-50" />
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

        {/* Success */}
        {clientData.carteIdentiteUploaded && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-800">
                  {clientData.carteIdentiteType === 'cni' ? 'Carte d\'identite' : 'Passeport'} enregistre(e)
                </p>
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
            La piece d'identite doit etre en cours de validite. Si vous fournissez une CNI, les deux cotes (recto et verso) doivent etre visibles.
          </p>
        </div>
      </div>
    </StepShell>
  );
}
