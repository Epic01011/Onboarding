/**
 * ProspectKYCForm.tsx
 *
 * Formulaire multi-étapes CRM pour la collecte KYC d'un prospect.
 * Étape 1 — SIREN (validation regex 9 chiffres + algorithme de Luhn)
 * Étape 2 — Inducteurs de complexité
 * Étape 3 — Résultat ClientKYC
 */

import { useState } from 'react';
import {
  Building2, CheckCircle2, XCircle, Loader2, RotateCcw,
  Globe, Package, Users, Landmark, FileText, AlertTriangle,
  ArrowRight, ArrowLeft, ShieldCheck, Euro, CalendarClock,
} from 'lucide-react';
import { apiClient } from '../../app/utils/apiClient';
import type { ClientKYC } from '../../app/types/dashboard';
import { validateSIREN } from '../../app/utils/validators';

// ─── Types internes ───────────────────────────────────────────────────────────

type Step = 'siren' | 'complexity' | 'result';

interface OnboardingFormPayload {
  siren: string;
  monthly_invoice_volume: number;
  has_international_ops: boolean;
  has_physical_stock: boolean;
  has_employees: boolean;
  has_foreign_accounts: boolean;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

/** 9 chiffres + 2 espaces de mise en forme = 11 caractères au maximum */
const MAX_SIREN_INPUT_LENGTH = 11;

/** Seuil de volume mensuel de factures déclenchant un facteur de risque */
const INVOICE_VOLUME_RISK_THRESHOLD = 500;

// ─── Types internes ───────────────────────────────────────────────────────────

interface ComplexityInputs {
  monthly_invoice_volume: number;
  has_international_ops: boolean;
  has_physical_stock: boolean;
  has_employees: boolean;
  has_foreign_accounts: boolean;
}

const DEFAULT_COMPLEXITY: ComplexityInputs = {
  monthly_invoice_volume: 0,
  has_international_ops: false,
  has_physical_stock: false,
  has_employees: false,
  has_foreign_accounts: false,
};

// ─── Sous-composant : badge de risque ─────────────────────────────────────────

function RiskBadge({ risk }: { risk: ClientKYC['riskScore'] }) {
  const cfg = {
    low:    { label: 'Risque faible',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    medium: { label: 'Risque modéré',   cls: 'bg-amber-50   text-amber-700   border-amber-200'   },
    high:   { label: 'Risque élevé',    cls: 'bg-red-50     text-red-700     border-red-200'      },
  }[risk];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${cfg.cls}`}>
      <ShieldCheck className="w-3.5 h-3.5" />
      {cfg.label}
    </span>
  );
}

// ─── Sous-composant : champ info KYC ─────────────────────────────────────────

function KYCField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-lg px-3.5 py-2.5">
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className={`text-sm text-gray-800 font-medium truncate ${mono ? 'font-mono' : ''}`}>
        {value || '—'}
      </p>
    </div>
  );
}

// ─── Sous-composant : toggle booléen ─────────────────────────────────────────

function BoolToggle({
  icon: Icon, label, desc, checked, onChange,
}: {
  icon: React.ElementType;
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all w-full ${
        checked ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-white'
      }`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${checked ? 'bg-blue-100' : 'bg-gray-100'}`}>
        <Icon className={`w-4 h-4 ${checked ? 'text-blue-600' : 'text-gray-400'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${checked ? 'text-blue-700' : 'text-gray-800'}`}>{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
      </div>
      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
        checked ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
      }`}>
        {checked && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
    </button>
  );
}

// ─── Indicateur d'étapes ──────────────────────────────────────────────────────

const STEPS: { id: Step; label: string }[] = [
  { id: 'siren',      label: 'SIREN' },
  { id: 'complexity', label: 'Complexité' },
  { id: 'result',     label: 'Résultat KYC' },
];

function StepIndicator({ current }: { current: Step }) {
  const idx = STEPS.findIndex(s => s.id === current);
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((s, i) => (
        <div key={s.id} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
              i < idx  ? 'bg-blue-500 text-white' :
              i === idx ? 'bg-blue-600 text-white ring-4 ring-blue-100' :
              'bg-gray-100 text-gray-400'
            }`}>
              {i < idx ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <span className={`text-xs hidden sm:block ${i === idx ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-0.5 mx-1 mb-5 ${i < idx ? 'bg-blue-400' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function ProspectKYCForm() {
  const [clientKYC, setClientKYC] = useState<ClientKYC | null>(null);
  const [isLoadingKYC, setLoadingKYC] = useState(false);
  const [kycError, setKYCError] = useState<string | null>(null);

  // ── État local du formulaire ──────────────────────────────────────────────
  const [step, setStep] = useState<Step>('siren');
  const [siren, setSiren] = useState('');
  const [sirenError, setSirenError] = useState('');
  const [complexity, setComplexity] = useState<ComplexityInputs>(DEFAULT_COMPLEXITY);
  const [volumeInput, setVolumeInput] = useState('');
  /** Valeur estimée du contrat (€) */
  const [estimatedValue, setEstimatedValue] = useState('');
  /** Date de la prochaine action commerciale */
  const [nextActionDate, setNextActionDate] = useState('');

  // ─── Étape 1 : validation SIREN ──────────────────────────────────────────

  const cleanSiren = siren.replace(/\s/g, '');
  const sirenFormatOk = /^\d{9}$/.test(cleanSiren);
  const sirenLuhnOk = sirenFormatOk && validateSIREN(cleanSiren);

  const handleSirenChange = (val: string) => {
    const filtered = val.replace(/[^\d\s]/g, '').slice(0, 11);
    setSiren(filtered);
    setSirenError('');
  };

  const handleValidateSiren = () => {
    if (!sirenFormatOk) {
      setSirenError('Le SIREN doit contenir exactement 9 chiffres');
      return;
    }
    if (!sirenLuhnOk) {
      setSirenError('SIREN invalide (vérification de Luhn échouée)');
      return;
    }
    setSirenError('');
    setStep('complexity');
  };

  // ─── Étape 2 : complexité ─────────────────────────────────────────────────

  const handleComplexityChange = <K extends keyof ComplexityInputs>(key: K, value: ComplexityInputs[K]) => {
    setComplexity(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    const payload: OnboardingFormPayload = {
      siren: cleanSiren,
      monthly_invoice_volume: Number(volumeInput) || complexity.monthly_invoice_volume,
      has_international_ops: complexity.has_international_ops,
      has_physical_stock: complexity.has_physical_stock,
      has_employees: complexity.has_employees,
      has_foreign_accounts: complexity.has_foreign_accounts,
    };

    setLoadingKYC(true);
    setKYCError(null);

    try {
      const result = await apiClient.post<ClientKYC>('/kyc/submit', payload);
      setClientKYC(result);
      setStep('result');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      setKYCError(msg);
    } finally {
      setLoadingKYC(false);
    }
  };

  // ─── Reset ────────────────────────────────────────────────────────────────

  const handleReset = () => {
    setSiren('');
    setSirenError('');
    setVolumeInput('');
    setComplexity(DEFAULT_COMPLEXITY);
    setClientKYC(null);
    setKYCError(null);
    setEstimatedValue('');
    setNextActionDate('');
    setStep('siren');
  };

  // ─── Rendu ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-base">Nouveau Prospect — KYC</h2>
              <p className="text-slate-400 text-xs mt-0.5">Collecte et analyse de conformité</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          <StepIndicator current={step} />

          {/* ── Étape 1 : SIREN ─────────────────────────────────────────── */}
          {step === 'siren' && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Numéro SIREN <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="732 829 320"
                    value={siren}
                    onChange={e => handleSirenChange(e.target.value)}
                    maxLength={MAX_SIREN_INPUT_LENGTH}
                    className={`w-full px-3.5 py-2.5 border rounded-lg text-sm outline-none transition-all bg-white pr-10 ${
                      sirenError
                        ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100'
                        : sirenLuhnOk
                        ? 'border-emerald-400 ring-2 ring-emerald-50'
                        : sirenFormatOk && !sirenLuhnOk
                        ? 'border-red-300 ring-2 ring-red-50'
                        : 'border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-50'
                    }`}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    {sirenLuhnOk && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                    {sirenFormatOk && !sirenLuhnOk && <XCircle className="w-4 h-4 text-red-400" />}
                  </div>
                </div>
                {sirenError && (
                  <p className="text-xs text-red-500 mt-1">{sirenError}</p>
                )}
                {!sirenError && (
                  <p className="text-xs text-gray-400 mt-1">
                    {sirenLuhnOk
                      ? <span className="text-emerald-600">✓ Format SIREN valide (algorithme de Luhn)</span>
                      : sirenFormatOk && !sirenLuhnOk
                      ? <span className="text-red-500">SIREN invalide (algorithme de Luhn)</span>
                      : '9 chiffres — Algorithme de Luhn appliqué automatiquement'}
                  </p>
                )}
              </div>

              <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3">
                <Building2 className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">
                  Le SIREN est validé localement via <strong>l'algorithme de Luhn</strong>.
                  Les données légales sont enrichies à l'étape suivante via le webhook n8n.
                </p>
              </div>

              <button
                type="button"
                onClick={handleValidateSiren}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm"
              >
                Valider SIREN
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ── Étape 2 : Inducteurs de complexité ──────────────────────── */}
          {step === 'complexity' && (
            <div className="space-y-5">
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">SIREN validé</p>
                  <p className="text-sm font-mono tracking-widest text-slate-800">
                    {cleanSiren.length === 9
                      ? cleanSiren.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')
                      : cleanSiren}
                  </p>
                </div>
              </div>

              {/* Volume mensuel de factures */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Volume mensuel de factures
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    placeholder="Ex : 150"
                    value={volumeInput}
                    onChange={e => {
                      setVolumeInput(e.target.value);
                      handleComplexityChange('monthly_invoice_volume', Number(e.target.value) || 0);
                    }}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all bg-white pr-24"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                    factures / mois
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Impact sur le scoring de risque (seuil : {INVOICE_VOLUME_RISK_THRESHOLD})
                </p>
              </div>

              {/* Toggles booléens */}
              <div className="space-y-2.5">
                <p className="text-sm font-medium text-gray-700">Facteurs de complexité</p>
                <BoolToggle
                  icon={Globe}
                  label="Opérations internationales"
                  desc="Transactions hors UE, TVA intracommunautaire, devises étrangères"
                  checked={complexity.has_international_ops}
                  onChange={v => handleComplexityChange('has_international_ops', v)}
                />
                <BoolToggle
                  icon={Package}
                  label="Stock physique"
                  desc="Gestion de stocks matériels, inventaires, valorisation"
                  checked={complexity.has_physical_stock}
                  onChange={v => handleComplexityChange('has_physical_stock', v)}
                />
                <BoolToggle
                  icon={Users}
                  label="Salariés"
                  desc="Paie, charges sociales, déclarations URSSAF / DSN"
                  checked={complexity.has_employees}
                  onChange={v => handleComplexityChange('has_employees', v)}
                />
                <BoolToggle
                  icon={Landmark}
                  label="Comptes bancaires étrangers"
                  desc="Comptes hors France — obligation déclarative CERFA 3916"
                  checked={complexity.has_foreign_accounts}
                  onChange={v => handleComplexityChange('has_foreign_accounts', v)}
                />
              </div>

              {kycError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">{kycError}</p>
                </div>
              )}

              {/* ── Champs CRM optionnels ─────────────────────────────── */}
              <div className="space-y-3 pt-1">
                <p className="text-sm font-medium text-gray-700">Données CRM (optionnel)</p>

                {/* Valeur estimée */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Valeur estimée du contrat
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      step={100}
                      placeholder="Ex : 5000"
                      value={estimatedValue}
                      onChange={e => setEstimatedValue(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all bg-white pr-10"
                    />
                    <Euro className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                {/* Date de prochaine action */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Date de prochaine action
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={nextActionDate}
                      onChange={e => setNextActionDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all bg-white pr-10"
                    />
                    <CalendarClock className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('siren')}
                  className="flex items-center gap-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 px-4 py-2.5 rounded-lg transition-all"
                >
                  <ArrowLeft className="w-4 h-4" /> Retour
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isLoadingKYC}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm"
                >
                  {isLoadingKYC ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyse en cours…
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      Analyser le dossier KYC
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── Étape 3 : Résultat ClientKYC ────────────────────────────── */}
          {step === 'result' && clientKYC && (
            <div className="space-y-5">
              {/* En-tête résultat */}
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Prospect identifié</p>
                  <h3 className="text-lg font-semibold text-gray-900">{clientKYC.name}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{clientKYC.complexityLabel}</p>
                </div>
                <RiskBadge risk={clientKYC.riskScore} />
              </div>

              {/* Grille de données légales */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <KYCField label="SIREN" value={clientKYC.company_number} mono />
                <KYCField label="SIRET (siège)" value={clientKYC.siret != null && /^\d{14}$/.test(clientKYC.siret) ? clientKYC.siret.replace(/(\d{9})(\d{5})/, '$1 $2') : (clientKYC.siret ?? '—')} mono />
                <KYCField label="Forme juridique" value={clientKYC.legal_form_label ?? '—'} />
                <KYCField label="Capital social" value={clientKYC.share_capital != null ? `${clientKYC.share_capital.toLocaleString('fr-FR')} €` : '—'} />
                <KYCField label="Code NAF / APE" value={`${clientKYC.naf_code ?? '—'} — ${clientKYC.naf_label ?? '—'}`} />
                <KYCField label="Effectif" value={clientKYC.workforce_range ?? '—'} />
                <KYCField label="Adresse" value={[clientKYC.address, clientKYC.postal_code, clientKYC.city].filter(Boolean).join(', ') || '—'} />
                <KYCField label="Date de création" value={clientKYC.creation_date ?? 'Non communiqué'} />
              </div>

              {/* Score risque */}
              <div className={`rounded-xl p-4 border ${
                clientKYC.riskScore === 'high'   ? 'bg-red-50 border-red-200' :
                clientKYC.riskScore === 'medium'  ? 'bg-amber-50 border-amber-200' :
                'bg-emerald-50 border-emerald-200'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className={`w-4 h-4 ${
                    clientKYC.riskScore === 'high'  ? 'text-red-500' :
                    clientKYC.riskScore === 'medium' ? 'text-amber-500' :
                    'text-emerald-500'
                  }`} />
                  <p className={`text-sm font-medium ${
                    clientKYC.riskScore === 'high'  ? 'text-red-800' :
                    clientKYC.riskScore === 'medium' ? 'text-amber-800' :
                    'text-emerald-800'
                  }`}>
                    {clientKYC.complexityLabel}
                  </p>
                </div>
                <p className={`text-xs ${
                  clientKYC.riskScore === 'high'  ? 'text-red-600' :
                  clientKYC.riskScore === 'medium' ? 'text-amber-600' :
                  'text-emerald-600'
                }`}>
                  {clientKYC.riskScore === 'high'
                    ? 'Diligences renforcées requises — validez manuellement chaque document.'
                    : clientKYC.riskScore === 'medium'
                    ? 'Vérification standard avec points de contrôle additionnels.'
                    : 'Procédure KYC standard applicable.'}
                </p>
              </div>

              <p className="text-xs text-gray-400 text-right">
                Soumis le {new Date(clientKYC.submittedAt).toLocaleString('fr-FR')}
              </p>

              {/* Récap CRM */}
              {(estimatedValue || nextActionDate) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {estimatedValue && (
                    <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-lg px-3.5 py-2.5">
                      <Euro className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-emerald-600">Valeur estimée</p>
                        <p className="text-sm font-semibold text-emerald-800">
                          {Number(estimatedValue).toLocaleString('fr-FR')} €
                        </p>
                      </div>
                    </div>
                  )}
                  {nextActionDate && (
                    <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-200 rounded-lg px-3.5 py-2.5">
                      <CalendarClock className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-blue-600">Prochaine action</p>
                        <p className="text-sm font-semibold text-blue-800">
                          {new Date(nextActionDate).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={handleReset}
                className="w-full flex items-center justify-center gap-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 px-4 py-2.5 rounded-lg transition-all"
              >
                <RotateCcw className="w-4 h-4" /> Nouveau prospect
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
