import { useState } from 'react';
import { FileSpreadsheet, CheckCircle2, AlertCircle, Save, ToggleLeft, ToggleRight } from 'lucide-react';
import { useOnboarding } from '../../context/OnboardingContext';
import { StepShell } from '../StepShell';
import { toast } from 'sonner';

interface DAS2Beneficiary {
  nom: string;
  siren: string;
  montant: string;
  nature: string;
}

export function StepDAS2() {
  const { currentStep, clientData, updateClientData, goNext } = useOnboarding();
  const [nonApplicable, setNonApplicable] = useState(clientData.das2NonApplicable);
  const [saving, setSaving] = useState(false);
  const [beneficiaries, setBeneficiaries] = useState<DAS2Beneficiary[]>([
    { nom: '', siren: '', montant: '', nature: 'Honoraires' },
  ]);

  const handleToggleNA = () => {
    const newVal = !nonApplicable;
    setNonApplicable(newVal);
    if (newVal) {
      updateClientData({
        das2NonApplicable: true,
        das2Completed: true,
      });
      toast.info('DAS2 marquee comme non applicable');
    } else {
      updateClientData({
        das2NonApplicable: false,
        das2Completed: false,
      });
    }
  };

  const addBeneficiary = () => {
    setBeneficiaries(prev => [...prev, { nom: '', siren: '', montant: '', nature: 'Honoraires' }]);
  };

  const updateBeneficiary = (index: number, field: keyof DAS2Beneficiary, value: string) => {
    setBeneficiaries(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeBeneficiary = (index: number) => {
    setBeneficiaries(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 1000));

    updateClientData({
      das2Completed: true,
      das2NonApplicable: false,
    });

    setSaving(false);
    toast.success('Declaration DAS2 enregistree');
  };

  const handleNext = () => {
    if (!clientData.das2Completed) {
      toast.error('Veuillez completer ou marquer comme non applicable la DAS2');
      return;
    }
    goNext();
  };

  return (
    <StepShell
      step={currentStep}
      title="DAS2"
      subtitle="Declaration des honoraires, commissions et vacations versees a des tiers"
      type="conditionnel"
      icon={<FileSpreadsheet className="w-5 h-5 text-white" />}
      onNext={handleNext}
      nextDisabled={!clientData.das2Completed}
    >
      <div className="space-y-6">
        {/* Non applicable toggle */}
        <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
          <div>
            <p className="text-sm font-medium text-gray-800">Non applicable</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Cochez si la societe n'a verse aucun honoraire soumis a declaration DAS2
            </p>
          </div>
          <button onClick={handleToggleNA} className="flex-shrink-0">
            {nonApplicable ? (
              <ToggleRight className="w-10 h-10 text-blue-600" />
            ) : (
              <ToggleLeft className="w-10 h-10 text-gray-400" />
            )}
          </button>
        </div>

        {nonApplicable && clientData.das2Completed && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <p className="text-sm font-medium text-emerald-800">DAS2 non applicable - Etape validee</p>
            </div>
          </div>
        )}

        {/* Form when applicable */}
        {!nonApplicable && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                Declarez tous les beneficiaires ayant recu plus de 1 200 EUR d'honoraires au cours de l'exercice.
                Cette declaration est obligatoire pour toute entreprise versant des commissions, honoraires ou vacations.
              </p>
            </div>

            {/* Beneficiaries */}
            {beneficiaries.map((b, i) => (
              <div key={i} className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-gray-600">Beneficiaire {i + 1}</p>
                  {beneficiaries.length > 1 && (
                    <button
                      onClick={() => removeBeneficiary(i)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Retirer
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Nom / Raison sociale</label>
                    <input
                      type="text"
                      value={b.nom}
                      onChange={e => updateBeneficiary(i, 'nom', e.target.value)}
                      placeholder="Nom du beneficiaire"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">SIREN</label>
                    <input
                      type="text"
                      value={b.siren}
                      onChange={e => updateBeneficiary(i, 'siren', e.target.value)}
                      placeholder="123 456 789"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Montant (EUR)</label>
                    <input
                      type="text"
                      value={b.montant}
                      onChange={e => updateBeneficiary(i, 'montant', e.target.value)}
                      placeholder="1 500"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Nature</label>
                    <select
                      value={b.nature}
                      onChange={e => updateBeneficiary(i, 'nature', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="Honoraires">Honoraires</option>
                      <option value="Commissions">Commissions</option>
                      <option value="Vacations">Vacations</option>
                      <option value="Courtages">Courtages</option>
                      <option value="Jetons de presence">Jetons de presence</option>
                      <option value="Droits d'auteur">{"Droits d'auteur"}</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}

            <button
              onClick={addBeneficiary}
              className="w-full py-2 border border-dashed border-gray-300 rounded-xl text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-all"
            >
              + Ajouter un beneficiaire
            </button>

            {/* Save */}
            {!clientData.das2Completed ? (
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Enregistrer la declaration DAS2
                  </>
                )}
              </button>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <p className="text-sm font-medium text-emerald-800">Declaration DAS2 enregistree</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </StepShell>
  );
}
