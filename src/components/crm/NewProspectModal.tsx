import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Building2, User, Mail, Phone, Loader2, Hash, MapPin,
  CheckCircle2, AlertCircle, ChevronDown, Briefcase, Coins,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../../app/components/ui/dialog';
import { Input } from '../../app/components/ui/input';
import { Button } from '../../app/components/ui/button';
import { Label } from '../../app/components/ui/label';
import { useProspectStore } from '../../app/store/useProspectStore';
import {
  fetchBySIREN,
  searchCompaniesByName,
  type CompanySuggestion,
  type SirenData,
} from '../../app/services/sirenApi';

interface NewProspectModalProps {
  open: boolean;
  onClose: () => void;
}

interface FormState {
  company_name: string;
  siren: string;
  siret: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  postal_code: string;
  city: string;
  legal_form: string;
  naf_code: string;
  libelle_naf: string;
  secteur_activite: string;
  capital_social: string;
  effectif: string;
  date_creation: string;
  categorie_entreprise: string;
  departement: string;
}

const EMPTY_FORM: FormState = {
  company_name: '',
  siren: '',
  siret: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  address: '',
  postal_code: '',
  city: '',
  legal_form: '',
  naf_code: '',
  libelle_naf: '',
  secteur_activite: '',
  capital_social: '',
  effectif: '',
  date_creation: '',
  categorie_entreprise: '',
  departement: '',
};

/**
 * Apply SirenData (full lookup result) or CompanySuggestion (autocomplete) onto the form state.
 * SirenData is distinguished by the presence of `etatAdministratif`, which is absent from
 * CompanySuggestion.
 */
function applyApiData(prev: FormState, data: SirenData | CompanySuggestion): FormState {
  const isFullData = 'etatAdministratif' in data;
  const full = data as SirenData;

  return {
    ...prev,
    company_name:         data.nomComplet || prev.company_name,
    siren:                data.siren || prev.siren,
    siret:                (isFullData ? full.siret : '') || prev.siret,
    address:              data.adresse || prev.address,
    postal_code:          data.codePostal || prev.postal_code,
    city:                 data.ville || prev.city,
    legal_form:           data.formeJuridique || prev.legal_form,
    naf_code:             data.codeNAF || prev.naf_code,
    libelle_naf:          data.libelleNAF || prev.libelle_naf,
    // secteur_activite: use the NAF libellé as a human-readable sector label
    secteur_activite:     data.libelleNAF || prev.secteur_activite,
    capital_social:       (isFullData ? full.capitalSocial : '') || prev.capital_social,
    effectif:             (isFullData ? full.effectif : '') || prev.effectif,
    date_creation:        (isFullData ? full.dateCreation : '') || prev.date_creation,
    categorie_entreprise: (isFullData ? full.categorieEntreprise : '') || prev.categorie_entreprise,
    contact_name:         isFullData && full.nomDirigeant
      ? [full.prenomDirigeant, full.nomDirigeant].filter(Boolean).join(' ')
      : prev.contact_name,
  };
}

/** Build a dirigeant_principal JSONB object from SirenData */
function buildDirigeantPrincipal(
  data: SirenData
): Record<string, unknown> | null {
  if (!data.nomDirigeant) return null;
  return {
    nom:    data.nomDirigeant,
    prenom: data.prenomDirigeant ?? '',
  };
}

