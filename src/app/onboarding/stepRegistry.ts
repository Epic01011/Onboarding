import type { ClientData, MissionType } from '../context/OnboardingContext';
import { defaultClientData } from '../context/OnboardingContext';

export interface StepDef {
  id: string;
  label: string;
  component: string;
  isBlocking: boolean;
  isApplicable: (clientData: ClientData) => boolean;
}

/**
 * Flux linéaire dédié à la Création de société (7 étapes).
 * Utilisé à la place de ALL_STEPS quand missionType === 'creation'.
 */
export const CREATION_STEPS: StepDef[] = [
  {
    id: 'creation-prospect',
    label: 'Sélection du Prospect',
    component: 'StepCreation1Prospect',
    isBlocking: true,
    isApplicable: (cd) => cd.missionType === 'creation',
  },
  {
    id: 'creation-cadrage',
    label: 'Cadrage & Projet',
    component: 'StepCreation2Cadrage',
    isBlocking: false,
    isApplicable: (cd) => cd.missionType === 'creation',
  },
  {
    id: 'creation-collecte',
    label: 'Collecte Documentaire',
    component: 'StepCreation3Collecte',
    isBlocking: true,
    isApplicable: (cd) => cd.missionType === 'creation',
  },
  {
    id: 'creation-signature',
    label: 'Signature Électronique',
    component: 'StepCreation4Signature',
    isBlocking: false,
    isApplicable: (cd) => cd.missionType === 'creation',
  },
  {
    id: 'creation-formalites',
    label: 'Formalités Légales',
    component: 'StepCreation5Formalites',
    isBlocking: false,
    isApplicable: (cd) => cd.missionType === 'creation',
  },
  {
    id: 'creation-suivi-kbis',
    label: 'Suivi & Dépôt Kbis',
    component: 'StepCreation6SuiviKbis',
    isBlocking: false,
    isApplicable: (cd) => cd.missionType === 'creation',
  },
  {
    id: 'creation-cloture',
    label: 'Connectivité & Clôture',
    component: 'StepCreation7Cloture',
    isBlocking: false,
    isApplicable: (cd) => cd.missionType === 'creation',
  },
];

/**
 * Registre global de toutes les étapes disponibles.
 * isApplicable() détermine dynamiquement si l'étape est incluse dans le parcours
 * selon les données client (missionType, hasPayroll, hasVAT, etc.).
 */
export const ALL_STEPS: StepDef[] = [
  {
    id: 'collecte',
    label: 'Collecte initiale',
    component: 'Step1',
    isBlocking: true,
    isApplicable: () => true,
  },
  {
    id: 'siren',
    label: 'Vérification SIREN',
    component: 'Step2',
    isBlocking: true,
    isApplicable: () => true,
  },
  // Creation-specific steps
  {
    id: 'justif-domicile',
    label: 'Justificatif de domicile',
    component: 'StepJustificatifDomicile',
    isBlocking: true,
    isApplicable: (cd) => cd.missionType === 'creation',
  },
  {
    id: 'carte-identite',
    label: "Pièces d'identité",
    component: 'StepCarteIdentite',
    isBlocking: true,
    isApplicable: (cd) => cd.missionType === 'creation',
  },
  {
    id: 'statuts',
    label: 'Statuts de la société',
    component: 'StepStatuts',
    isBlocking: true,
    isApplicable: (cd) => cd.missionType === 'creation',
  },
  {
    id: 'formulaire-m0',
    label: 'Formulaire M0',
    component: 'StepFormulaireM0',
    isBlocking: false,
    isApplicable: (cd) => cd.missionType === 'creation',
  },
  {
    id: 'attestation',
    label: 'Attestation dépôt capital',
    component: 'StepAttestationCapital',
    isBlocking: false,
    isApplicable: (cd) => cd.missionType === 'creation',
  },
  {
    id: 'das2',
    label: 'DAS2',
    component: 'StepDAS2',
    isBlocking: false,
    isApplicable: (cd) => cd.missionType === 'creation',
  },
  // Common steps
  {
    id: 'docs',
    label: 'Demande documentaire',
    component: 'Step3',
    isBlocking: false,
    isApplicable: () => true,
  },
  {
    id: 'espace',
    label: 'Espace Client',
    component: 'Step4',
    isBlocking: false,
    isApplicable: () => true,
  },
  {
    id: 'deonto',
    label: 'Gestion Déontologique',
    component: 'Step5',
    isBlocking: false,
    isApplicable: (cd) => cd.missionType === 'reprise',
  },
  {
    id: 'contractual',
    label: 'Contractualisation',
    component: 'Step6',
    isBlocking: true,
    isApplicable: () => true,
  },
  {
    id: 'kyc',
    label: 'Collecte KYC / LCB-FT',
    component: 'StepKYC',
    isBlocking: true,
    isApplicable: () => true,
  },
  {
    id: 'fec',
    label: 'Reprise Technique FEC',
    component: 'StepRepriseFEC',
    isBlocking: false,
    isApplicable: (cd) => cd.missionType === 'reprise',
  },
  {
    id: 'billing',
    label: 'Facturation & SEPA',
    component: 'StepBilling',
    isBlocking: false,
    isApplicable: () => true,
  },
  {
    id: 'analyse',
    label: 'Analyse IA (OCR)',
    component: 'Step8',
    isBlocking: false,
    isApplicable: () => true,
  },
  {
    id: 'delegations',
    label: 'Délégations accès',
    component: 'Step9',
    isBlocking: false,
    isApplicable: () => true,
  },
  {
    id: 'pennylane',
    label: 'Pennylane',
    component: 'Step10',
    isBlocking: false,
    isApplicable: () => true,
  },
  {
    id: 'cloture',
    label: 'Clôture',
    component: 'Step11',
    isBlocking: false,
    isApplicable: () => true,
  },
];

/**
 * Convertit l'ancien format (currentStep: number) vers le nouveau (currentStepId: string).
 * Utilisé lors du chargement de dossiers créés avant la migration vers le système d'ID.
 *
 * Les listes d'étapes sont dérivées dynamiquement depuis ALL_STEPS via isApplicable(),
 * garantissant une synchronisation permanente avec le parcours réel.
 */
export function migrateStepNumberToId(
  stepNumber: number,
  missionType: string,
): string {
  const mockClientData: ClientData = { ...defaultClientData, missionType: missionType as MissionType };
  const steps = ALL_STEPS
    .filter((step) => step.isApplicable(mockClientData))
    .map((step) => step.id);
  const idx = Math.max(0, Math.min(stepNumber - 1, steps.length - 1));
  return steps[idx] ?? 'collecte';
}
