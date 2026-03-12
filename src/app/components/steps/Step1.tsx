import { useState, useEffect, useRef } from 'react';
import { ClipboardList, Building2, Sparkles, Info, CheckCircle2, XCircle } from 'lucide-react';
import { useOnboarding } from '../../context/OnboardingContext';
import type { FormeJuridiqueCreation } from '../../context/OnboardingContext';
import { StepShell } from '../StepShell';
import { fetchBySIREN } from '../../services/sirenApi';
import { validateSIREN, validateEmail } from '../../utils/validators';
import { toast } from 'sonner';

export function Step1() {
  const { clientData, updateClientData, goNext } = useOnboarding();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sirenVerifying, setSirenVerifying] = useState(false);
  const [sirenVerified, setSirenVerified] = useState(false);
  const [sirenValid, setSirenValid] = useState<boolean | null>(null);

  const isCreation = clientData.missionType === 'creation';
  const cleanSiren = clientData.siren.replace(/\s/g, '');

  // Track if we've already verified for the current SIREN to prevent double-fetch
  const lastVerifiedSiren = useRef('');
  // Debounce timer for SIREN API lookup
  const sirenDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Real-time Luhn validation — uniquement pour les reprises (pas de SIREN en création)
  useEffect(() => {
    if (isCreation) return;

    if (sirenDebounceRef.current) clearTimeout(sirenDebounceRef.current);

    if (cleanSiren.length === 9) {
      const isValid = validateSIREN(cleanSiren);
      setSirenValid(isValid);
      if (isValid && !sirenVerified && lastVerifiedSiren.current !== cleanSiren) {
        sirenDebounceRef.current = setTimeout(() => {
          verifySiren(cleanSiren);
        }, 500);
      }
    } else {
      setSirenValid(null);
      setSirenVerified(false);
    }

    return () => {
      if (sirenDebounceRef.current) clearTimeout(sirenDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanSiren, isCreation]);

  const verifySiren = async (siren: string) => {
    if (lastVerifiedSiren.current === siren) return;
    setSirenVerifying(true);
    lastVerifiedSiren.current = siren;
    const result = await fetchBySIREN(siren);

    if (result.success) {
      const d = result.data;
      updateClientData({
        siret: d.siret,
        codeNAF: d.codeNAF,
        libelleNAF: d.libelleNAF,
        capital: d.capitalSocial,
        adresse: d.adresse,
        codePostal: d.codePostal,
        ville: d.ville,
        raisonSociale: d.nomComplet,
        formeJuridique: d.formeJuridique,
        dateCreation: d.dateCreation,
        effectif: d.effectif,
      });
      setSirenVerified(true);
      toast.success(`SIREN vérifié — ${d.nomComplet}`);
    } else {
      const lastName = (clientData.nom.split(' ').pop() ?? 'DUPONT').toUpperCase();
      updateClientData({
        siret: siren + '00017',
        codeNAF: '6920Z',
        libelleNAF: 'Activités comptables',
        capital: '10 000 €',
        adresse: '47 Rue des Comptables',
        codePostal: '75008',
        ville: 'Paris',
        raisonSociale: `${lastName} & ASSOCIÉS`,
        formeJuridique: 'Société à responsabilité limitée (SARL)',
        dateCreation: '2018-03-15',
        effectif: '10 à 19',
      });
      setSirenVerified(true);
      toast.info('Données de démonstration utilisées (API temporairement indisponible)');
    }
    setSirenVerifying(false);
  };

  const validate = () => {
    const e: Record<string, string> = {};

    // SIREN requis uniquement pour une reprise de dossier
    // En création, l'entreprise n'est pas encore immatriculée — pas de SIREN
    if (!isCreation) {
      if (!cleanSiren || !/^\d{9}$/.test(cleanSiren)) {
        e.siren = 'Le SIREN doit contenir exactement 9 chiffres';
      } else if (!validateSIREN(cleanSiren)) {
        e.siren = 'SIREN invalide (vérification Luhn échouée)';
      }
    }

    if (!clientData.nom.trim()) e.nom = 'Le nom du contact est requis';
    if (!clientData.email || !validateEmail(clientData.email)) {
      e.email = 'Une adresse email valide est requise';
    }
    if (!clientData.telephone || !/^(\+33|0)\d{9}$/.test(clientData.telephone.replace(/\s/g, ''))) {
      e.telephone = 'Format invalide — ex : 06 12 34 56 78';
    }
    if (!clientData.missionType) e.missionType = 'Veuillez sélectionner un type de mission';
    if (clientData.missionType === 'reprise' && !clientData.confrereEmail) {
      e.confrereEmail = "L'email du confrère est requis pour une reprise";
    }
    if (clientData.missionType === 'reprise' && clientData.confrereEmail &&
        !validateEmail(clientData.confrereEmail)) {
      e.confrereEmail = 'Email du confrère invalide';
    }
    if (clientData.missionType === 'creation') {
      if (!clientData.formeJuridiqueCreation) {
        e.formeJuridiqueCreation = 'La forme juridique est requise pour une création';
      }
      if (!clientData.denominationCreation.trim()) {
        e.denominationCreation = 'La dénomination sociale est requise pour une création';
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const fillDemo = () => {
    updateClientData({
      siren: '732829320',
      nom: 'Martin Dupont',
      email: 'martin.dupont@sarl-dupont.fr',
      telephone: '0612345678',
      missionType: 'reprise',
      confrereEmail: 'cabinet.ancien@expert-comptable.fr',
    });
    setErrors({});
    setSirenVerified(false);
  };

  // En création : pas de SIREN (l'entreprise n'existe pas encore)
  const fillDemoCreation = () => {
    updateClientData({
      siren: '',
      nom: 'Sophie Martin',
      email: 'sophie.martin@startup-martin.fr',
      telephone: '0698765432',
      missionType: 'creation',
      confrereEmail: '',
      formeJuridiqueCreation: 'SAS',
      capitalCreation: '5000',
      activiteCreation: 'Conseil en stratégie digitale',
      denominationCreation: 'MARTIN DIGITAL SAS',
    });
    setErrors({});
    setSirenVerified(false);
  };

  const field = (
    label: string,
    key: keyof typeof clientData,
    placeholder: string,
    hint?: string,
    type = 'text'
  ) => (
    <div>
      <label className="block text-sm text-gray-700 mb-1.5">{label} <span className="text-red-400">*</span></label>
      <input
        type={type}
        placeholder={placeholder}
        value={clientData[key] as string}
        onChange={e => {
          updateClientData({ [key]: e.target.value } as any);
          if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
        }}
        className={`w-full px-3.5 py-2.5 border rounded-lg text-sm outline-none transition-all bg-white ${
          errors[key] ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100' :
          'border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-50'
        }`}
      />
      {hint && !errors[key] && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
      {errors[key] && <p className="text-xs text-red-500 mt-1">{errors[key]}</p>}
    </div>
  );

  return (
    <StepShell
      step={1}
      title="Formulaire de Collecte Initial"
      subtitle="Informations de base du client et type de mission."
      type="manuel"
      icon={<ClipboardList className="w-5 h-5 text-white" />}
      onNext={() => validate() && goNext()}
      nextLabel="Étape suivante →"
    >
      {/* Demo buttons */}
      <div className="flex gap-2 mb-5 justify-end flex-wrap">
        <button onClick={fillDemoCreation}
          className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-all">
          <Sparkles className="w-3.5 h-3.5" /> Démo Création
        </button>
        <button onClick={fillDemo}
          className="flex items-center gap-1.5 text-xs text-violet-600 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-all">
          <Sparkles className="w-3.5 h-3.5" /> Démo Reprise
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* 
          Champ SIREN : affiché UNIQUEMENT pour une reprise de dossier.
          En création d'entreprise, la société n'est pas encore immatriculée
          — le SIREN sera attribué après les formalités au guichet unique INPI.
        */}
        {!isCreation && (
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm text-gray-700 mb-1.5">Numéro SIREN <span className="text-red-400">*</span></label>
            <div className="relative">
              <input
                type="text"
                placeholder="732 829 320"
                value={clientData.siren}
                onChange={e => {
                  const val = e.target.value.replace(/[^\d\s]/g, '');
                  updateClientData({ siren: val });
                  setSirenVerified(false);
                  if (errors.siren) setErrors(prev => { const n = { ...prev }; delete n.siren; return n; });
                }}
                maxLength={11}
                className={`w-full px-3.5 py-2.5 border rounded-lg text-sm outline-none transition-all bg-white pr-10 ${
                  errors.siren ? 'border-red-300' :
                  sirenValid === true ? 'border-emerald-400 ring-2 ring-emerald-50' :
                  sirenValid === false ? 'border-red-300 ring-2 ring-red-50' :
                  'border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-50'
                }`}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {sirenVerifying && <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />}
                {!sirenVerifying && sirenVerified && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                {!sirenVerifying && !sirenVerified && sirenValid === false && <XCircle className="w-4 h-4 text-red-400" />}
              </div>
            </div>
            {!errors.siren && (
              <p className="text-xs mt-1">
                {sirenVerifying ? (
                  <span className="text-blue-500">Vérification SIREN en cours...</span>
                ) : sirenVerified ? (
                  <span className="text-emerald-600">✓ SIREN vérifié — {clientData.raisonSociale}</span>
                ) : sirenValid === false ? (
                  <span className="text-red-500">SIREN invalide (algorithme de Luhn)</span>
                ) : (
                  <span className="text-gray-400">9 chiffres — Vérification automatique via API gouvernementale</span>
                )}
              </p>
            )}
            {errors.siren && <p className="text-xs text-red-500 mt-1">{errors.siren}</p>}
          </div>
        )}

        <div className={`col-span-2 ${!isCreation ? 'sm:col-span-1' : 'sm:col-span-2'}`}>
          {field('Nom du contact principal', 'nom', 'Ex : Martin Dupont')}
        </div>
        <div className="col-span-2 sm:col-span-1">
          {field('Adresse email', 'email', 'contact@entreprise.fr', undefined, 'email')}
        </div>
        <div className="col-span-2 sm:col-span-1">
          {field('Téléphone', 'telephone', '06 12 34 56 78')}
        </div>
      </div>

      {/* Mission type */}
      <div className="mt-5">
        <label className="block text-sm text-gray-700 mb-3">Type de mission <span className="text-red-400">*</span></label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 'creation', label: "Création d'entreprise", desc: 'Nouveau client — pas de lettre confraternelle', icon: '🏗️' },
            { value: 'reprise', label: 'Reprise de dossier', desc: 'Client existant — lettre confraternelle + PDF requis', icon: '🔄' },
          ].map(opt => (
            <button key={opt.value}
              onClick={() => {
                updateClientData({ missionType: opt.value as 'creation' | 'reprise', confrereEmail: '', siren: '' });
                setSirenVerified(false);
                setSirenValid(null);
                if (errors.missionType) setErrors(prev => { const n = { ...prev }; delete n.missionType; delete n.siren; return n; });
              }}
              className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                clientData.missionType === opt.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="text-xl">{opt.icon}</span>
              <div className="flex-1">
                <p className={`text-sm font-medium ${clientData.missionType === opt.value ? 'text-blue-700' : 'text-gray-800'}`}>
                  {opt.label}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
              </div>
              {clientData.missionType === opt.value && (
                <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
        {errors.missionType && <p className="text-xs text-red-500 mt-2">{errors.missionType}</p>}
      </div>

      {/* Email confrère — uniquement pour reprise */}
      {clientData.missionType === 'reprise' && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm font-medium text-amber-800">Reprise de dossier — Information requise</p>
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1.5">
              Email de l'ancien expert-comptable (confrère) <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              placeholder="confrere@cabinet-precedent.fr"
              value={clientData.confrereEmail}
              onChange={e => {
                updateClientData({ confrereEmail: e.target.value });
                if (errors.confrereEmail) setErrors(prev => { const n = { ...prev }; delete n.confrereEmail; return n; });
              }}
              className={`w-full px-3.5 py-2.5 border rounded-lg text-sm outline-none transition-all bg-white ${
                errors.confrereEmail ? 'border-red-300' : 'border-amber-200 focus:border-amber-400'
              }`}
            />
            {errors.confrereEmail && <p className="text-xs text-red-500 mt-1">{errors.confrereEmail}</p>}
            <p className="text-xs text-amber-600 mt-1">
              Cet email sera utilisé à l'étape 5 pour l'envoi automatique de la lettre confraternelle PDF.
            </p>
          </div>
        </div>
      )}

      {/* Champs création */}
      {clientData.missionType === 'creation' && (
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <p className="text-sm font-medium text-blue-800">Création d'entreprise — Informations complémentaires</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-700 mb-1.5">Dénomination sociale <span className="text-red-400">*</span></label>
              <input
                type="text"
                placeholder="Ex : MARTIN DIGITAL SAS"
                value={clientData.denominationCreation}
                onChange={e => {
                  updateClientData({ denominationCreation: e.target.value });
                  if (errors.denominationCreation) setErrors(prev => { const n = { ...prev }; delete n.denominationCreation; return n; });
                }}
                className={`w-full px-3.5 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-50 bg-white ${
                  errors.denominationCreation ? 'border-red-300 focus:border-red-400' : 'border-blue-200 focus:border-blue-400'
                }`}
              />
              {errors.denominationCreation && <p className="text-xs text-red-500 mt-1">{errors.denominationCreation}</p>}
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1.5">Forme juridique <span className="text-red-400">*</span></label>
              <select
                value={clientData.formeJuridiqueCreation}
                onChange={e => {
                  updateClientData({ formeJuridiqueCreation: e.target.value as FormeJuridiqueCreation });
                  if (errors.formeJuridiqueCreation) setErrors(prev => { const n = { ...prev }; delete n.formeJuridiqueCreation; return n; });
                }}
                className={`w-full px-3.5 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-50 bg-white ${
                  errors.formeJuridiqueCreation ? 'border-red-300 focus:border-red-400' : 'border-blue-200 focus:border-blue-400'
                }`}
              >
                <option value="">Sélectionner...</option>
                <option value="SAS">SAS</option>
                <option value="SASU">SASU</option>
                <option value="SARL">SARL</option>
                <option value="EURL">EURL</option>
                <option value="SCI">SCI</option>
                <option value="SA">SA</option>
              </select>
              {errors.formeJuridiqueCreation && <p className="text-xs text-red-500 mt-1">{errors.formeJuridiqueCreation}</p>}
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1.5">Capital social prévu</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Ex : 5000"
                  value={clientData.capitalCreation}
                  onChange={e => updateClientData({ capitalCreation: e.target.value })}
                  className="flex-1 px-3.5 py-2.5 border border-blue-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 bg-white"
                />
                <span className="text-sm text-gray-500">EUR</span>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1.5">Activité principale</label>
              <input
                type="text"
                placeholder="Ex : Conseil en stratégie digitale"
                value={clientData.activiteCreation}
                onChange={e => updateClientData({ activiteCreation: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-blue-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 bg-white"
              />
            </div>
          </div>

          <p className="text-xs text-blue-600">
            Le SIREN sera attribué après immatriculation au guichet unique INPI.
            Ces informations servent à la rédaction des statuts et aux formalités de création.
          </p>
        </div>
      )}

      {/* Note API — uniquement pour les reprises */}
      {!isCreation && (
        <div className="mt-4 flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3">
          <Building2 className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">
            Le SIREN est vérifié en temps réel via <strong>l'API Répertoire des Entreprises (data.gouv.fr)</strong> et l'algorithme de Luhn —
            gratuit et sans clé API requise.
          </p>
        </div>
      )}
    </StepShell>
  );
}