export function NewProspectModal({ open, onClose }: NewProspectModalProps) {
  const { addProspect } = useProspectStore();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);

  // Keep a ref to the full SirenData so we can build dirigeant_principal on submit
  const sirenDataRef = useRef<SirenData | null>(null);

  // SIREN lookup state
  const [sirenLookupState, setSirenLookupState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const sirenDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Company name autocomplete state
  const [suggestions, setSuggestions] = useState<CompanySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const nameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        suggestionsRef.current &&
        e.target instanceof Node &&
        !suggestionsRef.current.contains(e.target)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClose = () => {
    setForm(EMPTY_FORM);
    setSuggestions([]);
    setShowSuggestions(false);
    setSirenLookupState('idle');
    sirenDataRef.current = null;
    onClose();
  };

  /** Triggered when SIREN field changes — debounced 9-digit lookup */
  const handleSirenChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 9);
    setForm(prev => ({ ...prev, siren: raw }));
    setSirenLookupState('idle');
    sirenDataRef.current = null;

    if (sirenDebounceRef.current) clearTimeout(sirenDebounceRef.current);
    if (raw.length !== 9) return;

    sirenDebounceRef.current = setTimeout(async () => {
      setSirenLookupState('loading');
      try {
        const result = await fetchBySIREN(raw);
        if (result.success) {
          sirenDataRef.current = result.data;
          setForm(prev => applyApiData(prev, result.data));
          setSirenLookupState('ok');
          toast.success('Informations récupérées depuis l\'API SIREN', { duration: 2500 });
        } else {
          setSirenLookupState('error');
        }
      } catch {
        setSirenLookupState('error');
      }
    }, 500);
  }, []);

  /** Triggered when company name field changes — debounced autocomplete */
  const handleCompanyNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setForm(prev => ({ ...prev, company_name: value }));
    setSirenLookupState('idle');
    sirenDataRef.current = null;

    if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);
    if (value.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    nameDebounceRef.current = setTimeout(async () => {
      setSuggestionsLoading(true);
      try {
        const results = await searchCompaniesByName(value.trim());
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setSuggestionsLoading(false);
      }
    }, 350);
  }, []);

  /** When user selects a suggestion from autocomplete */
  const handleSelectSuggestion = useCallback((sug: CompanySuggestion) => {
    setForm(prev => applyApiData(prev, sug));
    setSuggestions([]);
    setShowSuggestions(false);
    setSirenLookupState('ok');
    toast.success('Informations récupérées depuis l\'API SIREN', { duration: 2500 });
  }, []);

  const handleChange = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company_name.trim()) {
      toast.error('La raison sociale / nom du projet est obligatoire');
      return;
    }
    const sirenTrimmed = form.siren.trim();
    if (sirenTrimmed && !/^\d{9}$/.test(sirenTrimmed)) {
      toast.error('Le SIREN doit contenir exactement 9 chiffres');
      return;
    }
    const emailTrimmed = form.contact_email.trim();
    if (emailTrimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      toast.error('Veuillez saisir une adresse email valide');
      return;
    }
    setLoading(true);
    try {
      const result = await addProspect({
        company_name:            form.company_name.trim(),
        siren:                   sirenTrimmed || null,
        siret:                   form.siret.trim() || null,
        contact_name:            form.contact_name.trim() || null,
        contact_email:           emailTrimmed || null,
        contact_phone:           form.contact_phone.trim() || null,
        address:                 form.address.trim() || null,
        postal_code:             form.postal_code.trim() || null,
        city:                    form.city.trim() || null,
        legal_form:              form.legal_form.trim() || null,
        // forme_juridique mirrors legal_form — the DB has both columns for legacy reasons
        forme_juridique:         form.legal_form.trim() || null,
        naf_code:                form.naf_code.trim() || null,
        libelle_naf:             form.libelle_naf.trim() || null,
        secteur_activite:        form.secteur_activite.trim() || null,
        capital_social:          form.capital_social.trim() || null,
        effectif:                form.effectif.trim() || null,
        date_creation:           form.date_creation.trim() || null,
        categorie_entreprise:    form.categorie_entreprise.trim() || null,
        departement:             form.departement.trim() || null,
        dirigeant_principal:     sirenDataRef.current
          ? buildDirigeantPrincipal(sirenDataRef.current)
          : null,
        status:                  'a-contacter',
        kanban_column:           'a-contacter',
        source:                  'manuel',
      });
      if (result.success) {
        toast.success('Prospect créé avec succès');
        handleClose();
      } else {
        toast.error(result.error ?? 'Impossible de créer le prospect. Veuillez vérifier votre connexion et réessayer.');
      }
    } finally {
      setLoading(false);
    }
  };

  const apiEnriched = sirenLookupState === 'ok';

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau prospect</DialogTitle>
        </DialogHeader>

        {/* noValidate prevents browser-native validation from blocking submission */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4 mt-2">

          {/* Raison sociale with autocomplete */}
          <div className="space-y-1.5">
            <Label htmlFor="np-company">
              Raison sociale / Nom du projet <span className="text-red-500">*</span>
            </Label>
            <div className="relative" ref={suggestionsRef}>
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
              <Input
                id="np-company"
                placeholder="Ex : SARL Dupont, Projet Alpha… (3 car. min pour suggestions)"
                value={form.company_name}
                onChange={handleCompanyNameChange}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                className="pl-9 pr-8"
                autoFocus
                autoComplete="off"
              />
              {suggestionsLoading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
              )}
              {!suggestionsLoading && suggestions.length > 0 && (
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              )}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-56 overflow-y-auto">
                  {suggestions.map((sug) => (
                    <button
                      key={sug.siren}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 focus:bg-blue-50 outline-none border-b border-gray-100 last:border-0"
                      onMouseDown={(e) => {
                        // Prevent input blur before selection is registered
                        e.preventDefault();
                        handleSelectSuggestion(sug);
                      }}
                      onClick={() => handleSelectSuggestion(sug)}
                    >
                      <div className="font-medium text-sm text-gray-900 truncate">{sug.nomComplet}</div>
                      <div className="text-xs text-gray-500 flex gap-2 mt-0.5">
                        <span>{sug.siren}</span>
                        {sug.ville && <span>· {sug.ville}</span>}
                        {sug.formeJuridique && <span>· {sug.formeJuridique}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SIREN with real-time lookup */}
          <div className="space-y-1.5">
            <Label htmlFor="np-siren">
              SIREN{' '}
              <span className="text-gray-400 font-normal text-xs">(optionnel — récupération automatique des infos)</span>
            </Label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="np-siren"
                placeholder="Ex : 123456789"
                value={form.siren}
                onChange={handleSirenChange}
                className={`pl-9 pr-9 ${sirenLookupState === 'error' ? 'border-orange-400' : ''}`}
                maxLength={9}
                inputMode="numeric"
              />
              {sirenLookupState === 'loading' && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 animate-spin" />
              )}
              {sirenLookupState === 'ok' && (
                <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
              )}
              {sirenLookupState === 'error' && (
                <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400" />
              )}
            </div>
            {sirenLookupState === 'error' && (
              <p className="text-xs text-orange-500">SIREN non trouvé — vous pouvez saisir les informations manuellement.</p>
            )}
          </div>

          {/* API enrichment badge */}
          {apiEnriched && (
            <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              Informations pré-remplies depuis l'API SIREN — vous pouvez les modifier si besoin.
            </div>
          )}

          {/* Address fields — shown once enriched or always for manual entry */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-3 space-y-1.5">
              <Label htmlFor="np-address">Adresse</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="np-address"
                  placeholder="Ex : 12 rue de la Paix"
                  value={form.address}
                  onChange={handleChange('address')}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-postal">Code postal</Label>
              <Input
                id="np-postal"
                placeholder="75001"
                value={form.postal_code}
                onChange={handleChange('postal_code')}
                inputMode="numeric"
                maxLength={5}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="np-city">Ville</Label>
              <Input
                id="np-city"
                placeholder="Paris"
                value={form.city}
                onChange={handleChange('city')}
              />
            </div>
          </div>

          {/* Legal form */}
          <div className="space-y-1.5">
            <Label htmlFor="np-legal">Forme juridique</Label>
            <Input
              id="np-legal"
              placeholder="Ex : SAS, SARL, EURL…"
              value={form.legal_form}
              onChange={handleChange('legal_form')}
            />
          </div>

          {/* NAF code + libellé */}
          <div className="grid grid-cols-5 gap-2">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="np-naf">Code NAF / APE</Label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="np-naf"
                  placeholder="Ex : 6920Z"
                  value={form.naf_code}
                  onChange={handleChange('naf_code')}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="col-span-3 space-y-1.5">
              <Label htmlFor="np-naf-libelle">Activité (libellé NAF)</Label>
              <Input
                id="np-naf-libelle"
                placeholder="Ex : Activités comptables"
                value={form.libelle_naf}
                onChange={handleChange('libelle_naf')}
                className="bg-gray-50"
              />
            </div>
          </div>

          {/* Capital social + Effectif */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="np-capital">Capital social</Label>
              <div className="relative">
                <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="np-capital"
                  placeholder="Ex : 10 000 €"
                  value={form.capital_social}
                  onChange={handleChange('capital_social')}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-effectif">Effectif</Label>
              <Input
                id="np-effectif"
                placeholder="Ex : 1 à 2"
                value={form.effectif}
                onChange={handleChange('effectif')}
              />
            </div>
          </div>

          {/* Contact info */}
          <div className="space-y-1.5">
            <Label htmlFor="np-contact">Nom du dirigeant</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="np-contact"
                placeholder="Ex : Jean Dupont"
                value={form.contact_name}
                onChange={handleChange('contact_name')}
                className="pl-9"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="np-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="np-email"
                  placeholder="contact@exemple.fr"
                  value={form.contact_email}
                  onChange={handleChange('contact_email')}
                  className="pl-9"
                  inputMode="email"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-phone">Téléphone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="np-phone"
                  placeholder="06 00 00 00 00"
                  value={form.contact_phone}
                  onChange={handleChange('contact_phone')}
                  className="pl-9"
                  inputMode="tel"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Création…
                </>
              ) : (
                'Créer le prospect'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
