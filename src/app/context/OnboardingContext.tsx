import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

export type MissionType = 'creation' | 'reprise' | '';

// ─── Step configuration ───────────────────────────────────────────────────────
export interface StepConfig {
  id: string;
  title: string;
  /** Short description shown in the sidebar below the title */
  short: string;
  /** Type used by the sidebar TypeBadge: 'auto' | 'cond' | 'celebr' | '' */
  type: string;
  /** Icon name key for the Sidebar ICON_MAP (lucide-react icon name) */
  icon: string;
}

export const STEP_CONFIGS: StepConfig[] = [
  { id: 'step1',  title: 'Formulaire de Collecte Initial',       short: 'Infos client & mission',       type: '',       icon: 'ClipboardList' },
  { id: 'step2',  title: 'Vérification SIREN',                   short: 'API Entreprises gouv.',        type: 'auto',   icon: 'Search'        },
  { id: 'step3',  title: 'Demande Documentaire Client',          short: 'Email avec lien upload',       type: 'auto',   icon: 'Mail'          },
  { id: 'step4',  title: "Initialisation de l'Espace Client",    short: 'CRM + SharePoint',             type: 'auto',   icon: 'FolderOpen'    },
  { id: 'step5',  title: 'Lettre Confraternelle',                short: 'Déontologie OEC (reprise)',    type: 'cond',   icon: 'Scale'         },
  { id: 'step6',  title: 'Contractualisation & Signature',       short: 'LDM + signature électronique', type: 'auto',   icon: 'PenLine'       },
  { id: 'step7',  title: 'Collecte Documentaire KYC',            short: 'Pièces identité & statuts',    type: '',       icon: 'Upload'        },
  { id: 'step8',  title: 'Analyse IA & Validation OCR',         short: 'Contrôle conformité',          type: '',       icon: 'Cpu'           },
  { id: 'step9',  title: 'Délégations Gouvernementales',         short: 'Impôts & URSSAF',              type: '',       icon: 'Lock'          },
  { id: 'step10', title: 'Provisionnement Pennylane',            short: 'Compte + mandat SEPA',         type: 'auto',   icon: 'Database'      },
  { id: 'step11', title: "Clôture de l'Onboarding",             short: 'Email bienvenue + suivi',      type: 'celebr', icon: 'Trophy'        },
];

/** 6-step linear flow for "Reprise de dossier" missions. */
export const REPRISE_STEP_CONFIGS: StepConfig[] = [
  { id: 'prospect-selection', title: 'Sélection du Prospect',   short: 'Import depuis le CRM',          type: '',       icon: 'UserSearch' },
  { id: 'ldm-generation',     title: 'Lettre de Mission',        short: 'Génération & signature LDM',    type: 'auto',   icon: 'PenLine'    },
  { id: 'confraternelle',     title: 'Reprise Confraternelle',   short: 'Lettre confrère OEC',           type: 'auto',   icon: 'Scale'      },
  { id: 'collecte-fiscale',   title: 'Collecte & Accès Fiscaux', short: 'Pièces + identifiants fiscaux', type: '',       icon: 'FolderOpen' },
  { id: 'connectivite',       title: 'Connectivité & Pennylane', short: 'GED + intégrations',            type: 'cond',   icon: 'Database'   },
  { id: 'cloture',            title: "Clôture de l'Onboarding",  short: 'Finalisation & activation',     type: 'celebr', icon: 'Trophy'     },
];
export const REPRISE_TOTAL_STEPS = REPRISE_STEP_CONFIGS.length;
export type StepStatus = 'pending' | 'active' | 'completed' | 'skipped' | 'error';

export type FormeJuridiqueCreation = 'SAS' | 'SASU' | 'SARL' | 'EURL' | 'SCI' | 'SA' | '';

export interface AssocieItem {
  id: string;
  nom: string;
  email: string;
  idRectoRecu: boolean;
  idVersoRecu: boolean;
}

export interface DocumentItem {
  id: string;
  name: string;
  required: boolean;
  status: 'pending' | 'received' | 'validated' | 'rejected';
  uploadedAt?: string;
  sharepointUrl?: string;
}

export const MISSIONS_LIST = [
  'Tenue de comptabilité et établissement des comptes annuels',
  'Établissement des déclarations fiscales (TVA, IS/IR)',
  'Établissement des déclarations sociales',
  'Gestion de la paie',
  'Révision comptable et audit interne',
  'Conseil fiscal et optimisation fiscale',
  'Liasses fiscales et annexes',
  'Assistance à la création d\'entreprise',
  'Accompagnement stratégique et prévisionnel',
  'Gestion administrative et secrétariat juridique',
];

