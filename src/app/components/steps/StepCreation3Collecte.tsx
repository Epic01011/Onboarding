import { useRef, useState } from 'react';
import { Upload, FileCheck, X, FolderOpen } from 'lucide-react';
import { useOnboarding } from '../../context/OnboardingContext';
import { StepShell } from '../StepShell';
import { toast } from 'sonner';

interface UploadedFile {
  name: string;
  size: number;
}

interface DocZoneProps {
  label: string;
  description?: string;
  uploaded: boolean;
  file: UploadedFile | null;
  onUpload: (file: File) => void;
  onRemove: () => void;
}

function DocZone({ label, description, uploaded, file, onUpload, onRemove }: DocZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = (f: File) => {
    onUpload(f);
    toast.success(`"${f.name}" chargé — sera transmis à la GED (SharePoint).`);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  return (
    <div className={`rounded-xl border-2 border-dashed p-5 transition-all ${
      uploaded
        ? 'border-emerald-300 bg-emerald-50'
        : dragging
        ? 'border-blue-400 bg-blue-50'
        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {uploaded ? (
            <FileCheck className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
          ) : (
            <Upload className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
          )}
          <div className="min-w-0">
            <p className={`text-sm font-medium ${uploaded ? 'text-emerald-700' : 'text-gray-700'}`}>
              {label}
            </p>
            {description && !uploaded && (
              <p className="text-xs text-gray-500 mt-0.5">{description}</p>
            )}
            {uploaded && file && (
              <p className="text-xs text-emerald-600 mt-0.5 truncate">
                {file.name} ({(file.size / 1024).toFixed(0)} Ko)
              </p>
            )}
          </div>
        </div>

        {uploaded ? (
          <button
            onClick={onRemove}
            className="flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors"
            title="Supprimer"
          >
            <X className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => inputRef.current?.click()}
            className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-blue-600 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-all"
          >
            Parcourir
          </button>
        )}
      </div>

      {/* Drop zone */}
      {!uploaded && (
        <div
          className="mt-3 text-center text-xs text-gray-400 py-2 cursor-pointer"
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          Glisser-déposer le fichier ici
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}

export function StepCreation3Collecte() {
  const { clientData, updateClientData, goNext } = useOnboarding();

  const [idFile, setIdFile] = useState<UploadedFile | null>(
    clientData.carteIdentiteUploaded ? { name: clientData.carteIdentiteUrl || 'Pièce d\'identité', size: 0 } : null,
  );
  const [domFile, setDomFile] = useState<UploadedFile | null>(
    clientData.justificatifDomicileUploaded ? { name: clientData.justificatifDomicileUrl || 'Justificatif domicile', size: 0 } : null,
  );
  const [capitalFile, setCapitalFile] = useState<UploadedFile | null>(
    clientData.attestationCapitalUploaded ? { name: clientData.attestationCapitalUrl || 'Attestation dépôt fonds', size: 0 } : null,
  );

  const allUploaded = Boolean(idFile && domFile && capitalFile);

  return (
    <StepShell
      step={3}
      title="Collecte Documentaire"
      subtitle="Déposez les pièces justificatives. Elles seront automatiquement classées dans la GED (SharePoint) du dossier client."
      type="manuel"
      icon={<Upload className="w-5 h-5 text-white" />}
      onNext={goNext}
      nextDisabled={!allUploaded}
      skipLabel="Passer cette étape →"
    >
      {/* GED notice */}
      <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 mb-5">
        <FolderOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
        <p className="text-xs text-blue-700">
          Les fichiers uploadés seront classés dans le dossier SharePoint du client sous{' '}
          <strong>Création / Documents</strong>.
        </p>
      </div>

      <div className="space-y-4">
        <DocZone
          label="Pièce d'identité"
          description="CNI recto-verso ou passeport du dirigeant (PDF ou image)"
          uploaded={Boolean(idFile)}
          file={idFile}
          onUpload={(f) => {
            setIdFile({ name: f.name, size: f.size });
            updateClientData({ carteIdentiteUploaded: true, carteIdentiteUrl: f.name });
          }}
          onRemove={() => {
            setIdFile(null);
            updateClientData({ carteIdentiteUploaded: false, carteIdentiteUrl: '' });
          }}
        />

        <DocZone
          label="Justificatif de domicile"
          description="Facture de moins de 3 mois (électricité, gaz, téléphone fixe…)"
          uploaded={Boolean(domFile)}
          file={domFile}
          onUpload={(f) => {
            setDomFile({ name: f.name, size: f.size });
            updateClientData({ justificatifDomicileUploaded: true, justificatifDomicileUrl: f.name });
          }}
          onRemove={() => {
            setDomFile(null);
            updateClientData({ justificatifDomicileUploaded: false, justificatifDomicileUrl: '' });
          }}
        />

        <DocZone
          label="Attestation de dépôt des fonds"
          description="Attestation bancaire de dépôt du capital social"
          uploaded={Boolean(capitalFile)}
          file={capitalFile}
          onUpload={(f) => {
            setCapitalFile({ name: f.name, size: f.size });
            updateClientData({ attestationCapitalUploaded: true, attestationCapitalUrl: f.name });
          }}
          onRemove={() => {
            setCapitalFile(null);
            updateClientData({ attestationCapitalUploaded: false, attestationCapitalUrl: '' });
          }}
        />
      </div>

      {allUploaded && (
        <div className="mt-5 flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
          <FileCheck className="w-4 h-4 flex-shrink-0" />
          Tous les documents sont collectés. Vous pouvez passer à l'étape suivante.
        </div>
      )}
    </StepShell>
  );
}
