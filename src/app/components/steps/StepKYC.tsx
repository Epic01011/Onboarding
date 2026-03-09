import { useState } from 'react';
import { Shield, User, Building2, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { useOnboarding } from '../../context/OnboardingContext';
import { StepShell } from '../StepShell';

type RiskScore = 'low' | 'medium' | 'high';

interface Director {
  nom: string;
  prenom: string;
  dateNaissance: string;
  nationalite: string;
  fonctionPoste: string;
  pourcentageCapital: string;
}

interface UBOEntry {
  nom: string;
  prenom: string;
  pourcentage: string;
  dateNaissance: string;
}

const RISK_FACTORS = [
  { id: 'paysRisque', label: 'Pays à risque (GAFI)', weight: 3 },
  { id: 'activiteRisque', label: 'Secteur à risque (cash intensif, immobilier...)', weight: 3 },
  { id: 'pep', label: 'Personne Politiquement Exposée (PPE)', weight: 2 },
  { id: 'structureComplexe', label: 'Structure holding / montage complexe', weight: 2 },
  { id: 'transactionsAtypiques', label: 'Transactions atypiques ou flux inhabituels', weight: 2 },
  { id: 'clientNouv', label: 'Client nouvellement constitué (< 6 mois)', weight: 1 },
] as const;

type RiskFactorId = (typeof RISK_FACTORS)[number]['id'];

export function StepKYC() {
  const { goNext, goPrev, clientData } = useOnboarding();

  const [directors, setDirectors] = useState<Director[]>([{
    nom: (clientData.nom.trim().split(' ').pop() ?? '').trim(),
    prenom: (clientData.nom.trim().split(' ')[0] ?? '').trim(),
    dateNaissance: '',
    nationalite: 'Française',
    fonctionPoste: 'Gérant',
    pourcentageCapital: '100',
  }]);

  const [ubos, setUbos] = useState<UBOEntry[]>([]);
  const [riskFactors, setRiskFactors] = useState<Partial<Record<RiskFactorId, boolean>>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const riskScore: RiskScore = (() => {
    const total = RISK_FACTORS.reduce(
      (sum, f) => sum + (riskFactors[f.id] ? f.weight : 0),
      0
    );
    if (total >= 5) return 'high';
    if (total >= 2) return 'medium';
    return 'low';
  })();

  const updateDirector = (idx: number, field: keyof Director, value: string) => {
    setDirectors(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  };

  const addDirector = () => {
    setDirectors(prev => [...prev, {
      nom: '', prenom: '', dateNaissance: '', nationalite: 'Française',
      fonctionPoste: 'Directeur', pourcentageCapital: '',
    }]);
  };

  const removeDirector = (idx: number) => {
    if (directors.length > 1) setDirectors(prev => prev.filter((_, i) => i !== idx));
  };

  const addUBO = () => {
    setUbos(prev => [...prev, { nom: '', prenom: '', pourcentage: '', dateNaissance: '' }]);
  };

  const updateUBO = (idx: number, field: keyof UBOEntry, value: string) => {
    setUbos(prev => prev.map((u, i) => i === idx ? { ...u, [field]: value } : u));
  };

  const removeUBO = (idx: number) => {
    setUbos(prev => prev.filter((_, i) => i !== idx));
  };

  const toggleRisk = (id: RiskFactorId) => {
    setRiskFactors(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    directors.forEach((d, i) => {
      if (!d.nom.trim()) e[`dir_nom_${i}`] = 'Nom requis';
      if (!d.prenom.trim()) e[`dir_prenom_${i}`] = 'Prénom requis';
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const scoreConfig = {
    low: { label: 'Risque faible', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: '🟢' },
    medium: { label: 'Risque modéré', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: '🟡' },
    high: { label: 'Risque élevé — Vigilance renforcée', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: '🔴' },
  }[riskScore];

  const fieldClass = (err?: string) =>
    `w-full px-3 py-2 border rounded-lg text-sm outline-none transition-all bg-white ${
      err ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-50'
    }`;

  return (
    <StepShell
      step={7}
      title="Collecte KYC / LCB-FT"
      subtitle="Identification des dirigeants, bénéficiaires effectifs (UBO) et scoring de risque LCB-FT conformément aux obligations de l'Ordre des Experts-Comptables."
      type="manuel"
      icon={<Shield className="w-5 h-5 text-white" />}
      onBack={goPrev}
      onNext={() => validate() && goNext()}
      nextLabel="Étape suivante →"
    >
      {/* Client identity recap */}
      <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl mb-5">
        <Building2 className="w-5 h-5 text-blue-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-gray-900">{clientData.raisonSociale || clientData.nom}</p>
          <p className="text-xs text-gray-500">SIREN : {clientData.siren} — {clientData.formeJuridique}</p>
        </div>
      </div>

      {/* Directors section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-800 flex items-center gap-2">
            <User className="w-4 h-4 text-blue-600" />
            Dirigeants & représentants légaux
          </h3>
          <button onClick={addDirector}
            className="text-xs text-blue-600 hover:text-blue-700 px-2 py-1 bg-blue-50 rounded-lg transition-all">
            + Ajouter
          </button>
        </div>

        {directors.map((dir, i) => (
          <div key={i} className="border border-gray-200 rounded-xl p-4 mb-3 bg-white">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-gray-600">Dirigeant #{i + 1}</p>
              {directors.length > 1 && (
                <button onClick={() => removeDirector(i)} className="text-xs text-red-500 hover:text-red-600">✕ Supprimer</button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Nom <span className="text-red-400">*</span></label>
                <input className={fieldClass(errors[`dir_nom_${i}`])} placeholder="Dupont" value={dir.nom}
                  onChange={e => updateDirector(i, 'nom', e.target.value)} />
                {errors[`dir_nom_${i}`] && <p className="text-xs text-red-500 mt-0.5">{errors[`dir_nom_${i}`]}</p>}
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Prénom <span className="text-red-400">*</span></label>
                <input className={fieldClass(errors[`dir_prenom_${i}`])} placeholder="Jean" value={dir.prenom}
                  onChange={e => updateDirector(i, 'prenom', e.target.value)} />
                {errors[`dir_prenom_${i}`] && <p className="text-xs text-red-500 mt-0.5">{errors[`dir_prenom_${i}`]}</p>}
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Date de naissance</label>
                <input type="date" className={fieldClass()} value={dir.dateNaissance}
                  onChange={e => updateDirector(i, 'dateNaissance', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Nationalité</label>
                <input className={fieldClass()} placeholder="Française" value={dir.nationalite}
                  onChange={e => updateDirector(i, 'nationalite', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Fonction / Poste</label>
                <input className={fieldClass()} placeholder="Gérant" value={dir.fonctionPoste}
                  onChange={e => updateDirector(i, 'fonctionPoste', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">% Capital détenu</label>
                <input type="number" min="0" max="100" className={fieldClass()} placeholder="100" value={dir.pourcentageCapital}
                  onChange={e => updateDirector(i, 'pourcentageCapital', e.target.value)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* UBO section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-800 flex items-center gap-2">
            <Shield className="w-4 h-4 text-violet-600" />
            Bénéficiaires Effectifs (UBO — seuil 25%)
          </h3>
          <button onClick={addUBO}
            className="text-xs text-violet-600 hover:text-violet-700 px-2 py-1 bg-violet-50 rounded-lg transition-all">
            + Ajouter
          </button>
        </div>

        {ubos.length === 0 ? (
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              Si aucun bénéficiaire effectif ne détient ≥ 25% du capital, les dirigeants sont considérés comme UBO de fait.
            </p>
          </div>
        ) : (
          ubos.map((ubo, i) => (
            <div key={i} className="border border-violet-100 rounded-xl p-3 mb-2 bg-violet-50/30">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-violet-700">UBO #{i + 1}</p>
                <button onClick={() => removeUBO(i)} className="text-xs text-red-500">✕</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input className={fieldClass()} placeholder="Nom" value={ubo.nom}
                  onChange={e => updateUBO(i, 'nom', e.target.value)} />
                <input className={fieldClass()} placeholder="Prénom" value={ubo.prenom}
                  onChange={e => updateUBO(i, 'prenom', e.target.value)} />
                <input type="number" min="25" max="100" className={fieldClass()} placeholder="% (≥ 25)"
                  value={ubo.pourcentage} onChange={e => updateUBO(i, 'pourcentage', e.target.value)} />
                <input type="date" className={fieldClass()} value={ubo.dateNaissance}
                  onChange={e => updateUBO(i, 'dateNaissance', e.target.value)} />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Risk scoring */}
      <div className="mb-5">
        <h3 className="text-sm font-medium text-gray-800 flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          Facteurs de risque LCB-FT
        </h3>
        <div className="space-y-2">
          {RISK_FACTORS.map(factor => (
            <button key={factor.id} onClick={() => toggleRisk(factor.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all text-sm ${
                riskFactors[factor.id] ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-gray-200 hover:border-gray-300 text-gray-700'
              }`}>
              <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${
                riskFactors[factor.id] ? 'bg-amber-500 border-amber-500' : 'border-gray-300'
              }`}>
                {riskFactors[factor.id] && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="flex-1">{factor.label}</span>
              <span className="text-xs text-gray-400">poids {factor.weight}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Risk score result */}
      <div className={`border rounded-xl p-4 flex items-center gap-3 ${scoreConfig.bg}`}>
        <span className="text-xl">{scoreConfig.icon}</span>
        <div className="flex-1">
          <p className={`text-sm font-medium ${scoreConfig.color}`}>{scoreConfig.label}</p>
          {riskScore === 'high' && (
            <p className="text-xs text-red-600 mt-0.5">
              Vigilance renforcée requise — Documentation complémentaire obligatoire (art. R. 561-21 CMF).
            </p>
          )}
          {riskScore === 'medium' && (
            <p className="text-xs text-amber-600 mt-0.5">
              Surveillance standard — Revue annuelle recommandée.
            </p>
          )}
          {riskScore === 'low' && (
            <p className="text-xs text-emerald-600 mt-0.5">
              Diligences standard appliquées conformément au Code Monétaire et Financier.
            </p>
          )}
        </div>
        <CheckCircle2 className={`w-5 h-5 flex-shrink-0 ${scoreConfig.color}`} />
      </div>
    </StepShell>
  );
}
