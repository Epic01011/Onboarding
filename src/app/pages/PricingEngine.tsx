import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  Calculator, ArrowLeft, Building2, BookOpen, Users, Settings2,
  CheckCircle2, Loader2, FileText, Euro, ChevronRight, Info,
  Tag, Mail, Download, Printer, X, Trash2, RefreshCw, Scale, Eye, Search,
  Receipt, Briefcase, Smartphone, UserCircle,
} from 'lucide-react';
import { usePricingStore } from '../store/usePricingStore';
import type {
  LegalForm, TaxRegime, RevenueRange, InvoiceRange, Digitalization, SavedQuote, TvaFrequency,
  CompanyProfile,
} from '../store/usePricingStore';
import {
  calculateQuote,
  SETUP_FEES,
  BULLETIN_RATE,
  DSN_MONTHLY_FEE,
  SOCIAL_SETUP_MONO,
  SOCIAL_SETUP_MULTI,
  BILAN_COMPRIS_MONTHLY,
  ATTERRISSAGE_MONTHLY,
  SITUATIONS_TRIM_MONTHLY,
  SITUATIONS_MENS_MONTHLY,
  OPTION_PRICES,
  SOCIAL_EVENT_TARIFF,
  JURIDIQUE_ACTE_TARIFF,
  getSecretariatJuridiqueAnnuel,
  getRevisionBaseHours,
  getRevisionCABonus,
  TAUX_HORAIRE_TENUE,
  TAUX_HORAIRE_REVISION,
} from '../utils/pricingLogic';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '../components/ui/accordion';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/ui/alert-dialog';
import { toast } from 'sonner';
import { sendEmail } from '../services/emailService';
import { getCabinetInfo, getEmailConfig, type CabinetInfo } from '../utils/servicesStorage';
import { supabase } from '../utils/supabaseClient';
import { saveProspectAndQuote, saveProposalToProspect, updateQuoteStatus, deleteQuote, convertProspectToClient } from '../utils/supabaseSync';
import { fetchBySIREN, searchCompaniesByName } from '../services/sirenApi';
import type { CompanySuggestion, SirenData } from '../services/sirenApi';

// ─── Static option lists ──────────────────────────────────────────────────────

const LEGAL_FORMS: { value: LegalForm; label: string }[] = [
  { value: 'SARL',         label: 'SARL' },
  { value: 'SAS',          label: 'SAS' },
  { value: 'SASU',         label: 'SASU' },
  { value: 'EURL',         label: 'EURL' },
  { value: 'SNC',          label: 'SNC' },
  { value: 'SCI',          label: 'SCI' },
  { value: 'EI',           label: 'Entreprise Individuelle (EI)' },
  { value: 'LMNP_REEL',    label: 'LMNP (Réel Simplifié)' },
  { value: 'LMNP_MICROBIC',label: 'LMNP (Micro-BIC)' },
  { value: 'ASSO',         label: 'Association' },
];

const REVENUE_RANGES: { value: RevenueRange; label: string }[] = [
  { value: '<100k',     label: '< 100 000 €' },
  { value: '100k-250k', label: '100 000 — 250 000 €' },
  { value: '250k-500k', label: '250 000 — 500 000 €' },
  { value: '500k-1M',   label: '500 000 € — 1 M€' },
  { value: '1M-3M',     label: '1 M€ — 3 M€' },
  { value: '3M-5M',     label: '3 M€ — 5 M€' },
  { value: '5M-10M',    label: '5 M€ — 10 M€' },
  { value: '>10M',      label: '> 10 M€' },
];

const INVOICE_RANGES: { value: InvoiceRange; label: string }[] = [
  { value: '<10',       label: 'Moins de 10 / mois' },
  { value: '10-20',     label: '10 — 20 / mois' },
  { value: '20-40',     label: '20 — 40 / mois' },
  { value: '40-80',     label: '40 — 80 / mois' },
  { value: '80-200',    label: '80 — 200 / mois' },
  { value: '200-500',   label: '200 — 500 / mois' },
  { value: '500-1000',  label: '500 — 1 000 / mois' },
  { value: '1000-1500', label: '1 000 — 1 500 / mois' },
  { value: '>1500',     label: 'Plus de 1 500 / mois' },
];

const EMPLOYEE_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 30, 50, 75, 100];

// ─── Derived client name ──────────────────────────────────────────────────────

/** Computes the display name: "Prénom Nom" from contact fields, or raisonSociale as fallback. */
function getEffectiveClientName(p: CompanyProfile): string {
  const contact = [p.prenomContact, p.nomContact].filter(Boolean).join(' ');
  return contact || p.raisonSociale;
}

// ─── Reusable field wrapper ───────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
      {children}
    </label>
  );
}

// ─── Option checkbox row ──────────────────────────────────────────────────────

function OptionRow({
  checked,
  onChange,
  label,
  description,
  price,
  priceUnit = '/ mois',
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
  price: number;
  priceUnit?: string;
}) {
  return (
    <label
      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${
        checked ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-400 flex-shrink-0"
        />
        <div className="min-w-0">
          <p className={`text-sm font-medium ${checked ? 'text-blue-800' : 'text-gray-800'}`}>{label}</p>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
      </div>
      <span className={`text-sm font-semibold flex-shrink-0 ${checked ? 'text-blue-700' : 'text-gray-600'}`}>
        +{price} € <span className="text-xs font-normal">{priceUnit}</span>
      </span>
    </label>
  );
}

// ─── Section card wrapper ─────────────────────────────────────────────────────

function SectionCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 flex-shrink-0">
          {icon}
        </div>
        <div>
          <h2 className="font-semibold text-gray-900 text-sm">{title}</h2>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
      </div>
      <div className="px-6 py-5 space-y-4">{children}</div>
    </div>
  );
}

// ─── Section 1 — Company Profile ─────────────────────────────────────────────

