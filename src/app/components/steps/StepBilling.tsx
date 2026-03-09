import { useState } from 'react';
import { CreditCard, Building2, CheckCircle2, Info, Calendar, Euro } from 'lucide-react';
import { useOnboarding } from '../../context/OnboardingContext';
import { StepShell } from '../StepShell';

type BillingCycle = 'monthly' | 'quarterly' | 'annual';
type PaymentMethod = 'sepa' | 'virement' | 'cheque';

interface SEPAMandate {
  iban: string;
  bic: string;
  titulaire: string;
  banque: string;
  rum: string;
}

const BILLING_CYCLES: { value: BillingCycle; label: string; desc: string }[] = [
  { value: 'monthly', label: 'Mensuel', desc: 'Prélèvement automatique chaque 1er du mois' },
  { value: 'quarterly', label: 'Trimestriel', desc: 'Facturation regroupée par trimestre' },
  { value: 'annual', label: 'Annuel', desc: 'Facturation en début d\'exercice — remise possible' },
];

function generateRUM(): string {
  return `FR${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export function StepBilling() {
  const { goNext, goPrev, clientData } = useOnboarding();

  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('sepa');
  const [mandate, setMandate] = useState<SEPAMandate>({
    iban: '',
    bic: '',
    titulaire: clientData.raisonSociale || clientData.nom,
    banque: '',
    rum: generateRUM(),
  });
  const [mandateGenerated, setMandateGenerated] = useState(false);
  const [mandateSigned, setMandateSigned] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const prixAnnuel = parseFloat(clientData.prixAnnuel || '0') || 0;
  // Round to 2 decimal places to avoid floating-point drift on invoices
  const prixCycle = {
    monthly: Math.round((prixAnnuel / 12) * 100) / 100,
    quarterly: Math.round((prixAnnuel / 4) * 100) / 100,
    annual: prixAnnuel,
  }[billingCycle];

  const validateIBAN = (iban: string) => {
    const clean = iban.replace(/\s/g, '').toUpperCase();
    return /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(clean);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (paymentMethod === 'sepa') {
      if (!mandate.iban.trim()) e.iban = 'IBAN requis';
      else if (!validateIBAN(mandate.iban)) e.iban = 'IBAN invalide';
      if (!mandate.bic.trim()) e.bic = 'BIC requis';
      if (!mandate.titulaire.trim()) e.titulaire = 'Titulaire requis';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleGenerateMandate = () => {
    if (!validate()) return;
    setMandateGenerated(true);
  };

  const handleSignMandate = async () => {
    await new Promise(r => setTimeout(r, 800));
    setMandateSigned(true);
  };

  const fieldClass = (err?: string) =>
    `w-full px-3 py-2.5 border rounded-lg text-sm outline-none transition-all bg-white ${
      err ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-50'
    }`;

  return (
    <StepShell
      step={9}
      title="Facturation & Mandat SEPA"
      subtitle="Définissez le cycle de facturation et générez le mandat SEPA pour prélèvement automatique des honoraires."
      type="automatisé"
      icon={<CreditCard className="w-5 h-5 text-white" />}
      onBack={goPrev}
      onNext={goNext}
      nextLabel="Étape suivante →"
    >
      {/* Billing summary */}
      <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl mb-5">
        <Euro className="w-5 h-5 text-blue-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-blue-900">{clientData.raisonSociale || clientData.nom}</p>
          {prixAnnuel > 0 ? (
            <p className="text-xs text-blue-700">Honoraires : {prixAnnuel.toLocaleString('fr-FR')} € HT/an</p>
          ) : (
            <p className="text-xs text-blue-500">Honoraires non définis — configurez à l'étape 6</p>
          )}
        </div>
      </div>

      {/* Billing cycle */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-800 mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-600" />
          Cycle de facturation
        </label>
        <div className="space-y-2">
          {BILLING_CYCLES.map(cycle => (
            <button key={cycle.value} onClick={() => setBillingCycle(cycle.value)}
              className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                billingCycle === cycle.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                billingCycle === cycle.value ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
              }`}>
                {billingCycle === cycle.value && (
                  <div className="w-full h-full rounded-full bg-white scale-50" />
                )}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-medium ${billingCycle === cycle.value ? 'text-blue-700' : 'text-gray-800'}`}>
                  {cycle.label}
                  {prixAnnuel > 0 && (
                    <span className="ml-2 text-xs font-normal">
                      ({prixCycle.toLocaleString('fr-FR')} € HT/{cycle.value === 'monthly' ? 'mois' : cycle.value === 'quarterly' ? 'trim.' : 'an'})
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500">{cycle.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Payment method */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-800 mb-3">Mode de règlement</label>
        <div className="flex gap-2 flex-wrap">
          {[
            { value: 'sepa' as const, label: '🏦 Prélèvement SEPA', recommended: true },
            { value: 'virement' as const, label: '↗️ Virement', recommended: false },
            { value: 'cheque' as const, label: '📄 Chèque', recommended: false },
          ].map(pm => (
            <button key={pm.value} onClick={() => setPaymentMethod(pm.value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm transition-all ${
                paymentMethod === pm.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300 text-gray-700'
              }`}
            >
              {pm.label}
              {pm.recommended && <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">Recommandé</span>}
            </button>
          ))}
        </div>
      </div>

      {/* SEPA form */}
      {paymentMethod === 'sepa' && !mandateGenerated && (
        <div className="mb-5">
          <h3 className="text-sm font-medium text-gray-800 mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600" />
            Informations bancaires — Mandat SEPA
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">IBAN <span className="text-red-400">*</span></label>
              <input className={fieldClass(errors.iban)} placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX"
                value={mandate.iban}
                onChange={e => { setMandate(prev => ({ ...prev, iban: e.target.value })); setErrors(prev => { const n = { ...prev }; delete n.iban; return n; }); }} />
              {errors.iban && <p className="text-xs text-red-500 mt-0.5">{errors.iban}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">BIC / SWIFT <span className="text-red-400">*</span></label>
                <input className={fieldClass(errors.bic)} placeholder="BNPAFRPPXXX"
                  value={mandate.bic}
                  onChange={e => { setMandate(prev => ({ ...prev, bic: e.target.value })); setErrors(prev => { const n = { ...prev }; delete n.bic; return n; }); }} />
                {errors.bic && <p className="text-xs text-red-500 mt-0.5">{errors.bic}</p>}
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Banque</label>
                <input className={fieldClass()} placeholder="BNP Paribas"
                  value={mandate.banque}
                  onChange={e => setMandate(prev => ({ ...prev, banque: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Titulaire du compte <span className="text-red-400">*</span></label>
              <input className={fieldClass(errors.titulaire)} placeholder="SOCIÉTÉ DUPONT"
                value={mandate.titulaire}
                onChange={e => { setMandate(prev => ({ ...prev, titulaire: e.target.value })); setErrors(prev => { const n = { ...prev }; delete n.titulaire; return n; }); }} />
              {errors.titulaire && <p className="text-xs text-red-500 mt-0.5">{errors.titulaire}</p>}
            </div>
          </div>

          <button onClick={handleGenerateMandate}
            className="mt-4 w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-medium transition-all shadow-sm">
            <CreditCard className="w-4 h-4" />
            Générer le mandat SEPA
          </button>
        </div>
      )}

      {/* Generated mandate */}
      {paymentMethod === 'sepa' && mandateGenerated && (
        <div className={`border rounded-xl p-4 ${mandateSigned ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className={`w-4 h-4 ${mandateSigned ? 'text-emerald-600' : 'text-amber-600'}`} />
            <p className={`text-sm font-medium ${mandateSigned ? 'text-emerald-800' : 'text-amber-800'}`}>
              {mandateSigned ? 'Mandat SEPA signé ✓' : 'Mandat SEPA généré — En attente de signature'}
            </p>
          </div>
          <div className="space-y-1 text-xs text-gray-600 mb-3">
            <p><span className="font-medium">RUM :</span> {mandate.rum}</p>
            <p><span className="font-medium">IBAN :</span> {mandate.iban.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim()}</p>
            <p><span className="font-medium">Titulaire :</span> {mandate.titulaire}</p>
            <p><span className="font-medium">Cycle :</span> {BILLING_CYCLES.find(c => c.value === billingCycle)?.label}</p>
          </div>
          {!mandateSigned && (
            <button onClick={handleSignMandate}
              className="text-xs bg-amber-600 text-white hover:bg-amber-700 px-4 py-2 rounded-lg transition-all">
              ✍️ Signer le mandat SEPA (simulation)
            </button>
          )}
        </div>
      )}

      {paymentMethod !== 'sepa' && (
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl">
          <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">
            Le mode {paymentMethod === 'virement' ? 'virement' : 'chèque'} a été sélectionné. Les informations de paiement seront communiquées dans la lettre de mission.
          </p>
        </div>
      )}

      {/* Confirmation */}
      {(mandateSigned || paymentMethod !== 'sepa') && (
        <div className="mt-4 flex items-center gap-2 text-emerald-700 text-sm">
          <CheckCircle2 className="w-4 h-4" />
          Configuration de facturation complète — Vous pouvez passer à l'étape suivante.
        </div>
      )}
    </StepShell>
  );
}
