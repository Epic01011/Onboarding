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
import { ArrowLeft, Loader2 } from 'lucide-react';

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

  // Track whether initial load is complete to prevent saving before load
  const [isLoaded, setIsLoaded] = useState(false);
  const hasLoaded = useRef(false);

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
        saveDossier({
          ...dossier,
          clientData: clientDataRef.current,
          currentStep: currentStepRef.current,
          stepStatuses: stepStatusesRef.current,
        });
      }
    }, 800);
  }, [isLoaded, dossierId, getDossier, saveDossier]);

  useEffect(() => {
    if (isLoaded) {
      debouncedSave();
    }
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [clientData, currentStep, stepStatuses, isLoaded, debouncedSave]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-white border-b border-gray-200 px-6 py-3">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au tableau de bord
          </button>
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