export interface ClientData {
  // Step 1
  siren: string;
  nom: string;
  email: string;
  telephone: string;
  missionType: MissionType;
  confrereEmail: string;
  // Step 1 — Création
  formeJuridiqueCreation: FormeJuridiqueCreation;
  capitalCreation: string;
  activiteCreation: string;
  denominationCreation: string;
  associes: AssocieItem[];
  // Step 2
  siret: string;
  codeNAF: string;
  libelleNAF: string;
  capital: string;
  adresse: string;
  codePostal: string;
  ville: string;
  raisonSociale: string;
  formeJuridique: string;
  dateCreation: string;
  effectif: string;
  // Step 3
  documentDemandeSent: boolean;
  sharepointUploadLink: string;
  // Step 3 — Création (mandat)
  mandatCreationEnvoye: boolean;
  mandatCreationSigne: boolean;
  mandatCreationSharepointUrl: string;
  attestationNonCondamnationEnvoyee: boolean;
  attestationNonCondamnationRecue: boolean;
  // Step 4
  sharepointFolderUrl: string;
  sharepointFolderId: string;
  // Step 5
  lettreConfrereEnvoyee: boolean;
  // Step 6
  missionsSelectionnees: string[];
  prixAnnuel: string;
  lettreMissionSignee: boolean;
  lettreMissionSharepointUrl: string;
  // Step 6 — Signature électronique
  signatureProvider: 'jesignexpert' | 'yousign' | '';
  lettreMissionSignatureId: string;
  // Step 6 — Devis pricing breakdown (pre-fill from PricingEngine)
  devisMonthlyAccounting: number;
  devisMonthlyClosing: number;
  devisMonthlySocial: number;
  devisMonthlyOptions: number;
  devisSetupFees: number;
  devisTaxRegime: string;
  devisBulletinsPerMonth: number;
  // Step 7
  documents: DocumentItem[];
  // Step — Carte d'identité (création)
  carteIdentiteUploaded: boolean;
  carteIdentiteUrl: string;
  carteIdentiteType: string;
  // Step — Justificatif de domicile (création)
  justificatifDomicileUploaded: boolean;
  justificatifDomicileUrl: string;
  // Step — Attestation de dépôt de capital (création)
  attestationCapitalUploaded: boolean;
  attestationCapitalUrl: string;
  // Step — DAS2
  das2NonApplicable: boolean;
  das2Completed: boolean;
  // Step — Formulaire M0 (création)
  formulaireM0Data: Record<string, string>;
  formulaireM0Rempli: boolean;
  // Step — Statuts de la société (création)
  statutsGeneres: boolean;
  statutsSignes: boolean;
  statutsSignatureId: string;
  // Step 9
  delegationEmailSent: boolean;
  impotsDelegation: { received: boolean; codes: string };
  urssafDelegation: { received: boolean; codes: string };
  delegationSharepointUrl: string;
  delegationPennylaneNote: boolean;
  // Step 10
  pennylaneClientId: string;
  pennylaneCreated: boolean;
  pennylaneMandat: 'pending' | 'sent' | 'signed';
  // Step 11
  welcomeEmailSent: boolean;
  // CRM
  crmProvider: 'hubspot' | 'pipedrive' | '';
  crmDealId: string;
  /** True si le client a une paie (bulletins de salaire), déduit du devis */
  hasPayroll: boolean;
}

const defaultDocuments: DocumentItem[] = [
  { id: '1', name: 'Extrait KBIS (- de 3 mois)', required: true, status: 'pending' },
  { id: '2', name: "Pièce d'identité du dirigeant", required: true, status: 'pending' },
  { id: '3', name: 'Statuts de la société', required: true, status: 'pending' },
  { id: '4', name: 'Derniers bilans comptables (3 ans)', required: true, status: 'pending' },
  { id: '5', name: 'Attestation de régularité fiscale (AF)', required: false, status: 'pending' },
  { id: '6', name: 'Attestation de vigilance URSSAF', required: false, status: 'pending' },
];

