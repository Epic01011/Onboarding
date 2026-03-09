import { useState } from 'react';
import { FileText, CheckCircle2, AlertCircle, Save } from 'lucide-react';
import { useOnboarding } from '../../context/OnboardingContext';
import { StepShell } from '../StepShell';
import { toast } from 'sonner';

interface M0Field {
  key: string;
  label: string;
  placeholder: string;
  type?: string;
  prefillKey?: keyof ReturnType<typeof useOnboarding>['clientData'];
  colSpan?: number;
}

const m0Fields: M0Field[] = [
  { key: 'denomination', label: 'Denomination sociale', placeholder: 'Nom de la societe', prefillKey: 'raisonSociale', colSpan: 2 },
  { key: 'sigle', label: 'Sigle (optionnel)', placeholder: 'Ex: ABC' },
  { key: 'formeJuridique', label: 'Forme juridique', placeholder: 'SARL, SAS, EURL...', prefillKey: 'formeJuridique' },
  { key: 'capitalSocial', label: 'Capital social', placeholder: 'Ex: 1 000', prefillKey: 'capital' },
  { key: 'capitalType', label: 'Type de capital', placeholder: 'Fixe / Variable' },
  { key: 'siegeSocial', label: 'Adresse du siege social', placeholder: 'Adresse complete', prefillKey: 'adresse', colSpan: 2 },
  { key: 'codePostal', label: 'Code postal', placeholder: '75001', prefillKey: 'codePostal' },
  { key: 'ville', label: 'Ville', placeholder: 'Paris', prefillKey: 'ville' },
  { key: 'activitePrincipale', label: 'Activite principale', placeholder: 'Description de l\'activite', colSpan: 2 },
  { key: 'dateDebut', label: 'Date de debut d\'activite', placeholder: 'JJ/MM/AAAA', type: 'date' },
  { key: 'duree', label: 'Duree de la societe', placeholder: 'Ex: 99 ans' },
  { key: 'dateClotureExo', label: 'Date de cloture du 1er exercice', placeholder: 'JJ/MM/AAAA', type: 'date' },
  { key: 'dirigeantNom', label: 'Nom du dirigeant', placeholder: 'Nom complet', prefillKey: 'nom' },
  { key: 'dirigeantFonction', label: 'Fonction', placeholder: 'Gerant / President' },
  { key: 'dirigeantDateNaissance', label: 'Date de naissance', placeholder: 'JJ/MM/AAAA', type: 'date' },
  { key: 'dirigeantLieuNaissance', label: 'Lieu de naissance', placeholder: 'Ville, Pays' },
  { key: 'dirigeantNationalite', label: 'Nationalite', placeholder: 'Francaise' },
  { key: 'dirigeantAdresse', label: 'Adresse personnelle du dirigeant', placeholder: 'Adresse complete', colSpan: 2 },
];

export function StepFormulaireM0() {
  const { currentStep, clientData, updateClientData, goNext } = useOnboarding();
  const [saving, setSaving] = useState(false);

  // Initialize form data from clientData prefills
  const [formData, setFormData] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = { ...clientData.formulaireM0Data };
    m0Fields.forEach(f => {
      if (f.prefillKey && !initial[f.key]) {
        const val = clientData[f.prefillKey];
        if (typeof val === 'string') initial[f.key] = val;
      }
    });
    return initial;
  });

  const updateField = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const requiredFields = ['denomination', 'formeJuridique', 'siegeSocial', 'activitePrincipale', 'dirigeantNom'];
  const isComplete = requiredFields.every(k => formData[k]?.trim());

  const handleSave = async () => {
    if (!isComplete) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setSaving(true);
    await new Promise(r => setTimeout(r, 1000));

    updateClientData({
      formulaireM0Rempli: true,
      formulaireM0Data: formData,
    });

    setSaving(false);
    toast.success('Formulaire M0 enregistre');
  };

  const handleNext = () => {
    if (!clientData.formulaireM0Rempli) {
      toast.error('Veuillez sauvegarder le formulaire M0');
      return;
    }
    goNext();
  };

  const filledCount = m0Fields.filter(f => formData[f.key]?.trim()).length;

  return (
    <StepShell
      step={currentStep}
      title="Formulaire M0"
      subtitle="Declaration de creation d'entreprise - Formulaire pre-rempli avec les donnees collectees"
      type="manuel"
      icon={<FileText className="w-5 h-5 text-white" />}
      onNext={handleNext}
      nextDisabled={!clientData.formulaireM0Rempli}
    >
      <div className="space-y-6">
        {/* Progress */}
        <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
          <p className="text-sm text-gray-600">{filledCount} / {m0Fields.length} champs remplis</p>
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${(filledCount / m0Fields.length) * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">{Math.round((filledCount / m0Fields.length) * 100)}%</span>
          </div>
        </div>

        {/* Pre-fill notice */}
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">
            Les champs ont ete pre-remplis avec les informations collectees lors des etapes precedentes.
            Vous pouvez modifier toutes les valeurs avant de sauvegarder.
          </p>
        </div>

        {/* Form fields */}
        <div className="grid grid-cols-2 gap-4">
          {m0Fields.map(f => (
            <div key={f.key} className={f.colSpan === 2 ? 'col-span-2' : ''}>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                {f.label}
                {requiredFields.includes(f.key) && <span className="text-red-400 ml-1">*</span>}
              </label>
              <input
                type={f.type || 'text'}
                value={formData[f.key] || ''}
                onChange={e => updateField(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
          ))}
        </div>

        {/* Save button */}
        {!clientData.formulaireM0Rempli ? (
          <button
            onClick={handleSave}
            disabled={!isComplete || saving}
            className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Sauvegarder le formulaire M0
              </>
            )}
          </button>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <div>
                <p className="text-sm font-medium text-emerald-800">Formulaire M0 enregistre</p>
                <p className="text-xs text-emerald-600 mt-0.5">Toutes les informations ont ete sauvegardees.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </StepShell>
  );
}
