import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { OnboardingProvider, useOnboarding } from '../context/OnboardingContext';
import { useDossiersContext } from '../context/DossiersContext';
import { Sidebar } from '../components/Sidebar';
import { TopBar } from '../components/TopBar';
import { Step1 } from '../components/steps/Step1';
import { Step2 } from '../components/steps/Step2';
import { Step3 } from '../components/steps/Step3';
import { Step4 } from '../components/steps/Step4';
import { Step5 } from '../components/steps/Step5';
import { Step6 } from '../components/steps/Step6';
import { Step7 } from '../components/steps/Step7';
import { Step8 } from '../components/steps/Step8';
import { Step9 } from '../components/steps/Step9';
import { Step10 } from '../components/steps/Step10';
import { Step11 } from '../components/steps/Step11';
import { ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { useOnboardingDraftStore } from '../store/useOnboardingDraftStore';
import { useProspectStore } from '../store/useProspectStore';

// Store component references (not JSX instances) to avoid stale context issues
const STEP_COMPONENTS: Record<number, React.ComponentType> = {
  1: Step1,
  2: Step2,
  3: Step3,
  4: Step4,
  5: Step5,
  6: Step6,
  7: Step7,
  8: Step8,
  9: Step9,
  10: Step10,
  11: Step11,
};

function StepRenderer() {
  const { currentStep } = useOnboarding();
  const StepComponent = STEP_COMPONENTS[currentStep] ?? Step1;
  return <StepComponent />;
}

function OnboardingContent({ dossierId }: { dossierId: string }) {
  const navigate = useNavigate();
  const { clientData, currentStep, stepStatuses, updateClientData, goToStep, setStepStatus } = useOnboarding();
  const { getDossier, saveDossier } = useDossiersContext();
  const { saveDraft, getDraft } = useOnboardingDraftStore();
  const { addProspect } = useProspectStore();

  // Track whether initial load is complete to prevent saving before load
  const [isLoaded, setIsLoaded] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const hasLoaded = useRef(false);

  // Track the Supabase prospect ID created transparently on first input
  const prospectIdRef = useRef<string | null>(getDraft(dossierId)?.prospectId ?? null);
  // Guard against creating the prospect more than once
  const prospectCreatedRef = useRef(prospectIdRef.current !== null);

  // Load dossier on mount — guarded with a ref to survive React 18 Strict Mode double-invoke
  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;

    const dossier = getDossier(dossierId);
    if (dossier) {
      if (dossier.clientData && Object.keys(dossier.clientData).length > 0) {
        updateClientData(dossier.clientData);
      }
      goToStep(dossier.currentStep);
      dossier.stepStatuses.forEach((status, index) => {
        setStepStatus(index + 1, status);
      });
    }

    // Restore the last saved timestamp from the draft store if available
    const draft = getDraft(dossierId);
    if (draft?.savedAt) setLastSavedAt(draft.savedAt);

    // Defer enabling autosave until after the next render cycle
    // so the state updates from loading have time to flush
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 100);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dossierId]);

  // Auto-save dossier on changes — debounced, syncs to Supabase via DossiersContext
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Use refs to always access latest values without adding deps
  const clientDataRef = useRef(clientData);
  clientDataRef.current = clientData;
  const currentStepRef = useRef(currentStep);
  currentStepRef.current = currentStep;
  const stepStatusesRef = useRef(stepStatuses);
  stepStatusesRef.current = stepStatuses;

  const debouncedSave = useCallback(() => {
    if (!isLoaded) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      const dossier = getDossier(dossierId);
      if (dossier) {
        // Persist to Supabase (via DossiersContext → backendApi)
        saveDossier({
          ...dossier,
          clientData: clientDataRef.current,
          currentStep: currentStepRef.current,
          stepStatuses: stepStatusesRef.current,
        });
      }

      // Persist instantly to localStorage via Zustand persist middleware
      const now = new Date().toISOString();
      saveDraft(dossierId, {
        clientData: clientDataRef.current,
        currentStep: currentStepRef.current,
        stepStatuses: stepStatusesRef.current,
        prospectId: prospectIdRef.current,
      });
      setLastSavedAt(now);
    }, 800);
  }, [isLoaded, dossierId, getDossier, saveDossier, saveDraft]);

  useEffect(() => {
    if (isLoaded) {
      debouncedSave();
    }
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [clientData, currentStep, stepStatuses, isLoaded, debouncedSave]);

  // Auto-create a Prospect in Supabase on first meaningful input (transparent to the user)
  useEffect(() => {
    if (!isLoaded) return;
    if (prospectCreatedRef.current) return;

    const hasName = clientData.nom.trim().length > 0;
    const hasEmail = clientData.email.trim().length > 0;
    if (!hasName && !hasEmail) return;

    // Set the guard before the async call to prevent concurrent duplicate calls.
    // If the API call fails, the ref stays true — we won't spam retries on every
    // render. The user can always refresh to attempt again.
    prospectCreatedRef.current = true;

    const companyName =
      clientData.raisonSociale ||
      clientData.denominationCreation ||
      clientData.nom ||
      'Nouveau prospect';

    addProspect({
      company_name: companyName,
      siren: clientData.siren || null,
      contact_name: clientData.nom || null,
      contact_email: clientData.email || null,
      contact_phone: clientData.telephone || null,
      status: 'en-negociation',
      kanban_column: 'en-negociation',
      source: 'onboarding',
      notes: `Dossier onboarding: ${dossierId}`,
    }).then(result => {
      if (result.success && result.id) {
        prospectIdRef.current = result.id;
        // Persist the prospect ID in the draft store
        saveDraft(dossierId, {
          clientData: clientDataRef.current,
          currentStep: currentStepRef.current,
          stepStatuses: stepStatusesRef.current,
          prospectId: result.id,
        });
      }
    }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientData.nom, clientData.email, isLoaded]);

  // Format the "last saved" label
  const savedLabel = lastSavedAt
    ? `Brouillon sauvegardé ${formatRelativeTime(lastSavedAt)}`
    : null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au tableau de bord
          </button>
          {savedLabel && (
            <span
              className="flex items-center gap-1.5 text-xs text-emerald-600"
              aria-live="polite"
              aria-label={savedLabel}
            >
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              {savedLabel}
            </span>
          )}
        </div>
        <TopBar />
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-2xl mx-auto">
            <StepRenderer />
          </div>
        </main>
      </div>
    </div>
  );
}

/** Returns a short human-readable relative time label (e.g. "à l'instant", "il y a 2 min"). */
function formatRelativeTime(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 10) return "à l'instant";
  if (diff < 60) return `il y a ${diff}s`;
  const mins = Math.floor(diff / 60);
  return `il y a ${mins} min`;
}

export function OnboardingFlow() {
  const { dossierId } = useParams<{ dossierId: string }>();
  const navigate = useNavigate();
  const { getDossier, loading } = useDossiersContext();

  useEffect(() => {
    if (loading) return;
    if (!dossierId) {
      navigate('/');
      return;
    }
    const dossier = getDossier(dossierId);
    if (!dossier) {
      navigate('/');
    }
  }, [dossierId, navigate, loading, getDossier]);

  if (!dossierId) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Chargement du dossier...</p>
        </div>
      </div>
    );
  }

  const dossier = getDossier(dossierId);
  if (!dossier) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <OnboardingProvider>
      <OnboardingContent dossierId={dossierId} />
    </OnboardingProvider>
  );
}