export const defaultClientData: ClientData = {
  siren: '', nom: '', email: '', telephone: '', missionType: '', confrereEmail: '',
  formeJuridiqueCreation: '', capitalCreation: '', activiteCreation: '', denominationCreation: '', associes: [],
  siret: '', codeNAF: '', libelleNAF: '', capital: '', adresse: '',
  codePostal: '', ville: '', raisonSociale: '', formeJuridique: '',
  dateCreation: '', effectif: '',
  documentDemandeSent: false, sharepointUploadLink: '',
  mandatCreationEnvoye: false, mandatCreationSigne: false, mandatCreationSharepointUrl: '',
  attestationNonCondamnationEnvoyee: false, attestationNonCondamnationRecue: false,
  sharepointFolderUrl: '', sharepointFolderId: '',
  lettreConfrereEnvoyee: false,
  missionsSelectionnees: [], prixAnnuel: '',
  lettreMissionSignee: false, lettreMissionSharepointUrl: '',
  signatureProvider: '', lettreMissionSignatureId: '',
  devisMonthlyAccounting: 0, devisMonthlyClosing: 0, devisMonthlySocial: 0,
  devisMonthlyOptions: 0, devisSetupFees: 0, devisTaxRegime: '', devisBulletinsPerMonth: 0,
  documents: defaultDocuments,
  carteIdentiteUploaded: false, carteIdentiteUrl: '', carteIdentiteType: '',
  justificatifDomicileUploaded: false, justificatifDomicileUrl: '',
  attestationCapitalUploaded: false, attestationCapitalUrl: '',
  das2NonApplicable: false, das2Completed: false,
  formulaireM0Data: {}, formulaireM0Rempli: false,
  statutsGeneres: false, statutsSignes: false, statutsSignatureId: '',
  delegationEmailSent: false,
  impotsDelegation: { received: false, codes: '' },
  urssafDelegation: { received: false, codes: '' },
  delegationSharepointUrl: '', delegationPennylaneNote: false,
  pennylaneClientId: '', pennylaneCreated: false, pennylaneMandat: 'pending',
  welcomeEmailSent: false,
  crmProvider: '', crmDealId: '',
  hasPayroll: false,
};

interface OnboardingContextType {
  currentStep: number;
  clientData: ClientData;
  stepStatuses: StepStatus[];
  totalSteps: number;
  /** All 11 step configurations, used by Sidebar and TopBar for rendering */
  activeSteps: StepConfig[];
  goToStep: (step: number) => void;
  updateClientData: (data: Partial<ClientData>) => void;
  setStepStatus: (step: number, status: StepStatus) => void;
  goNext: () => void;
  goPrev: () => void;
  resetDemo: () => void;
}

export const TOTAL_STEPS = 11;

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [clientData, setClientData] = useState<ClientData>(defaultClientData);
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>([
    'active', ...Array(TOTAL_STEPS - 1).fill('pending'),
  ]);

  // Use refs to allow stable callbacks to access latest values
  const clientDataRef = useRef(clientData);
  clientDataRef.current = clientData;
  const currentStepRef = useRef(currentStep);
  currentStepRef.current = currentStep;

  // Derive flow config from missionType — reactive to clientData updates
  const isReprise = clientData.missionType === 'reprise';
  const totalSteps = isReprise ? REPRISE_TOTAL_STEPS : TOTAL_STEPS;
  const activeSteps = isReprise ? REPRISE_STEP_CONFIGS : STEP_CONFIGS;
  const totalStepsRef = useRef(totalSteps);
  totalStepsRef.current = totalSteps;

  const updateClientData = useCallback((data: Partial<ClientData>) => {
    setClientData(prev => ({ ...prev, ...data }));
  }, []);

  const setStepStatus = useCallback((step: number, status: StepStatus) => {
    setStepStatuses(prev => {
      const u = [...prev];
      u[step - 1] = status;
      return u;
    });
  }, []);

  const goToStep = useCallback((step: number) => setCurrentStep(step), []);

  const goNext = useCallback(() => {
    const step = currentStepRef.current;
    const isCreation = clientDataRef.current.missionType === 'creation';
    const total = totalStepsRef.current;

    setStepStatuses(prev => {
      const u = [...prev];
      u[step - 1] = 'completed';

      if (step === 4 && isCreation) {
        u[4] = 'skipped';
        if (u[5] === 'pending') u[5] = 'active';
      } else if (step < total) {
        if (u[step] === 'pending') u[step] = 'active';
      }
      return u;
    });

    if (step === 4 && isCreation) {
      setCurrentStep(6);
    } else if (step < total) {
      setCurrentStep(step + 1);
    }
  }, []);

  const goPrev = useCallback(() => {
    const step = currentStepRef.current;
    if (step > 1) {
      let prev = step - 1;
      if (prev === 5 && clientDataRef.current.missionType === 'creation') prev = 4;
      setCurrentStep(prev);
    }
  }, []);

  const resetDemo = useCallback(() => {
    setCurrentStep(1);
    setClientData(defaultClientData);
    setStepStatuses(['active', ...Array(TOTAL_STEPS - 1).fill('pending')]);
  }, []);

  return (
    <OnboardingContext.Provider value={{
      currentStep, clientData, stepStatuses, totalSteps,
      activeSteps,
      goToStep, updateClientData, setStepStatus, goNext, goPrev, resetDemo,
    }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}