function StepCompanyProfile() {
  const { companyProfile, setCompanyProfile, accounting, setAccounting } = usePricingStore();
  const [sirenLoading, setSirenLoading] = useState(false);
  const [nameSuggestions, setNameSuggestions] = useState<CompanySuggestion[]>([]);
  const [nameSearchLoading, setNameSearchLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const nameSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** True while the pointer is pressed down on a suggestion — prevents onBlur from closing the dropdown before the click fires. */
  const suggestionMouseDownRef = useRef(false);

  // Cleanup debounce timer on unmount to prevent state updates on unmounted component
  useEffect(() => () => {
    if (nameSearchTimerRef.current) clearTimeout(nameSearchTimerRef.current);
  }, []);

  /** Default legal form when the SIREN API returns an unrecognised forme juridique */
  const DEFAULT_LEGAL_FORM: LegalForm = 'SARL';

  /** Map a formeJuridique string from the SIREN API to a LegalForm key if possible */
  const mapFormeJuridique = (forme: string): LegalForm | null => {
    if (!forme) return null;
    const normalized = forme.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    if (normalized.includes('5720') || normalized.includes('actions simplifiee a associe unique') || normalized.match(/\bsasu\b/)) return 'SASU';
    if (normalized.includes('5710') || normalized.includes('5599') || normalized.includes('actions simplifiee') || normalized.match(/\bsas\b/)) return 'SAS';
    if (normalized.includes('5498') || normalized.includes('unipersonnelle a responsabilite limitee') || normalized.match(/\beurl\b/)) return 'EURL';
    if (normalized.includes('5499') || normalized.includes('responsabilite limitee') || normalized.match(/\bsarl\b/)) return 'SARL';
    if (normalized.includes('6540') || normalized.includes('6599') || normalized.includes('civile immobiliere') || normalized.match(/\bsci\b/)) return 'SCI';
    if (normalized.includes('nom collectif') || normalized.match(/\bsnc\b/)) return 'SNC';
    if (normalized.includes('1000') || normalized.includes('individuel') || normalized.includes('artisan') || normalized.includes('commercant') || normalized.match(/\bei\b/)) return 'EI';
    if (normalized.includes('9220') || normalized.includes('association') || normalized.match(/\basso\b/)) return 'ASSO';

    return null;
  };

  /** Apply all fields from a successful SIREN API response */
  const applyApiResult = (data: SirenData) => {
    setCompanyProfile('raisonSociale', data.nomComplet);
    setCompanyProfile('adresse', data.adresse || '');
    setCompanyProfile('codePostal', data.codePostal);
    setCompanyProfile('ville', data.ville);
    const mappedForm = mapFormeJuridique(data.formeJuridique);
    setCompanyProfile('legalForm', mappedForm || DEFAULT_LEGAL_FORM);
    // Always overwrite activity — use whichever NAF fields are available
    const activityLabel = [data.codeNAF, data.libelleNAF].filter(Boolean).join(' - ');
    setCompanyProfile('activity', activityLabel);
    // Always overwrite contact from dirigeant (even when re-selecting a different company)
    setCompanyProfile('nomContact', data.nomDirigeant ?? '');
    setCompanyProfile('prenomContact', data.prenomDirigeant ?? '');
  };

  const handleSirenSearch = async () => {
    const siren = companyProfile.siren.replace(/[\s\-.]/g, '');
    if (!/^\d{9}$/.test(siren)) {
      toast.error('Le numéro SIREN doit comporter exactement 9 chiffres.');
      return;
    }
    setSirenLoading(true);
    try {
      const result = await fetchBySIREN(siren);
      if (result.success) {
        applyApiResult(result.data);
        toast.success(`Entreprise trouvée : ${result.data.nomComplet} ✓`);
      } else {
        toast.error(result.error);
      }
    } finally {
      setSirenLoading(false);
    }
  };

  const handleRaisonSocialeChange = (value: string) => {
    setCompanyProfile('raisonSociale', value);
    if (nameSearchTimerRef.current) clearTimeout(nameSearchTimerRef.current);
    if (value.length >= 3) {
      nameSearchTimerRef.current = setTimeout(async () => {
        setNameSearchLoading(true);
        try {
          const results = await searchCompaniesByName(value);
          setNameSuggestions(results);
          setShowSuggestions(results.length > 0);
        } finally {
          setNameSearchLoading(false);
        }
      }, 400);
    } else {
      setNameSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionSelect = async (suggestion: CompanySuggestion) => {
    setShowSuggestions(false);
    setNameSuggestions([]);
    // Immediately reflect all available suggestion fields — including secteur d'activité
    setCompanyProfile('raisonSociale', suggestion.nomComplet);
    setCompanyProfile('siren', suggestion.siren);
    const immediateActivity = [suggestion.codeNAF, suggestion.libelleNAF].filter(Boolean).join(' - ');
    if (immediateActivity) setCompanyProfile('activity', immediateActivity);
    const immediateLegalForm = mapFormeJuridique(suggestion.formeJuridique);
    setCompanyProfile('legalForm', immediateLegalForm || DEFAULT_LEGAL_FORM);
    // Full SIREN lookup to get dirigeants, forme juridique précise, and refreshed NAF
    setSirenLoading(true);
    try {
      const result = await fetchBySIREN(suggestion.siren);
      if (result.success) {
        applyApiResult(result.data);
        toast.success(`Entreprise trouvée : ${result.data.nomComplet} ✓`);
      } else {
        // SIREN fetch failed — complete fill from suggestion data, clear stale contacts
        setCompanyProfile('adresse', suggestion.adresse);
        setCompanyProfile('codePostal', suggestion.codePostal);
        setCompanyProfile('ville', suggestion.ville);
        setCompanyProfile('nomContact', '');
        setCompanyProfile('prenomContact', '');
      }
    } finally {
      setSirenLoading(false);
    }
  };

  return (
    <SectionCard
      icon={<Building2 className="w-4 h-4" />}
      title="Profil de l'entreprise"
      subtitle="Identification et caractéristiques juridiques"
    >
      {/* SIREN + search */}
      <div>
        <FieldLabel>Numéro SIREN</FieldLabel>
        <div className="flex gap-2">
          <input
            type="text"
            value={companyProfile.siren}
            onChange={e => setCompanyProfile('siren', e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSirenSearch(); }}
            placeholder="Ex : 123456789"
            maxLength={11}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            type="button"
            onClick={handleSirenSearch}
            disabled={sirenLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sirenLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Rechercher
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Saisissez 9 chiffres puis cliquez sur « Rechercher » pour auto-remplir les champs.
        </p>
      </div>

      {/* Raison Sociale — autocomplete */}
      <div>
        <FieldLabel>
          Raison Sociale
          {nameSearchLoading && <Loader2 className="w-3 h-3 inline ml-1 animate-spin text-blue-500" />}
        </FieldLabel>
        <div className="relative">
          <input
            type="text"
            value={companyProfile.raisonSociale}
            onChange={e => handleRaisonSocialeChange(e.target.value)}
            onFocus={() => nameSuggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => {
              // Only close the dropdown if the user is not clicking on a suggestion
              if (!suggestionMouseDownRef.current) setShowSuggestions(false);
            }}
            placeholder="Ex : SARL Dupont & Fils — ou tapez pour rechercher…"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {showSuggestions && nameSuggestions.length > 0 && (
            <div className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden max-h-60 overflow-y-auto">
              {nameSuggestions.map(s => (
                <button
                  key={s.siren}
                  type="button"
                  onMouseDown={() => {
                    suggestionMouseDownRef.current = true;
                    handleSuggestionSelect(s);
                  }}
                  onMouseUp={() => { suggestionMouseDownRef.current = false; }}
                  className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b border-gray-100 last:border-0 transition-colors"
                >
                  <p className="text-sm font-medium text-gray-900 truncate">{s.nomComplet}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {s.siren}{s.ville ? ` · ${s.ville}` : ''}{s.formeJuridique ? ` · ${s.formeJuridique}` : ''}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-1">Tapez au moins 3 caractères pour lancer une recherche par nom.</p>
      </div>

      {/* Contact */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <FieldLabel>Nom du contact</FieldLabel>
          <input
            type="text"
            value={companyProfile.nomContact}
            onChange={e => setCompanyProfile('nomContact', e.target.value)}
            placeholder="Ex : Dupont"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div>
          <FieldLabel>Prénom du contact</FieldLabel>
          <input
            type="text"
            value={companyProfile.prenomContact}
            onChange={e => setCompanyProfile('prenomContact', e.target.value)}
            placeholder="Ex : Jean"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      </div>

      {/* Email + Secteur d'activité */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <FieldLabel>Email du client</FieldLabel>
          <input
            type="email"
            value={companyProfile.clientEmail}
            onChange={e => setCompanyProfile('clientEmail', e.target.value)}
            placeholder="Ex : contact@entreprise.fr"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div>
          <FieldLabel>Secteur d'activité</FieldLabel>
          <input
            type="text"
            value={companyProfile.activity || ''}
            onChange={e => setCompanyProfile('activity', e.target.value)}
            placeholder="Renseigné automatiquement via SIREN..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      </div>

      {/* Adresse complète */}
      <div>
        <FieldLabel>Adresse complète</FieldLabel>
        <input
          type="text"
          value={companyProfile.adresse}
          onChange={e => setCompanyProfile('adresse', e.target.value)}
          placeholder="Ex : 12 rue de la Paix"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <FieldLabel>Code postal</FieldLabel>
          <input
            type="text"
            value={companyProfile.codePostal}
            onChange={e => setCompanyProfile('codePostal', e.target.value)}
            placeholder="Ex : 75001"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div>
          <FieldLabel>Ville</FieldLabel>
          <input
            type="text"
            value={companyProfile.ville}
            onChange={e => setCompanyProfile('ville', e.target.value)}
            placeholder="Ex : Paris"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <FieldLabel>Forme juridique</FieldLabel>
          <Select
            value={companyProfile.legalForm || undefined}
            onValueChange={v => setCompanyProfile('legalForm', v as LegalForm)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEGAL_FORMS.map(f => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <FieldLabel>Chiffre d'affaires annuel</FieldLabel>
          <Select
            value={companyProfile.revenueRange}
            onValueChange={v => setCompanyProfile('revenueRange', v as RevenueRange)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REVENUE_RANGES.map(r => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <FieldLabel>Régime fiscal</FieldLabel>
        <div className="flex items-center gap-3 mt-1">
          <span className={`text-sm font-medium ${companyProfile.taxRegime === 'IR' ? 'text-blue-700' : 'text-gray-400'}`}>
            IR
          </span>
          <Switch
            checked={companyProfile.taxRegime === 'IS'}
            onCheckedChange={v => setCompanyProfile('taxRegime', (v ? 'IS' : 'IR') as TaxRegime)}
          />
          <span className={`text-sm font-medium ${companyProfile.taxRegime === 'IS' ? 'text-blue-700' : 'text-gray-400'}`}>
            IS
          </span>
          <span className="text-xs text-gray-500 ml-1">
            {companyProfile.taxRegime === 'IS'
              ? '(Impôt sur les Sociétés — liasse IS, +4h de clôture)'
              : '(Impôt sur le Revenu — liasse 2031)'}
          </span>
        </div>
      </div>

      {/* Lots immobiliers (SCI / LMNP uniquement) */}
      {(companyProfile.legalForm === 'SCI' || companyProfile.legalForm === 'LMNP_REEL') && (
        <div>
          <FieldLabel>Nombre de lots immobiliers</FieldLabel>
          <input
            type="number"
            min={1}
            value={companyProfile.lotsImmobiliers ?? 1}
            onChange={e => setCompanyProfile('lotsImmobiliers', Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <p className="text-xs text-gray-500 mt-1">
            {(() => {
              const base = getRevisionBaseHours(companyProfile.legalForm, companyProfile.taxRegime, companyProfile.lotsImmobiliers ?? 1);
              const ca   = getRevisionCABonus(companyProfile.revenueRange, companyProfile.legalForm);
              const total = base + ca;
              return ca > 0
                ? `Révision : ${base.toFixed(1)} h base + ${ca.toFixed(1)} h CA = ${total.toFixed(1)} h/an`
                : `Révision : ${total.toFixed(1)} h/an`;
            })()}
          </p>
        </div>
      )}

      {/* TVA */}
      <div className="pt-1">
        <FieldLabel>TVA</FieldLabel>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Switch
              checked={accounting.isSubjectToTVA}
              onCheckedChange={v => setAccounting('isSubjectToTVA', v)}
            />
            <span className={`text-sm font-medium ${accounting.isSubjectToTVA ? 'text-blue-700' : 'text-gray-400'}`}>
              Assujetti à la TVA
            </span>
            <span className="text-xs text-gray-500">
              {accounting.isSubjectToTVA
                ? '(déclarations TVA incluses dans le calcul)'
                : '(aucun temps TVA)'}
            </span>
          </div>
          {accounting.isSubjectToTVA && (
            <div>
              <FieldLabel>Fréquence des déclarations TVA</FieldLabel>
              <Select
                value={accounting.tvaFrequency}
                onValueChange={v => setAccounting('tvaFrequency', v as TvaFrequency)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mensuel">Mensuel (12 déclarations / an)</SelectItem>
                  <SelectItem value="Trimestriel">Trimestriel (4 déclarations / an)</SelectItem>
                  <SelectItem value="Annuel">Annuel (1 déclaration / an)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

// ─── Section 2 — Accounting ───────────────────────────────────────────────────

function StepAccounting() {
  const { accounting, setAccounting } = usePricingStore();

  return (
    <SectionCard
      icon={<BookOpen className="w-4 h-4" />}
      title="Comptabilité"
      subtitle="Volumes de pièces, digitalisation et options"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <FieldLabel>Factures de vente / mois</FieldLabel>
          <Select
            value={accounting.salesInvoices}
            onValueChange={v => setAccounting('salesInvoices', v as InvoiceRange)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INVOICE_RANGES.map(r => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <FieldLabel>Factures d'achat / mois</FieldLabel>
          <Select
            value={accounting.purchaseInvoices}
            onValueChange={v => setAccounting('purchaseInvoices', v as InvoiceRange)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INVOICE_RANGES.map(r => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <FieldLabel>Format de transmission</FieldLabel>
        <div className="flex items-center gap-3 mt-1">
          <span className={`text-sm font-medium ${accounting.digitalization === 'papier' ? 'text-orange-600' : 'text-gray-400'}`}>
            Papier
          </span>
          <Switch
            checked={accounting.digitalization === 'numerique'}
            onCheckedChange={v =>
              setAccounting('digitalization', (v ? 'numerique' : 'papier') as Digitalization)
            }
          />
          <span className={`text-sm font-medium ${accounting.digitalization === 'numerique' ? 'text-green-600' : 'text-gray-400'}`}>
            100 % numérisé
          </span>
          <span className="text-xs text-gray-500 ml-1">
            {accounting.digitalization === 'numerique'
              ? '(coefficient ×0.7 — minoration 30%)'
              : '(coefficient ×1.3 — majoration 30%)'}
          </span>
        </div>
      </div>

      {/* Accounting options */}
      <div className="pt-1">
        <FieldLabel>Options comptabilité</FieldLabel>
        <div className="space-y-2">
          <OptionRow
            checked={accounting.bilanCompris}
            onChange={v => setAccounting('bilanCompris', v)}
            label="Rendez-vous Bilan compris"
            description="Rendez-vous de présentation du bilan, révision annuelle des comptes incluse dans le forfait"
            price={BILAN_COMPRIS_MONTHLY}
          />
          <OptionRow
            checked={accounting.rdvAtterrissage}
            onChange={v => setAccounting('rdvAtterrissage', v)}
            label="Rendez-vous d'atterrissage — pré-bilan 1 h"
            description="Entretien d'une heure avec l'expert-comptable avant la clôture pour anticiper les arbitrages fiscaux"
            price={ATTERRISSAGE_MONTHLY}
            priceUnit="/ mois (1 h/an)"
          />
          <OptionRow
            checked={accounting.situationsTrimestrielles}
            onChange={v => setAccounting('situationsTrimestrielles', v)}
            label="Situations trimestrielles"
            description="Arrêté des comptes chaque trimestre avec analyse des résultats intermédiaires"
            price={SITUATIONS_TRIM_MONTHLY}
          />
          <OptionRow
            checked={accounting.situationsMensuelles}
            onChange={v => setAccounting('situationsMensuelles', v)}
            label="Situations mensuelles"
            description="Arrêté mensuel des comptes avec reporting de gestion et suivi de trésorerie"
            price={SITUATIONS_MENS_MONTHLY}
          />
        </div>
      </div>
    </SectionCard>
  );
}

// ─── Section 3 — Social ───────────────────────────────────────────────────────

function StepSocial() {
  const { social, setSocial } = usePricingStore();
  const count = social.bulletinsPerMonth;
  const [showTariff, setShowTariff] = useState(false);

  return (
    <SectionCard
      icon={<Users className="w-4 h-4" />}
      title="Gestion sociale"
      subtitle="Bulletins de paie, déclarations et tarifs à l'acte"
    >
      {/* Bulletins count */}
      <div>
        <FieldLabel>Nombre de bulletins de paie / mois</FieldLabel>
        <Select
          value={String(count)}
          onValueChange={v => setSocial('bulletinsPerMonth', Number(v))}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EMPLOYEE_OPTIONS.map(n => {
              const label = n === 0
                ? 'Pas de gestion sociale'
                : `${n} bulletin${n > 1 ? 's' : ''} — ${n * BULLETIN_RATE} € HT / mois`;
              return (
                <SelectItem key={n} value={String(n)}>{label}</SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {count > 0 && (
        <>
          {/* Monthly social summary */}
          <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <span>
              {count} bulletin{count > 1 ? 's' : ''} × {BULLETIN_RATE} € + {DSN_MONTHLY_FEE} € DSN =&nbsp;
              <strong>{count * BULLETIN_RATE + DSN_MONTHLY_FEE} € HT / mois</strong>
            </span>
          </div>

          {/* Multi-établissement toggle */}
          <div>
            <FieldLabel>Type de dossier</FieldLabel>
            <div className="flex items-center gap-3 mt-1">
              <span className={`text-sm font-medium ${!social.multiEtablissement ? 'text-blue-700' : 'text-gray-400'}`}>
                Mono-établissement
              </span>
              <Switch
                checked={social.multiEtablissement}
                onCheckedChange={v => setSocial('multiEtablissement', v)}
              />
              <span className={`text-sm font-medium ${social.multiEtablissement ? 'text-blue-700' : 'text-gray-400'}`}>
                Multi-établissements
              </span>
              <span className="text-xs text-gray-500 ml-1">
                (mise en place {social.multiEtablissement ? SOCIAL_SETUP_MULTI : SOCIAL_SETUP_MONO} € — une seule fois)
              </span>
            </div>
          </div>
        </>
      )}

      {/* Tariff à l'acte — collapsible */}
      <div>
        <button
          type="button"
          onClick={() => setShowTariff(v => !v)}
          className="flex items-center gap-2 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
        >
          <Info className="w-3.5 h-3.5" />
          {showTariff ? 'Masquer' : 'Voir'} le tarif des prestations à l'acte
        </button>

        {showTariff && (
          <div className="mt-3 rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">
              Tarifs à l'acte — facturés en sus du forfait mensuel
            </div>
            <div className="divide-y divide-gray-100">
              {SOCIAL_EVENT_TARIFF.map(item => (
                <div key={item.label} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-gray-700">{item.label}</span>
                  <span className="font-medium text-gray-900 flex-shrink-0 ml-4">
                    {item.price} {item.unit}
                  </span>
                </div>
              ))}
              <div className="px-4 py-3 bg-amber-50 text-xs text-amber-700">
                <strong>Prestation complémentaire non listée :</strong> facturation au temps passé, minimum 120 € / heure, sur accord préalable.
              </div>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ─── Section 3b — Juridique ──────────────────────────────────────────────────

function StepJuridique() {
  const { options, setOption, companyProfile } = usePricingStore();
  const [showTariff, setShowTariff] = useState(false);
  const agChecked = options.assembleGenerale;

  // Tarif secrétariat annuel dynamique selon la forme juridique
  const secretariatAnnuel = getSecretariatJuridiqueAnnuel(companyProfile.legalForm);
  const secretariatMensuel = secretariatAnnuel !== null
    ? Math.ceil(secretariatAnnuel / 12)
    : OPTION_PRICES.assembleGenerale;

  const legalFormLabel = LEGAL_FORMS.find(f => f.value === companyProfile.legalForm)?.label ?? companyProfile.legalForm;

  return (
    <SectionCard
      icon={<Scale className="w-4 h-4" />}
      title="Gestion juridique"
      subtitle="Secrétariat juridique annuel et prestations à l'acte"
    >
      {/* Main option — secrétariat annuel */}
      <div>
        <FieldLabel>Secrétariat juridique annuel</FieldLabel>
        {secretariatAnnuel !== null ? (
          <OptionRow
            checked={agChecked}
            onChange={v => setOption('assembleGenerale', v)}
            label={
              companyProfile.legalForm === 'SCI'
                ? 'Assemblée générale d\'approbation et dépôt'
                : companyProfile.legalForm === 'EURL' || companyProfile.legalForm === 'SASU'
                ? 'Décisions de l\'associé unique et dépôt'
                : 'Assemblée générale d\'approbation et dépôt'
            }
            description={`Tarif ${legalFormLabel} — ${secretariatAnnuel} €/an (amorti sur 12 mois)`}
            price={secretariatMensuel}
          />
        ) : (
          <p className="text-xs text-gray-500 italic py-2">
            Pas de secrétariat juridique standard pour la forme {legalFormLabel}.
          </p>
        )}
      </div>

      {agChecked && secretariatAnnuel !== null && (
        <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <span>
            Secrétariat juridique inclus :&nbsp;
            <strong>+{secretariatMensuel} € HT / mois</strong>
            <span className="text-blue-600 font-normal ml-1">(soit {secretariatAnnuel} €/an)</span>
          </span>
        </div>
      )}

      {/* Tariff à l'acte — collapsible */}
      <div>
        <button
          type="button"
          onClick={() => setShowTariff(v => !v)}
          className="flex items-center gap-2 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
        >
          <Info className="w-3.5 h-3.5" />
          {showTariff ? 'Masquer' : 'Voir'} le tarif des prestations exceptionnelles à l'acte
        </button>

        {showTariff && (
          <div className="mt-3 rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">
              Prestations exceptionnelles (à l'acte) — hors débours
            </div>
            <div className="divide-y divide-gray-100">
              {JURIDIQUE_ACTE_TARIFF.map(item => (
                <div key={item.label} className="flex items-start justify-between px-4 py-2.5 text-sm gap-4">
                  <div>
                    <span className="text-gray-800 font-medium">{item.label}</span>
                    {item.note && (
                      <p className="text-xs text-gray-500 mt-0.5">{item.note}</p>
                    )}
                  </div>
                  <span className="font-semibold text-gray-900 flex-shrink-0 whitespace-nowrap">
                    {item.price} {item.unit}
                  </span>
                </div>
              ))}
              <div className="px-4 py-3 bg-amber-50 text-xs text-amber-700">
                <strong>Prestation non listée :</strong> facturation au temps passé, sur accord préalable.
              </div>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ─── Section 4 — Options & Services ──────────────────────────────────────────

function StepOptions() {
  const { options, setOption } = usePricingStore();

  return (
    <SectionCard
      icon={<Settings2 className="w-4 h-4" />}
      title="Options & services complémentaires"
      subtitle="Cochez les services souhaités — le tarif se met à jour en temps réel"
    >
      <div className="space-y-3">
        <OptionRow
          checked={options.ticketsSupport5an}
          onChange={v => setOption('ticketsSupport5an', v)}
          label="5 tickets de support / an"
          description="Intervention ponctuelle garantie — questions fiscales, sociales ou comptables urgentes"
          price={OPTION_PRICES.ticketsSupport5an}
        />
        <OptionRow
          checked={options.whatsappDedie}
          onChange={v => setOption('whatsappDedie', v)}
          label="Ligne WhatsApp dédiée"
          description="Canal direct avec votre expert-comptable — Réponse sous 24h-48h"
          price={OPTION_PRICES.whatsappDedie}
        />
        <OptionRow
          checked={options.appelsPrioritaires}
          onChange={v => setOption('appelsPrioritaires', v)}
          label="Appels prioritaires compris"
          description="Accès téléphonique prioritaire — file dédiée, sans attente"
          price={OPTION_PRICES.appelsPrioritaires}
        />
      </div>

      {(options.ticketsSupport5an || options.whatsappDedie || options.appelsPrioritaires) && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
          <span>
            Options sélectionnées :&nbsp;
            <strong>
              +{
                (options.ticketsSupport5an  ? OPTION_PRICES.ticketsSupport5an  : 0) +
                (options.whatsappDedie      ? OPTION_PRICES.whatsappDedie      : 0) +
                (options.appelsPrioritaires ? OPTION_PRICES.appelsPrioritaires : 0)
              } € HT / mois
            </strong>
          </span>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Proposal email HTML builder ──────────────────────────────────────────────

/** Escapes special HTML characters to prevent XSS in generated email content. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildProposalEmailHtml(params: {
  quotes: SavedQuote[];
  setupDiscountPct: 0 | 10 | 20 | 50 | 75 | 100;
  feesDiscountPct: number;
  cabinetInfo?: CabinetInfo;
}): string {
  const { quotes, setupDiscountPct, feesDiscountPct, cabinetInfo } = params;
  if (quotes.length === 0) return '';

  const cabinet = cabinetInfo ?? getCabinetInfo();
  const fmt = (n: number) => n.toLocaleString('fr-FR') + ' €';
  const dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  // Escape helper aliases for readability
  const e = escapeHtml;

  const firstQuote = quotes[0];
  const lastQuote = quotes[quotes.length - 1];

  // ── Invoice volume label helper ──────────────────────────────────────────────
  const invoiceLabel = (range: string | undefined) => range ?? '—';

  const invoiceVolumeParts = (q: SavedQuote): string => {
    const parts: string[] = [];
    if (q.salesInvoices) parts.push(`${invoiceLabel(q.salesInvoices)} vente`);
    if (q.purchaseInvoices) parts.push(`${invoiceLabel(q.purchaseInvoices)} achat`);
    return parts.join(' · ');
  };

  // ── Per-quote section ────────────────────────────────────────────────────────
  const quoteSections = quotes.map((q, idx) => {
    const sectionTitle = quotes.length > 1
      ? `Option ${idx + 1} — ${q.legalForm}`
      : 'Proposition tarifaire sur mesure';

    const discountedMonthly = feesDiscountPct > 0
      ? Math.round(q.totalMonthlyHT * (1 - feesDiscountPct / 100))
      : q.totalMonthlyHT;

    // ── Fee rows ──────────────────────────────────────────────────────────────
    const rows = [
      q.monthlyAccountingPrice > 0 ? `
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#374151;font-size:14px;">Tenue comptable &amp; saisie des pièces</td>
          <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:right;color:#374151;font-size:14px;">${fmt(q.monthlyAccountingPrice)}<span style="font-size:11px;color:#9ca3af;"> /mois</span></td>
          <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;color:#1d4ed8;font-size:14px;">${fmt(q.monthlyAccountingPrice * 12)}<span style="font-size:11px;color:#9ca3af;"> /an</span></td>
        </tr>` : '',
      q.monthlyClosurePrice > 0 ? `
        <tr style="background:#f9fafb;">
          <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#374151;font-size:14px;">Révision, clôture, bilan &amp; liasse fiscale</td>
          <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:right;color:#374151;font-size:14px;">${fmt(q.monthlyClosurePrice)}<span style="font-size:11px;color:#9ca3af;"> /mois</span></td>
          <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;color:#1d4ed8;font-size:14px;">${fmt(q.monthlyClosurePrice * 12)}<span style="font-size:11px;color:#9ca3af;"> /an</span></td>
        </tr>` : '',
      q.monthlySocialPrice > 0 ? `
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#374151;font-size:14px;">Gestion sociale &amp; bulletins de paie${q.bulletinsPerMonth > 0 ? ` <span style="font-size:12px;color:#6b7280;">(${q.bulletinsPerMonth} bulletin${q.bulletinsPerMonth > 1 ? 's' : ''}${q.multiEtablissement ? ', multi-étab.' : ''})</span>` : ''}</td>
          <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:right;color:#374151;font-size:14px;">${fmt(q.monthlySocialPrice)}<span style="font-size:11px;color:#9ca3af;"> /mois</span></td>
          <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;color:#1d4ed8;font-size:14px;">${fmt(q.monthlySocialPrice * 12)}<span style="font-size:11px;color:#9ca3af;"> /an</span></td>
        </tr>` : '',
      q.monthlyOptionsPrice > 0 ? `
        <tr style="background:#f9fafb;">
          <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#374151;font-size:14px;">Services &amp; options complémentaires</td>
          <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:right;color:#374151;font-size:14px;">${fmt(q.monthlyOptionsPrice)}<span style="font-size:11px;color:#9ca3af;"> /mois</span></td>
          <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;color:#1d4ed8;font-size:14px;">${fmt(q.monthlyOptionsPrice * 12)}<span style="font-size:11px;color:#9ca3af;"> /an</span></td>
        </tr>` : '',
    ].join('');

    // ── Discount row ──────────────────────────────────────────────────────────
    const feesDiscountRow = feesDiscountPct > 0 ? `
      <tr>
        <td colspan="3" style="padding:12px 20px;background:#fef3c7;border-bottom:1px solid #fde68a;">
          <span style="color:#92400e;font-size:13px;">
            🏷️ <strong>Remise honoraires ${feesDiscountPct}%</strong> :
            <span style="text-decoration:line-through;color:#b45309;">${fmt(q.totalMonthlyHT)}/mois</span>
            → <strong>${fmt(discountedMonthly)}/mois</strong>
            (soit <strong>${fmt(discountedMonthly * 12)}/an</strong>)
          </span>
        </td>
      </tr>
      <tr style="background:linear-gradient(90deg,#d1fae5,#ecfdf5);">
        <td style="padding:20px 20px;font-weight:800;color:#065f46;font-size:16px;border-top:2px solid #6ee7b7;letter-spacing:.01em;">TOTAL REMISÉ HT</td>
        <td style="padding:20px 20px;text-align:right;font-weight:900;color:#065f46;font-size:28px;border-top:2px solid #6ee7b7;">${fmt(discountedMonthly)}</td>
        <td style="padding:20px 20px;text-align:right;font-weight:900;color:#059669;font-size:28px;border-top:2px solid #6ee7b7;">${fmt(discountedMonthly * 12)}</td>
      </tr>` : '';

    // ── Total block ───────────────────────────────────────────────────────────
    const totalBlock = feesDiscountPct === 0 ? `
      <tr style="background:linear-gradient(90deg,#1e3a5f,#1d4ed8);">
        <td style="padding:20px 16px 8px;font-weight:800;color:#ffffff;font-size:17px;border-top:3px solid #3b82f6;letter-spacing:.02em;">TOTAL MENSUEL HT</td>
        <td style="padding:20px 16px 8px;text-align:right;font-weight:900;color:#ffffff;font-size:22px;border-top:3px solid #3b82f6;">${fmt(q.totalMonthlyHT)}</td>
        <td style="padding:20px 16px 8px;text-align:right;font-weight:900;color:#93c5fd;font-size:22px;border-top:3px solid #3b82f6;">${fmt(q.totalMonthlyHT * 12)}</td>
      </tr>
      <tr style="background:linear-gradient(90deg,#1e3a5f,#1d4ed8);">
        <td style="padding:2px 16px 16px;font-size:12px;color:#bfdbfe;font-style:italic;">Engagement annuel</td>
        <td colspan="2" style="padding:2px 16px 16px;text-align:right;font-size:11px;color:#bfdbfe;">TVA 20% : ${fmt(Math.round(q.totalMonthlyHT * 1.2))} TTC/mois · ${fmt(Math.round(q.totalMonthlyHT * 1.2 * 12))} TTC/an</td>
      </tr>` : `
      <tr style="background:#f0f9ff;">
        <td style="padding:12px 16px;font-size:12px;color:#6b7280;">TVA 20% applicable</td>
        <td style="padding:12px 16px;text-align:right;font-size:12px;color:#6b7280;">${fmt(Math.round(q.totalMonthlyHT * 1.2))} TTC</td>
        <td style="padding:12px 16px;text-align:right;font-size:12px;color:#6b7280;">${fmt(Math.round(q.totalMonthlyHT * 1.2 * 12))} TTC</td>
      </tr>`;

    // ── "Ce qui est inclus" section ───────────────────────────────────────────
    const inclusions: string[] = [];
    if (q.monthlyAccountingPrice > 0) inclusions.push('Tenue comptable & suivi des pièces justificatives');
    if (q.monthlyClosurePrice > 0) inclusions.push('Révision annuelle, établissement du bilan & liasse fiscale');
    if (q.monthlySocialPrice > 0) {
      inclusions.push(`Gestion de la paie & établissement des bulletins${q.bulletinsPerMonth > 0 ? ` (${q.bulletinsPerMonth} bulletin${q.bulletinsPerMonth > 1 ? 's' : ''}/mois)` : ''}`);
      inclusions.push('Déclarations sociales (DSN mensuelle)');
    }
    if (q.bilanCompris) inclusions.push('Rendez-vous bilan annuel avec votre expert-comptable');
    if (q.rdvAtterrissage) inclusions.push('Rendez-vous d\'atterrissage fiscal (estimation IS/IR)');
    if (q.options.ticketsSupport5an) inclusions.push('5 tickets de support prioritaire par an');
    if (q.options.whatsappDedie) inclusions.push('Ligne WhatsApp dédiée pour questions rapides');
    if (q.options.appelsPrioritaires) inclusions.push('Appels téléphoniques prioritaires inclus');
    if (q.options.assembleGenerale) inclusions.push('Assemblée générale annuelle & dépôt des comptes');

    const inclusionListHtml = inclusions
      .map(item => `
        <li style="display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid #e7f3ef;font-size:13.5px;color:#1f2937;list-style:none;margin:0;">
          <span style="flex-shrink:0;font-size:15px;line-height:1.4;">✅</span>
          <span style="line-height:1.5;">${item}</span>
        </li>`)
      .join('');

    const inclusionSection = inclusions.length > 0 ? `
    <div style="margin:0 32px 28px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="padding:14px 22px 10px;background:linear-gradient(90deg,#eff6ff,#f8fafc);border-bottom:1px solid #e2e8f0;">
        <p style="margin:0;font-size:12px;font-weight:700;color:#1d4ed8;text-transform:uppercase;letter-spacing:.06em;">✨ Ce qui est inclus dans votre accompagnement</p>
      </div>
      <ul style="margin:0;padding:6px 22px 6px;">
        ${inclusionListHtml}
      </ul>
    </div>` : '';

    // ── "Temps estimés" section ───────────────────────────────────────────────
    const annualInvoiceHours = (q.monthlyAccountingPrice * 12) / TAUX_HORAIRE_TENUE;
    const closureAdjustedHours = (q.monthlyClosurePrice * 12) / TAUX_HORAIRE_REVISION;

    const timeRows: string[] = [];
    if (q.monthlyAccountingPrice > 0) {
      timeRows.push(`
        <tr>
          <td style="padding:10px 20px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#374151;">⏱️ Saisie comptable annuelle (tenue)</td>
          <td style="padding:10px 20px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;color:#1d4ed8;font-size:13px;">${annualInvoiceHours.toFixed(1)} h/an</td>
        </tr>`);
    }
    if (q.monthlyClosurePrice > 0) {
      timeRows.push(`
        <tr style="background:#f9fafb;">
          <td style="padding:10px 20px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#374151;">📋 Révision &amp; établissement du bilan</td>
          <td style="padding:10px 20px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;color:#1d4ed8;font-size:13px;">${closureAdjustedHours.toFixed(1)} h/an</td>
        </tr>`);
    }
    if (q.bulletinsPerMonth > 0) {
      timeRows.push(`
        <tr>
          <td style="padding:10px 20px;font-size:13px;color:#374151;">👥 Bulletins de paie</td>
          <td style="padding:10px 20px;text-align:right;font-weight:600;color:#7c3aed;font-size:13px;">${q.bulletinsPerMonth} bulletin${q.bulletinsPerMonth > 1 ? 's' : ''}/mois</td>
        </tr>`);
    }

    const timesSection = timeRows.length > 0 ? `
    <div style="margin:0 32px 28px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="padding:12px 20px;background:linear-gradient(90deg,#f8fafc,#f1f5f9);border-bottom:1px solid #e2e8f0;">
        <p style="margin:0;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;">🕒 Estimation du temps de travail</p>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tbody>
          ${timeRows.join('')}
        </tbody>
      </table>
    </div>` : '';

    return `
    <div style="padding:28px 32px 8px;">
      <p style="margin:0 0 14px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;border-left:3px solid #3b82f6;padding-left:10px;">${sectionTitle}</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;border-collapse:collapse;box-shadow:0 2px 8px rgba(0,0,0,.06);">
        <thead>
          <tr style="background:linear-gradient(90deg,#f8fafc,#f1f5f9);">
            <th style="padding:14px 20px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;border-bottom:1px solid #e2e8f0;font-weight:700;">Mission</th>
            <th style="padding:14px 20px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;border-bottom:1px solid #e2e8f0;font-weight:700;">Mensuel HT</th>
            <th style="padding:14px 20px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;border-bottom:1px solid #e2e8f0;font-weight:700;">Annuel HT</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          ${totalBlock}
          ${feesDiscountRow}
        </tbody>
      </table>
    </div>
    ${inclusionSection}
    ${timesSection}`;
  }).join('');

  const totalSetupBase = lastQuote.setupFees;
  const setupDiscountAmount = Math.round(totalSetupBase * setupDiscountPct / 100);
  const totalSetupFinal = totalSetupBase - setupDiscountAmount;

  const setupDiscountBadge = setupDiscountPct > 0 ? `
    <tr>
      <td colspan="2" style="padding:8px 16px;background:#fef9c3;border-top:1px solid #fde68a;">
        <span style="color:#92400e;font-size:12px;">
          🏷️ <strong>Remise ${setupDiscountPct}% appliquée</strong> sur les frais d'intégration
        </span>
      </td>
    </tr>` : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proposition de conseil — ${e(firstQuote.clientName)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:680px;margin:36px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.10);">

    <!-- Header premium -->
    <div style="background:linear-gradient(135deg,#0f2847 0%,#1e40af 60%,#3b82f6 100%);padding:36px 36px 28px;position:relative;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:top;">
            <div style="background:rgba(255,255,255,0.15);border-radius:12px;width:52px;height:52px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:14px;text-align:center;line-height:52px;font-size:26px;">📊</div>
            ${cabinet.nom ? `<h1 style="margin:0 0 4px;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-.01em;">${e(cabinet.nom)}</h1>` : ''}
            <p style="margin:0;color:#93c5fd;font-size:13px;line-height:1.5;">
              ${[cabinet.adresse, cabinet.codePostal, cabinet.ville].filter(Boolean).map(e).join(' · ')}
              ${cabinet.telephone ? ' · ' + e(cabinet.telephone) : ''}
            </p>
            ${cabinet.expertEmail ? `<p style="margin:3px 0 0;color:#bfdbfe;font-size:12px;">${e(cabinet.expertEmail)}</p>` : ''}
          </td>
          <td style="text-align:right;vertical-align:top;">
            <div style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:10px;padding:12px 18px;display:inline-block;">
              <p style="margin:0;color:#bfdbfe;font-size:10px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;">Proposition</p>
              <p style="margin:6px 0 0;color:#ffffff;font-size:14px;font-weight:700;">${dateStr}</p>
            </div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Title banner -->
    <div style="background:#1d4ed8;padding:13px 36px;">
      <h2 style="margin:0;color:#ffffff;font-size:13px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;">💼 Proposition de Mission comptable et conseil</h2>
    </div>

    <!-- Client info -->
    <div style="padding:24px 36px;background:linear-gradient(180deg,#f8fafc,#ffffff);border-bottom:1px solid #e2e8f0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="width:55%;vertical-align:top;">${(() => {
            const adresseLine = [
              firstQuote.adresse,
              [firstQuote.codePostal, firstQuote.ville].filter(Boolean).join(' '),
            ].filter(Boolean).join(', ');
            return `
            <p style="margin:0 0 5px;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#94a3b8;font-weight:700;">Établi pour</p>
            <p style="margin:0 0 2px;font-size:18px;font-weight:800;color:#0f172a;">${e(firstQuote.clientName)}</p>
            ${firstQuote.raisonSociale && firstQuote.raisonSociale !== firstQuote.clientName ? `<p style="margin:0 0 3px;font-size:13px;color:#64748b;font-style:italic;">${e(firstQuote.raisonSociale)}</p>` : ''}
            <p style="margin:0 0 6px;font-size:13px;color:#475569;">
              ${e(firstQuote.legalForm)}${firstQuote.revenueRange ? ' · CA ' + e(firstQuote.revenueRange) : ''}${firstQuote.taxRegime ? ' · ' + e(firstQuote.taxRegime) : ''}
            </p>
            ${firstQuote.activity ? `<p style="margin:0 0 4px;font-size:12px;color:#64748b;">🏭 ${e(firstQuote.activity)}</p>` : ''}
            ${firstQuote.digitalization ? `<p style="margin:0 0 4px;font-size:12px;color:#64748b;">📄 ${firstQuote.digitalization === 'numerique' ? '100 % dématérialisé' : 'Gestion papier'}</p>` : ''}
            ${(firstQuote.salesInvoices || firstQuote.purchaseInvoices) ? `
            <p style="margin:4px 0 2px;font-size:12px;color:#475569;">
              🔢 <strong>Factures :</strong> ${invoiceVolumeParts(firstQuote)} <span style="color:#94a3b8;">/mois</span>
            </p>` : ''}
            ${firstQuote.monthlySocialPrice > 0 && firstQuote.bulletinsPerMonth > 0 ? `
            <p style="margin:2px 0;font-size:12px;color:#475569;">
              👥 <strong>Paie :</strong> ${firstQuote.bulletinsPerMonth} bulletin${firstQuote.bulletinsPerMonth > 1 ? 's' : ''}/mois${firstQuote.multiEtablissement ? ' — multi-établissements' : ''}
            </p>` : ''}
            ${adresseLine ? `<p style="margin:5px 0 0;font-size:12px;color:#94a3b8;">📍 ${e(adresseLine)}</p>` : ''}
            ${firstQuote.siren ? `<p style="margin:2px 0 0;font-size:11px;color:#94a3b8;">SIREN : ${e(firstQuote.siren)}</p>` : ''}`;
          })()}
          </td>
          <td style="width:45%;vertical-align:top;text-align:right;">
            <p style="margin:0 0 5px;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#94a3b8;font-weight:700;">Votre expert-comptable</p>
            ${cabinet.expertNom ? `<p style="margin:0 0 2px;font-size:15px;font-weight:700;color:#0f172a;">${e(cabinet.expertNom)}</p>` : ''}
            ${cabinet.nom ? `<p style="margin:0 0 2px;font-size:13px;color:#475569;">${e(cabinet.nom)}</p>` : ''}
            ${cabinet.expertEmail ? `<p style="margin:2px 0 0;font-size:12px;color:#475569;">${e(cabinet.expertEmail)}</p>` : ''}
            ${cabinet.telephone ? `<p style="margin:2px 0 0;font-size:12px;color:#475569;">${e(cabinet.telephone)}</p>` : ''}
          </td>
        </tr>
      </table>
    </div>

    <!-- Quote sections -->
    ${quoteSections}

    <!-- Setup fees -->
    <div style="padding:12px 32px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #fcd34d;border-radius:10px;overflow:hidden;background:linear-gradient(135deg,#fffbeb,#fef3c7);">
        <tbody>
          <tr>
            <td style="padding:16px 20px;">
              <p style="margin:0 0 3px;font-size:14px;font-weight:700;color:#92400e;">⚙️ Frais d'intégration initiaux (une seule fois)</p>
              <p style="margin:0;font-size:11px;color:#b45309;line-height:1.5;">Paramétrage complet, conformité LAB, collecte KBIS/FEC, mise en place des accès</p>
            </td>
            <td style="padding:16px 20px;text-align:right;vertical-align:middle;white-space:nowrap;">
              ${setupDiscountPct > 0
                ? `<span style="text-decoration:line-through;color:#d97706;font-size:13px;display:block;">${fmt(totalSetupBase)}</span><strong style="color:#92400e;font-size:20px;font-weight:800;">${fmt(totalSetupFinal)}</strong>`
                : `<strong style="color:#92400e;font-size:20px;font-weight:800;">${fmt(totalSetupBase)}</strong>`
              }
            </td>
          </tr>
          ${setupDiscountBadge}
        </tbody>
      </table>
    </div>

    <!-- Legal note -->
    <div style="padding:0 36px 24px;">
      <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.7;border-top:1px dashed #e2e8f0;padding-top:16px;">
        Les honoraires sont exprimés hors taxes (TVA 20 % à ajouter). Cette proposition est personnalisée et valable 30 jours à compter de sa date d'émission.
        ${cabinet.siren ? `N° SIREN : ${e(cabinet.siren)}.` : ''}
        ${cabinet.numeroOrdre ? `Inscrit à l'Ordre des experts-comptables sous le N° ${e(cabinet.numeroOrdre)}.` : ''}
      </p>
    </div>

    <!-- Footer -->
    <div style="background:linear-gradient(90deg,#f8fafc,#f1f5f9);border-top:1px solid #e2e8f0;padding:18px 36px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#64748b;">
        ${cabinet.nom ? `<strong style="color:#1e293b;">${e(cabinet.nom)}</strong>` : ''}
        ${cabinet.ville ? ` · ${e(cabinet.ville)}` : ''}
        ${cabinet.telephone ? ` · ${e(cabinet.telephone)}` : ''}
        ${cabinet.expertEmail ? ` · ${e(cabinet.expertEmail)}` : ''}
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ─── Proposal preview modal ────────────────────────────────────────────────────

function ProposalDetailSummary({ quote }: { quote: SavedQuote }) {
  const fmt = (n: number) => n.toLocaleString('fr-FR') + ' €';

  // Derive estimated hours from stored prices (avoids re-running with incomplete data)
  const annualInvoiceHours = (quote.monthlyAccountingPrice * 12) / TAUX_HORAIRE_TENUE;
  const closureAdjustedHours = (quote.monthlyClosurePrice * 12) / TAUX_HORAIRE_REVISION;

  const statusLabel = quote.status === 'VALIDATED' ? 'Validé' : quote.status === 'SIGNED' ? 'Signé' : quote.status === 'PENDING_ONBOARDING' ? 'Onboarding' : null;
  const statusColor = quote.status === 'PENDING_ONBOARDING' ? 'bg-violet-100 text-violet-700 border-violet-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200';

  // Build inclusion list
  const inclusions: { emoji: string; label: string }[] = [];
  if (quote.monthlyAccountingPrice > 0) inclusions.push({ emoji: '📚', label: 'Tenue comptable & saisie des pièces' });
  if (quote.monthlyClosurePrice > 0) inclusions.push({ emoji: '📋', label: 'Révision annuelle, bilan & liasse fiscale' });
  if (quote.monthlySocialPrice > 0) {
    inclusions.push({ emoji: '👥', label: `Bulletins de paie (${quote.bulletinsPerMonth} /mois)${quote.multiEtablissement ? ' — multi-établissements' : ''}` });
    inclusions.push({ emoji: '📡', label: 'Déclarations sociales (DSN mensuelle)' });
  }
  if (quote.bilanCompris) inclusions.push({ emoji: '🤝', label: 'Rendez-vous bilan annuel' });
  if (quote.rdvAtterrissage) inclusions.push({ emoji: '🛬', label: 'RDV atterrissage fiscal' });
  if (quote.options.ticketsSupport5an) inclusions.push({ emoji: '🎫', label: '5 tickets de support prioritaire / an' });
  if (quote.options.whatsappDedie) inclusions.push({ emoji: '💬', label: 'Ligne WhatsApp dédiée' });
  if (quote.options.appelsPrioritaires) inclusions.push({ emoji: '📞', label: 'Appels téléphoniques prioritaires' });
  if (quote.options.assembleGenerale) inclusions.push({ emoji: '🏛️', label: 'Assemblée générale & dépôt des comptes' });

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-slate-100 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Récapitulatif détaillé</span>
        </div>
        {statusLabel && (
          <Badge className={`text-xs font-medium border ${statusColor}`} variant="outline">{statusLabel}</Badge>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Client info grid with icons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 flex items-start gap-2">
            <UserCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-slate-400 font-medium uppercase tracking-wide text-[10px] mb-0.5">Client</p>
              <p className="font-semibold text-slate-800">{quote.clientName}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 flex items-start gap-2">
            <Building2 className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-slate-400 font-medium uppercase tracking-wide text-[10px] mb-0.5">Forme juridique</p>
              <p className="font-semibold text-slate-800">{quote.legalForm}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 flex items-start gap-2">
            <Briefcase className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-slate-400 font-medium uppercase tracking-wide text-[10px] mb-0.5">Régime fiscal</p>
              <p className="font-semibold text-slate-800">{quote.taxRegime}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 flex items-start gap-2">
            <Receipt className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-slate-400 font-medium uppercase tracking-wide text-[10px] mb-0.5">CA estimé</p>
              <p className="font-semibold text-slate-800">{quote.revenueRange}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 flex items-start gap-2">
            <Smartphone className="w-4 h-4 text-cyan-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-slate-400 font-medium uppercase tracking-wide text-[10px] mb-0.5">Dématérialisation</p>
              <p className="font-semibold text-slate-800">{quote.digitalization === 'numerique' ? '100 % numérique' : 'Papier'}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 flex items-start gap-2">
            <FileText className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-slate-400 font-medium uppercase tracking-wide text-[10px] mb-0.5">Date</p>
              <p className="font-semibold text-slate-800">{new Date(quote.createdAt).toLocaleDateString('fr-FR')}</p>
            </div>
          </div>
        </div>

        {/* Volume de pièces */}
        {(quote.salesInvoices || quote.purchaseInvoices) && (
          <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3">
            <Scale className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <div className="flex gap-4 text-xs">
              {quote.salesInvoices && (
                <div>
                  <p className="text-slate-400 font-medium uppercase tracking-wide text-[10px]">Factures vente</p>
                  <p className="font-semibold text-slate-800">{quote.salesInvoices} / mois</p>
                </div>
              )}
              {quote.purchaseInvoices && (
                <div>
                  <p className="text-slate-400 font-medium uppercase tracking-wide text-[10px]">Factures achat</p>
                  <p className="font-semibold text-slate-800">{quote.purchaseInvoices} / mois</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Heures estimées */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Temps estimés</p>
          </div>
          <div className="divide-y divide-slate-100">
            <div className="flex justify-between items-center px-4 py-2.5 text-sm">
              <span className="text-slate-600">Temps de saisie annuel (tenue comptable)</span>
              <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-700 text-xs font-medium">
                {annualInvoiceHours.toFixed(1)} h/an
              </Badge>
            </div>
            <div className="flex justify-between items-center px-4 py-2.5 text-sm">
              <span className="text-slate-600">Temps de révision &amp; bilan (liasse fiscale)</span>
              <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-700 text-xs font-medium">
                {closureAdjustedHours.toFixed(1)} h/an
              </Badge>
            </div>
            {quote.bulletinsPerMonth > 0 && (
              <div className="flex justify-between items-center px-4 py-2.5 text-sm">
                <span className="text-slate-600">Bulletins de paie</span>
                <Badge variant="outline" className="bg-violet-50 border-violet-200 text-violet-700 text-xs font-medium">
                  {quote.bulletinsPerMonth} bulletin{quote.bulletinsPerMonth > 1 ? 's' : ''}/mois
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* Ce qui est inclus — vertical list with icons */}
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 overflow-hidden">
          <div className="bg-emerald-100 px-4 py-2.5 border-b border-emerald-200">
            <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">✨ Ce qui est inclus dans votre accompagnement</p>
          </div>
          {inclusions.length > 0 ? (
            <ul className="divide-y divide-emerald-100 px-0 py-0 m-0">
              {inclusions.map((item, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700">
                  <span className="text-base flex-shrink-0">{item.emoji}</span>
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-xs text-slate-400 italic">Aucun service additionnel sélectionné</p>
          )}
        </div>

        {/* Prix récapitulatif */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          <div className="bg-white rounded-xl border border-slate-200 px-3 py-2.5">
            <p className="text-[10px] text-slate-400 uppercase font-medium mb-0.5">Tenue compta</p>
            <p className="text-sm font-bold text-slate-800">{fmt(quote.monthlyAccountingPrice)}</p>
            <p className="text-[10px] text-slate-400">/mois</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 px-3 py-2.5">
            <p className="text-[10px] text-slate-400 uppercase font-medium mb-0.5">Clôture / bilan</p>
            <p className="text-sm font-bold text-slate-800">{fmt(quote.monthlyClosurePrice)}</p>
            <p className="text-[10px] text-slate-400">/mois</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 px-3 py-2.5">
            <p className="text-[10px] text-slate-400 uppercase font-medium mb-0.5">Social</p>
            <p className="text-sm font-bold text-slate-800">{fmt(quote.monthlySocialPrice)}</p>
            <p className="text-[10px] text-slate-400">/mois</p>
          </div>
          <div className="bg-blue-50 rounded-xl border border-blue-200 px-3 py-2.5">
            <p className="text-[10px] text-blue-600 uppercase font-semibold mb-0.5">Total HT</p>
            <p className="text-base font-bold text-blue-700">{fmt(quote.totalMonthlyHT)}</p>
            <p className="text-[10px] text-blue-500">/mois</p>
          </div>
        </div>
        {quote.setupFees > 0 && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <strong>Frais d'intégration initiaux :</strong> {fmt(quote.setupFees)} HT (une seule fois)
          </p>
        )}
      </div>
    </div>
  );
}

function ProposalEmailPreviewModal({
  open,
  onClose,
  clientName,
  clientEmail,
  htmlContent,
  quotesCount,
  quote,
  onValidate,
  cabinetInfo,
}: {
  open: boolean;
  onClose: () => void;
  clientName: string;
  clientEmail: string;
  htmlContent: string;
  quotesCount: number;
  quote?: SavedQuote;
  onValidate?: (status: 'SENT' | 'VALIDATED' | 'SIGNED' | 'PENDING_ONBOARDING') => void;
  cabinetInfo?: CabinetInfo;
}) {
  const [sending, setSending] = useState(false);
  const [iframeHeight, setIframeHeight] = useState(600);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  /** Local email state — allows user to fill in a missing email before sending */
  const [localEmail, setLocalEmail] = useState(clientEmail);
  const [savingEmail, setSavingEmail] = useState(false);

  // Sync local email when the prop changes (e.g. when a different quote is opened)
  useEffect(() => {
    setLocalEmail(clientEmail);
  }, [clientEmail, open]);

  const cabinet = cabinetInfo ?? getCabinetInfo();
  const emailConfig = getEmailConfig();
  const senderDisplay = emailConfig.isDemo
    ? (cabinet.expertEmail || 'cabinet@example.fr')
    : emailConfig.fromEmail;
  const senderName = emailConfig.isDemo
    ? (cabinet.nom || 'Cabinet')
    : (emailConfig.fromName || cabinet.nom || 'Cabinet');

  const handleExportPdf = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(htmlContent);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
    // Mark the quote as SENT in Supabase. The parent handleValidate shows an
    // error toast on failure, so we just suppress any unexpected rejection here.
    if (quote?.supabaseId) {
      Promise.resolve(onValidate?.('SENT')).catch((err: unknown) => {
        console.warn('[PricingEngine] handleExportPdf: status update failed', err);
      });
    }
  };

  const handleExportDoc = () => {
    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = clientName.replace(/[^a-zA-Z0-9\u00C0-\u024F]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    a.download = `proposition_${safeName || 'client'}.doc`;
    a.click();
    URL.revokeObjectURL(url);
    // Mark the quote as SENT in Supabase. The parent handleValidate shows an
    // error toast on failure, so we just suppress any unexpected rejection here.
    if (quote?.supabaseId) {
      Promise.resolve(onValidate?.('SENT')).catch((err: unknown) => {
        console.warn('[PricingEngine] handleExportDoc: status update failed', err);
      });
    }
  };

  const handleIframeLoad = () => {
    try {
      const body = iframeRef.current?.contentDocument?.body;
      if (body) {
        // + 24 px to absorb any bottom margin/padding in the email template
        setIframeHeight(body.scrollHeight + 24);
      }
    } catch (err) {
      // contentDocument inaccessible (cross-origin fallback): keep the default 600 px height
      console.debug('[ProposalEmailPreviewModal] iframe height auto-size skipped:', err);
    }
  };

  const handleSendEmail = async () => {
    if (!localEmail.trim()) {
      toast.error("Veuillez renseigner l'adresse email du client avant d'envoyer.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(localEmail.trim())) {
      toast.error("L'adresse email renseignée n'est pas valide.");
      return;
    }
    // If the email was entered manually (differs from the original prop), save it
    if (localEmail.trim() !== clientEmail && quote?.supabaseId) {
      setSavingEmail(true);
      try {
        await supabase
          .from('quotes')
          .update({ contact_email: localEmail.trim() })
          .eq('id', quote.supabaseId);
      } catch {
        // Non-blocking — proceed with send regardless
      } finally {
        setSavingEmail(false);
      }
    }
    setSending(true);
    const result = await sendEmail({
      to: localEmail.trim(),
      toName: clientName,
      subject: `Proposition tarifaire — ${clientName}`,
      htmlContent,
    });
    setSending(false);
    if (result.success) {
      toast.success(result.demo
        ? 'Email simulé (mode démo) ✓'
        : `Email envoyé à ${localEmail.trim()} ✓`);
      onValidate?.('SENT');
      onClose();
    } else {
      toast.error(`Erreur d'envoi : ${result.error}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full max-h-[92vh] flex flex-col p-0 overflow-hidden gap-0 [&>button]:hidden">

        {/* ── Header — style cohérent avec la page ── */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 bg-white border-b border-slate-100">
          <DialogHeader className="flex-row items-center gap-3 space-y-0">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-slate-900 text-sm font-semibold leading-snug">
                Prévisualisation de la proposition
              </DialogTitle>
              <p className="text-xs text-slate-400 mt-0.5">
                {quotesCount} proposition{quotesCount > 1 ? 's' : ''} · {clientName}
              </p>
            </div>
          </DialogHeader>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Métadonnées email — barre compacte ── */}
        <div className="flex-shrink-0 px-6 py-2.5 bg-slate-50 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-600">
            <span>
              <span className="text-slate-400 font-medium mr-1">De :</span>
              {senderName} &lt;{senderDisplay}&gt;
              {emailConfig.isDemo && (
                <span className="ml-1.5 bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded text-[10px] font-medium">démo</span>
              )}
            </span>
            <span>
              <span className="text-slate-400 font-medium mr-1">À :</span>
              {clientName}{localEmail ? ` <${localEmail}>` : ''}
            </span>
            <span>
              <span className="text-slate-400 font-medium mr-1">Objet :</span>
              Proposition tarifaire — {clientName}
            </span>
          </div>
          {/* Single consolidated email input — shown when email is missing */}
          {!localEmail && (
            <div className="mt-2 flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              <input
                type="email"
                value={localEmail}
                onChange={e => setLocalEmail(e.target.value)}
                placeholder="Saisir l'email du client avant d'envoyer…"
                className="flex-1 h-7 px-2.5 border border-amber-300 bg-white rounded-lg text-xs outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 transition-all"
                aria-label="Email du client (requis pour l'envoi)"
              />
              <span className="text-amber-600 text-[10px] font-medium whitespace-nowrap">⚠ Email manquant</span>
            </div>
          )}
        </div>

        {/* ── Corps — colonne unique scrollable ── */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50/60">

          {/* Cadre principal : email + récapitulatif dans un seul flux */}
          <div className="px-6 py-5 space-y-4">

            {/* Aperçu email */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs text-slate-500 font-medium">Aperçu de l'email envoyé au client</span>
              </div>
              <iframe
                ref={iframeRef}
                srcDoc={htmlContent}
                className="w-full block"
                style={{ border: 'none', height: `${iframeHeight}px` }}
                title="Aperçu de l'email"
                sandbox="allow-same-origin"
                onLoad={handleIframeLoad}
                scrolling="no"
              />
            </div>

            {/* Récapitulatif détaillé — dans le même cadre, flux organique */}
            {quote && <ProposalDetailSummary quote={quote} />}

          </div>
        </div>

        {/* ── Barre d'actions — style cohérent avec la page ── */}
        <div className="flex-shrink-0 px-6 py-4 bg-white border-t border-slate-100 flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-2 px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            Exporter PDF
          </button>
          <button
            onClick={handleExportDoc}
            className="flex items-center gap-2 px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Exporter DOC
          </button>
          {onValidate && (
            <button
              onClick={() => { onValidate('VALIDATED'); onClose(); }}
              className="flex items-center gap-2 px-3.5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-medium transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Valider le devis
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-3.5 py-2 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all font-medium"
          >
            Fermer
          </button>
          <button
            onClick={handleSendEmail}
            disabled={sending || savingEmail}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            {(sending || savingEmail) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
            {sending ? 'Envoi…' : savingEmail ? 'Sauvegarde…' : 'Envoyer par email'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Section 5 — Fees Discount ───────────────────────────────────────────────

function StepFeesDiscount({
  feesDiscountPct,
  onChange,
}: {
  feesDiscountPct: 0 | 10 | 15 | 20;
  onChange: (v: 0 | 10 | 15 | 20) => void;
}) {
  const { companyProfile, accounting, social, options } = usePricingStore();
  const result = calculateQuote(companyProfile, accounting, social, options);
  const totalMonthly = result.totalMonthlyHT;

  const DISCOUNT_OPTIONS: { value: 0 | 10 | 15 | 20; label: string }[] = [
    { value: 0,  label: 'Aucune remise' },
    { value: 10, label: '−10 %' },
    { value: 15, label: '−15 %' },
    { value: 20, label: '−20 %' },
  ];

  const fmt = (n: number) => n.toLocaleString('fr-FR') + ' €';
  const discountedMonthly = feesDiscountPct > 0
    ? Math.round(totalMonthly * (1 - feesDiscountPct / 100))
    : 0;

  return (
    <SectionCard
      icon={<Tag className="w-4 h-4" />}
      title="Remise commerciale sur honoraires"
      subtitle="Applicable aux honoraires récurrents uniquement — 20 % maximum"
    >
      <div className="flex flex-wrap gap-2">
        {DISCOUNT_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              feesDiscountPct === opt.value
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {feesDiscountPct > 0 && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <span>
            Remise {feesDiscountPct}% appliquée :&nbsp;
            <span className="line-through text-gray-400">{fmt(totalMonthly)}/mois</span>
            {' → '}
            <strong>{fmt(discountedMonthly)}/mois</strong>
            {' · '}
            <strong>{fmt(discountedMonthly * 12)}/an</strong>
          </span>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function PricingSidebar({
  onGenerate,
  generating,
  setupDiscountPct,
  onSetupDiscountChange,
}: {
  onGenerate: () => void;
  generating: boolean;
  setupDiscountPct: 0 | 10 | 20 | 50 | 75 | 100;
  onSetupDiscountChange: (v: 0 | 10 | 20 | 50 | 75 | 100) => void;
}) {
  const { companyProfile, accounting, social, options } = usePricingStore();
  const result = calculateQuote(companyProfile, accounting, social, options);

  const fmt = (n: number) => n.toLocaleString('fr-FR') + ' €';

  const totalSetup = result.setupFees + result.socialSetupFees;

  // Build a readable options label
  const optionLabels: string[] = [];
  if (accounting.bilanCompris) optionLabels.push('RDV bilan compris');
  if (accounting.rdvAtterrissage) optionLabels.push('RDV atterrissage');
  if (options.ticketsSupport5an) optionLabels.push('5 tickets/an');
  if (options.whatsappDedie) optionLabels.push('WhatsApp');
  if (options.appelsPrioritaires) optionLabels.push('appels prioritaires');
  if (options.assembleGenerale) optionLabels.push('AG + dépôt comptes');

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-5">
        <Euro className="w-4 h-4 text-blue-600" />
        <h2 className="font-semibold text-gray-900 text-sm">Récapitulatif du devis</h2>
      </div>

      {/* Line items */}
      <div className="space-y-3 flex-1">
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">
            Mensuel récurrent
          </div>

          <div className="divide-y divide-gray-100">
            <SidebarLine
              label="Tenue comptable"
              detail={
                result.surDevis
                  ? 'Volume > 1 500 pièces/mois — sur devis'
                  : `${result.annualInvoiceHours.toFixed(1)} h/an × ${TAUX_HORAIRE_TENUE} €/h`
              }
              amount={result.monthlyAccountingPrice}
              surDevis={result.surDevis}
            />
            <SidebarLine
              label="Révision, clôture, bilan & liasse fiscale"
              detail={
                result.revisionCABonus > 0
                  ? `${result.closureAdjustedHours.toFixed(1)} h/an (base ${result.revisionBaseHours.toFixed(1)} h + CA ${result.revisionCABonus.toFixed(1)} h) × ${TAUX_HORAIRE_REVISION} €/h`
                  : `${result.closureAdjustedHours.toFixed(1)} h/an × ${TAUX_HORAIRE_REVISION} €/h`
              }
              amount={result.monthlyClosurePrice}
            />
            <SidebarLine
              label="Gestion sociale"
              detail={
                social.bulletinsPerMonth > 0
                  ? `${social.bulletinsPerMonth} bulletins × ${BULLETIN_RATE} € + ${DSN_MONTHLY_FEE} € DSN`
                  : 'Aucune gestion sociale'
              }
              amount={result.monthlySocialPrice}
            />
            {result.monthlyOptionsPrice > 0 && (
              <SidebarLine
                label="Options & services"
                detail={optionLabels.join(', ')}
                amount={result.monthlyOptionsPrice}
              />
            )}
          </div>
        </div>

        {/* Total monthly */}
        {result.surDevis ? (
          <div className="rounded-xl border border-orange-300 bg-orange-50 px-4 py-4 text-center">
            <p className="text-xs text-orange-600 font-medium uppercase tracking-wide mb-1">
              Total mensuel estimé HT
            </p>
            <p className="text-xl font-bold text-orange-700">Sur devis</p>
            <p className="text-xs text-orange-500 mt-1">
              Volume de pièces trop élevé — contactez-nous pour un tarif personnalisé
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4 text-center">
            <p className="text-xs text-blue-600 font-medium uppercase tracking-wide mb-1">
              Total mensuel estimé HT
            </p>
            <p className="text-3xl font-bold text-blue-700">
              {fmt(result.totalMonthlyHT)}
            </p>
            <p className="text-xs text-blue-500 mt-1">
              soit {fmt(result.totalMonthlyHT * 12)} HT / an
            </p>
          </div>
        )}

        {/* Setup fees */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex justify-between items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-800">Frais d'intégration initiaux</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Paramétrage, conformité LAB, KBIS, FEC
                {result.socialSetupFees > 0 && (
                  <> · Mise en place dossier social ({social.multiEtablissement ? 'multi' : 'mono'}-établissement)</>
                )}
                {' '}— une seule fois
              </p>
            </div>
            <p className="text-base font-bold text-amber-800 flex-shrink-0">
              {fmt(totalSetup)}
            </p>
          </div>
          {result.socialSetupFees > 0 && (
            <div className="mt-2 text-xs text-amber-700 divide-x divide-amber-200 flex">
              <span className="pr-2">Cabinet : {fmt(result.setupFees)}</span>
              <span className="pl-2">Social : {fmt(result.socialSetupFees)}</span>
            </div>
          )}
        </div>

        {/* Setup fee discount */}
        <div>
          <p className="text-sm font-semibold text-gray-600 mb-2">Remise sur frais d'intégration</p>
          <div className="flex gap-2 flex-wrap">
            {([0, 10, 20, 50, 75, 100] as const).map(pct => (
              <button
                key={pct}
                type="button"
                onClick={() => onSetupDiscountChange(pct)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                  setupDiscountPct === pct
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-gray-300 text-gray-600 hover:border-blue-400'
                }`}
              >
                {pct === 0 ? '0%' : `−${pct}%`}
              </button>
            ))}
          </div>
          {setupDiscountPct > 0 && (
            <div className="mt-2 text-sm text-amber-700 flex items-center gap-1.5">
              <span className="line-through text-gray-400">{fmt(totalSetup)}</span>
              <span>→</span>
              <span className="font-bold text-lg text-amber-800">{fmt(Math.round(totalSetup * (1 - setupDiscountPct / 100)))}</span>
            </div>
          )}
        </div>
      </div>

      {/* CTA */}
      <div className="mt-5">
        <button
          onClick={onGenerate}
          disabled={generating || !getEffectiveClientName(companyProfile).trim()}
          className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {generating ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Génération en cours…</>
          ) : (
            <><FileText className="w-4 h-4" />Valider et générer la proposition<ChevronRight className="w-3.5 h-3.5" /></>
          )}
        </button>
        {!getEffectiveClientName(companyProfile).trim() && (
          <p className="text-xs text-gray-400 text-center mt-2">
            Renseignez la raison sociale ou le contact pour continuer
          </p>
        )}
      </div>
    </div>
  );
}

function SidebarLine({ label, detail, amount, surDevis }: { label: string; detail: string; amount: number; surDevis?: boolean }) {
  return (
    <div className="px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className={`text-xs mt-0.5 ${surDevis ? 'text-orange-500 font-medium' : 'text-gray-500'}`}>{detail}</p>
      </div>
      <p className={`text-sm font-semibold flex-shrink-0 ${surDevis ? 'text-orange-600' : 'text-gray-900'}`}>
        {surDevis ? '— €' : `${amount.toLocaleString('fr-FR')} €`}
      </p>
    </div>
  );
}

// ─── Saved quotes list ────────────────────────────────────────────────────────

function SavedQuoteCard({
  quote,
  onReExport,
}: {
  quote: SavedQuote;
  onReExport: (quote: SavedQuote) => void;
}) {
  const { removeQuote, updateQuoteStatus: updateQuoteStatusStore } = usePricingStore();
  const [validating, setValidating] = useState(false);
  const [linkingProspect, setLinkingProspect] = useState(false);

  const handleValidate = async () => {
    if (!quote.supabaseId) {
      toast.error('Devis non encore persisté — veuillez patienter.');
      return;
    }
    setValidating(true);
    const result = await updateQuoteStatus(quote.supabaseId, 'VALIDATED');
    setValidating(false);
    if (result.success) {
      updateQuoteStatusStore(quote.id, 'VALIDATED');
      toast.success(`Devis validé pour la Lettre de Mission — ${quote.clientName}`);

      // CRM: convert the matching prospect to a client
      convertProspectToClient({
        siren: quote.siren,
        companyName: quote.raisonSociale || quote.clientName,
        contactEmail: quote.contactEmail,
        pricingData: quote as unknown as Record<string, unknown>,
      }).then(convResult => {
        if (convResult.success) {
          toast.success(
            convResult.alreadyExisted
              ? `Client "${quote.clientName}" déjà présent dans le CRM ✓`
              : `Prospect converti en client dans le CRM ✓`,
            { duration: 4000 }
          );
        }
        // Silently ignore if no prospect found — not all quotes come from CRM
      }).catch(() => undefined);
    } else {
      toast.error(`Erreur lors de la validation : ${result.error}`);
    }
  };

  const handleLinkToProspect = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLinkingProspect(true);
    const result = await saveProposalToProspect({
      siren: quote.siren || undefined,
      companyName: quote.raisonSociale || quote.clientName,
      contactEmail: quote.contactEmail || undefined,
      pricingData: quote as unknown as Record<string, unknown>,
    });
    setLinkingProspect(false);
    if (result.success) {
      toast.success(`Proposition liée au prospect CRM — ${quote.clientName} ✓`);
    } else {
      toast.error(`Erreur lors de la liaison : ${result.error}`);
    }
  };

  const handleDelete = async () => {
    if (quote.supabaseId) {
      const result = await deleteQuote(quote.supabaseId);
      if (!result.success) {
        toast.error(`Erreur lors de la suppression : ${result.error}`);
        return;
      }
    }
    removeQuote(quote.id);
    toast.success('Proposition supprimée');
  };

  const isValidated = quote.status === 'VALIDATED';
  const isSent = quote.status === 'SENT';

  const statusBadge = isValidated
    ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0 gap-1"><CheckCircle2 className="w-3 h-3" />Validé LDM</Badge>
    : isSent
      ? <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-0 gap-1"><Mail className="w-3 h-3" />Envoyé</Badge>
      : quote.supabaseId
        ? <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100 border-0">Brouillon</Badge>
        : null;

  const borderClasses = isValidated
    ? 'border-emerald-300 ring-1 ring-emerald-100'
    : isSent
      ? 'border-blue-300 ring-1 ring-blue-100'
      : 'border-gray-200';

  return (
    <AccordionItem
      value={quote.id}
      className={`rounded-xl border shadow-sm bg-white overflow-hidden ${borderClasses}`}
    >
      {/* ── Trigger (summary row) ── */}
      <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-gray-50/50 [&[data-state=open]]:bg-gray-50/50 transition-colors">
        <div className="flex items-center justify-between w-full gap-3 pr-2">
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 truncate">{quote.clientName}</h3>
              {statusBadge}
            </div>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {quote.legalForm} · {quote.revenueRange} · {quote.taxRegime} ·{' '}
              {quote.digitalization === 'numerique' ? '100% numérisé' : 'Papier'}
              {quote.bilanCompris && ' · RDV bilan compris'}
              {quote.rdvAtterrissage && ' · RDV atterrissage'}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right">
              <p className="text-sm font-bold text-blue-700">{quote.totalMonthlyHT.toLocaleString('fr-FR')} €<span className="text-xs font-normal text-gray-400">/mois</span></p>
              <p className="text-xs text-gray-400">{new Date(quote.createdAt).toLocaleDateString('fr-FR')}</p>
            </div>
          </div>
        </div>
      </AccordionTrigger>

      {/* ── Content (detail) ── */}
      <AccordionContent className="px-5 pb-5">
        {/* Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center mb-4 pt-2">
          <QuoteMetric label="Tenue compta" value={quote.monthlyAccountingPrice} />
          <QuoteMetric label="Clôture" value={quote.monthlyClosurePrice} />
          <QuoteMetric label="Social" value={quote.monthlySocialPrice} />
          <div className="bg-blue-50 rounded-lg p-2.5 border border-blue-100">
            <p className="text-xs text-blue-600 font-medium">Total / mois</p>
            <p className="text-base font-bold text-blue-700 mt-0.5">
              {quote.totalMonthlyHT.toLocaleString('fr-FR')} €
            </p>
          </div>
        </div>
        {quote.monthlyOptionsPrice > 0 && (
          <p className="text-xs text-gray-500 mb-3">
            Options incluses : +{quote.monthlyOptionsPrice} €/mois
          </p>
        )}

        {/* Options / services cochés */}
        {(quote.bilanCompris || quote.rdvAtterrissage || quote.options.ticketsSupport5an || quote.options.whatsappDedie || quote.options.appelsPrioritaires || quote.options.assembleGenerale || quote.bulletinsPerMonth > 0) && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <p className="text-xs font-semibold text-gray-500 mb-2">Services & options inclus</p>
            <div className="flex flex-wrap gap-1.5">
              {quote.bulletinsPerMonth > 0 && (
                <span className="px-2 py-0.5 bg-white border border-gray-200 rounded-full text-xs text-gray-600">{quote.bulletinsPerMonth} bulletin{quote.bulletinsPerMonth > 1 ? 's' : ''}/mois</span>
              )}
              {quote.bilanCompris && <span className="px-2 py-0.5 bg-white border border-gray-200 rounded-full text-xs text-gray-600">RDV bilan compris</span>}
              {quote.rdvAtterrissage && <span className="px-2 py-0.5 bg-white border border-gray-200 rounded-full text-xs text-gray-600">RDV atterrissage</span>}
              {quote.options.ticketsSupport5an && <span className="px-2 py-0.5 bg-white border border-gray-200 rounded-full text-xs text-gray-600">5 tickets support/an</span>}
              {quote.options.whatsappDedie && <span className="px-2 py-0.5 bg-white border border-gray-200 rounded-full text-xs text-gray-600">WhatsApp dédié</span>}
              {quote.options.appelsPrioritaires && <span className="px-2 py-0.5 bg-white border border-gray-200 rounded-full text-xs text-gray-600">Appels prioritaires</span>}
              {quote.options.assembleGenerale && <span className="px-2 py-0.5 bg-white border border-gray-200 rounded-full text-xs text-gray-600">Assemblée générale</span>}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
          {!isValidated && (
            <button
              onClick={handleValidate}
              disabled={validating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg text-xs font-medium transition-colors"
            >
              {validating ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
              Valider pour Lettre de Mission
            </button>
          )}

          <button
            onClick={handleLinkToProspect}
            disabled={linkingProspect}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 hover:bg-violet-100 disabled:bg-violet-50 text-violet-700 border border-violet-200 rounded-lg text-xs font-medium transition-colors"
            title="Sauvegarder cette proposition dans le CRM (table prospects)"
          >
            {linkingProspect ? <Loader2 className="w-3 h-3 animate-spin" /> : <Tag className="w-3 h-3" />}
            Lier au Prospect CRM
          </button>

          <button
            onClick={() => onReExport(quote)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
          >
            <Download className="w-3 h-3" />
            Télécharger / Ré-exporter
          </button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-xs font-medium transition-colors">
                <Trash2 className="w-3 h-3" />
                Supprimer
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer cette proposition ?</AlertDialogTitle>
                <AlertDialogDescription>
                  La proposition de <strong>{quote.clientName}</strong> ({quote.totalMonthlyHT.toLocaleString('fr-FR')} €/mois HT)
                  sera définitivement supprimée de la base de données. Cette action est irréversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Supprimer définitivement
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function QuoteMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-50 rounded-lg p-2.5">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-gray-800 mt-0.5">
        {value.toLocaleString('fr-FR')} €
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function PricingEngine() {
  const navigate = useNavigate();
  const {
    companyProfile, accounting, social, options,
    savedQuotes, saveQuote, updateQuoteStatus: updateQuoteStatusStore,
    resetPricingForm,
  } = usePricingStore();
  const [generating, setGenerating] = useState(false);
  const [setupDiscountPct, setSetupDiscountPct] = useState<0 | 10 | 20 | 50 | 75 | 100>(0);
  const [feesDiscountPct, setFeesDiscountPct] = useState<0 | 10 | 15 | 20>(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [latestQuote, setLatestQuote] = useState<SavedQuote | null>(null);

  // ── Load cabinet settings from Supabase (SettingsPage source of truth) ───────
  const [cabinetFromSettings, setCabinetFromSettings] = useState<CabinetInfo>(() => getCabinetInfo());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from('cabinet_settings')
          .select('cabinet_name,expert_name,logo_url')
          .eq('user_id', user.id)
          .maybeSingle();
        if (!cancelled && data) {
          // Merge: Supabase values (cabinet_name / expert_name) take priority over
          // any stale localStorage values for nom and expertNom.
          setCabinetFromSettings(prev => ({
            ...prev,
            nom: data.cabinet_name || prev.nom,
            expertNom: data.expert_name || prev.expertNom,
            cabinetLogoUrl: data.logo_url || prev.cabinetLogoUrl,
          }));
        }
      } catch (err) {
        console.warn('[PricingEngine] Failed to load cabinet settings from Supabase:', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const buildHtmlForQuotes = (quotes: SavedQuote[]) =>
    buildProposalEmailHtml({ quotes, setupDiscountPct, feesDiscountPct, cabinetInfo: cabinetFromSettings });

  const handleGenerate = () => {
    const effectiveName = getEffectiveClientName(companyProfile);
    if (!effectiveName.trim()) return;
    setGenerating(true);

    setTimeout(async () => {
      const result = calculateQuote(companyProfile, accounting, social, options);
      const totalSetup = result.setupFees + result.socialSetupFees;
      const newQuote: SavedQuote = {
        id: crypto.randomUUID(),
        status: 'DRAFT',
        clientName: effectiveName,
        siren: companyProfile.siren || undefined,
        contactEmail: companyProfile.clientEmail || undefined,
        raisonSociale: companyProfile.raisonSociale || undefined,
        adresse: companyProfile.adresse || undefined,
        codePostal: companyProfile.codePostal || undefined,
        ville: companyProfile.ville || undefined,
        activity: companyProfile.activity || undefined,
        legalForm: companyProfile.legalForm,
        revenueRange: companyProfile.revenueRange,
        taxRegime: companyProfile.taxRegime,
        digitalization: accounting.digitalization,
        bulletinsPerMonth: social.bulletinsPerMonth,
        multiEtablissement: social.multiEtablissement,
        bilanCompris: accounting.bilanCompris,
        rdvAtterrissage: accounting.rdvAtterrissage,
        options: { ...options },
        salesInvoices: accounting.salesInvoices,
        purchaseInvoices: accounting.purchaseInvoices,
        monthlyAccountingPrice: result.monthlyAccountingPrice,
        monthlyClosurePrice: result.monthlyClosurePrice,
        monthlySocialPrice: result.monthlySocialPrice,
        monthlyOptionsPrice: result.monthlyOptionsPrice,
        setupFees: totalSetup,
        totalMonthlyHT: result.totalMonthlyHT,
        createdAt: new Date().toISOString(),
      };
      saveQuote(newQuote);
      setLatestQuote(newQuote);

      // Persist to Supabase: create/update prospect + create DRAFT quote.
      // This does NOT insert into the `clients` table — client insertion only
      // happens when the user clicks "Valider pour Lettre de Mission".
      const contactName = [companyProfile.prenomContact, companyProfile.nomContact].filter(Boolean).join(' ') || undefined;
      const saveResult = await saveProspectAndQuote(
        {
          companyName: companyProfile.raisonSociale || effectiveName,
          siren: companyProfile.siren || null,
          address: companyProfile.adresse || null,
          city: companyProfile.ville || null,
          postalCode: companyProfile.codePostal || null,
          contactName: contactName || null,
          contactEmail: companyProfile.clientEmail || null,
          secteurActivite: companyProfile.activity || null,
          legalForm: companyProfile.legalForm || null,
        },
        {
          status: 'DRAFT',
          monthlyTotal: newQuote.totalMonthlyHT,
          setupFees: newQuote.setupFees,
          quoteData: newQuote as unknown as Record<string, unknown>,
        }
      );

      if (saveResult.success) {
        updateQuoteStatusStore(newQuote.id, 'DRAFT', saveResult.quoteId);
        // Sync the local latestQuote state with the supabaseId returned by
        // Supabase, so that handleValidate can read it without hitting the
        // "Identifiant Supabase manquant" guard.
        setLatestQuote(q => q ? { ...q, supabaseId: saveResult.quoteId, status: 'DRAFT' } : q);
        toast.success(`Proposition créée pour ${effectiveName} ✓`);
        resetPricingForm();
      } else {
        toast.error(`Erreur de sauvegarde : ${saveResult.error}`);
      }

      const allQuotes = [...savedQuotes, newQuote];
      const html = buildHtmlForQuotes(allQuotes);
      setPreviewHtml(html);
      setPreviewOpen(true);
      setGenerating(false);
    }, 800);
  };

  const handleValidate = async (status: 'SENT' | 'VALIDATED' | 'SIGNED' | 'PENDING_ONBOARDING') => {
    const quote = latestQuote;
    if (!quote) return;
    if (!quote.supabaseId) {
      toast.error('Identifiant Supabase manquant — impossible de valider.');
      return;
    }
    const result = await updateQuoteStatus(quote.supabaseId, status);
    if (result.success) {
      if (status === 'SENT') {
        // Quote delivered to client (email sent or PDF/DOC exported)
        updateQuoteStatusStore(quote.id, 'SENT');
        toast.success(`Devis marqué comme envoyé — ${quote.clientName} ✓`);
      } else if (status === 'VALIDATED') {
        // Manual validation — quote is ready for Lettre de Mission
        updateQuoteStatusStore(quote.id, 'VALIDATED');
        toast.success(`Devis validé pour la Lettre de Mission ✓`);
      } else if (status === 'SIGNED') {
        // LDM has been signed — ready for onboarding dossier creation
        updateQuoteStatusStore(quote.id, 'SIGNED');
        toast.success(`Devis marqué comme signé ✓`);
      } else {
        // PENDING_ONBOARDING — routed directly to onboarding module
        updateQuoteStatusStore(quote.id, 'PENDING_ONBOARDING');
        toast.success(`Devis transmis au module Onboarding ✓`);
      }

      // CRM: for VALIDATED and SIGNED, convert the matching prospect to a client
      if (status === 'VALIDATED' || status === 'SIGNED') {
        convertProspectToClient({
          siren: quote.siren,
          companyName: quote.raisonSociale || quote.clientName,
          contactEmail: quote.contactEmail,
          pricingData: quote as unknown as Record<string, unknown>,
        }).then(convResult => {
          if (convResult.success) {
            toast.success(
              convResult.alreadyExisted
                ? `Client "${quote.clientName}" déjà présent dans le CRM ✓`
                : `Prospect "${quote.clientName}" converti en client dans le CRM ✓`,
              { duration: 4500 }
            );
          }
          // Silently ignore if no prospect was found in CRM
        }).catch(() => undefined);
      }
    } else {
      toast.error(`Erreur lors de la validation : ${result.error}`);
    }
  };

  const handleReExport = (quote: SavedQuote) => {
    const html = buildHtmlForQuotes([quote]);
    setPreviewHtml(html);
    setLatestQuote(quote);
    setPreviewOpen(true);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au tableau de bord
        </button>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
              <Calculator className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Moteur de Tarification</h1>
              <p className="text-sm text-gray-500">
                Générez un devis en temps réel — les prix s'actualisent à chaque modification
              </p>
            </div>
          </div>
          <button
            onClick={resetPricingForm}
            className="flex items-center gap-2 px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-all"
            title="Vider le formulaire et recommencer une nouvelle simulation"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Nouvelle simulation / Effacer</span>
          </button>
        </div>
      </header>

      {/* Two-column body */}
      <div className="flex flex-1 min-h-0">

        {/* ── Left — Form (scrollable, ~70%) ── */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-5 pb-24 lg:pb-8">
          <StepCompanyProfile />
          <StepAccounting />
          <StepSocial />
          <StepJuridique />
          <StepOptions />
          <StepFeesDiscount feesDiscountPct={feesDiscountPct} onChange={setFeesDiscountPct} />

          {/* Saved quotes dashboard */}
          {savedQuotes.length > 0 && (
            <div>
              <h2 className="font-semibold text-gray-700 text-sm mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Tableau de bord des propositions ({savedQuotes.length})
              </h2>
              <ScrollArea className="max-h-[500px] pr-1">
                <Accordion type="single" collapsible className="space-y-3">
                  {savedQuotes.map(q => (
                    <SavedQuoteCard key={q.id} quote={q} onReExport={handleReExport} />
                  ))}
                </Accordion>
              </ScrollArea>
            </div>
          )}
        </main>

        {/* ── Right — Sticky sidebar (~30%) ── */}
        <aside className="hidden lg:block sticky top-0 h-screen overflow-y-auto w-80 xl:w-96 flex-shrink-0 bg-white border-l border-gray-200 p-6">
          <PricingSidebar onGenerate={handleGenerate} generating={generating} setupDiscountPct={setupDiscountPct} onSetupDiscountChange={setSetupDiscountPct} />
        </aside>
      </div>

      {/* Mobile sticky footer CTA (hidden on lg+) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
        <button
          onClick={handleGenerate}
          disabled={generating || !companyProfile.clientName.trim()}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50"
        >
          {generating
            ? <><Loader2 className="w-4 h-4 animate-spin" />Génération…</>
            : <><FileText className="w-4 h-4" />Générer la proposition — {SETUP_FEES.toLocaleString('fr-FR')} € HT/mois</>
          }
        </button>
      </div>

      <ProposalEmailPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        clientName={latestQuote?.clientName ?? companyProfile.clientName}
        clientEmail={latestQuote?.contactEmail || companyProfile.clientEmail}
        htmlContent={previewHtml}
        quotesCount={savedQuotes.length}
        quote={latestQuote ?? undefined}
        onValidate={handleValidate}
        cabinetInfo={cabinetFromSettings}
      />
    </div>
  );
}
