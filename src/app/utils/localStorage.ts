import { ClientData, StepStatus, defaultClientData } from '../context/OnboardingContext';

export interface DossierData {
  id: string;
  clientData: ClientData;
  stepStatuses: StepStatus[];
  currentStep: number;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'cabinetflow_dossiers';

export function getAllDossiers(): DossierData[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function getDossier(id: string): DossierData | null {
  const dossiers = getAllDossiers();
  return dossiers.find(d => d.id === id) || null;
}

export function saveDossier(dossier: DossierData): void {
  const dossiers = getAllDossiers();
  const index = dossiers.findIndex(d => d.id === dossier.id);
  
  const updated = {
    ...dossier,
    updatedAt: new Date().toISOString(),
  };

  if (index >= 0) {
    dossiers[index] = updated;
  } else {
    dossiers.push(updated);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(dossiers));
}

export function deleteDossier(id: string): void {
  const dossiers = getAllDossiers();
  const filtered = dossiers.filter(d => d.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function createNewDossier(): DossierData {
  return {
    id: `dossier_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    clientData: { ...defaultClientData },
    stepStatuses: ['active', ...Array(10).fill('pending')] as StepStatus[],
    currentStep: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}