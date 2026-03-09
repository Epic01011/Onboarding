import { ReactNode } from 'react';
import { Zap, User, GitBranch, SkipForward, CheckCircle2, Pencil } from 'lucide-react';
import { useOnboarding } from '../context/OnboardingContext';

type StepType = 'manuel' | 'automatisé' | 'conditionnel' | 'ia' | 'auto' | 'cond' | 'celebr' | string;

interface StepShellProps {
  step: number;
  title: string;
  subtitle: string;
  type: StepType;
  icon: ReactNode;
  children: ReactNode;
  onNext?: () => void;
  onBack?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  hideNav?: boolean;
  /** Label for the skip button shown when nextDisabled. Set to false to hide it. */
  skipLabel?: string | false;
}

const typeConfig: Record<string, { label: string; color: string; icon: ReactNode }> = {
  manuel:       { label: 'Manuel',       color: 'bg-blue-100 text-blue-700',      icon: <User className="w-3 h-3" /> },
  automatisé:   { label: 'Automatisé',   color: 'bg-violet-100 text-violet-700',  icon: <Zap className="w-3 h-3" /> },
  conditionnel: { label: 'Conditionnel', color: 'bg-amber-100 text-amber-700',    icon: <GitBranch className="w-3 h-3" /> },
  ia:           { label: 'Analyse IA',   color: 'bg-emerald-100 text-emerald-700', icon: <Zap className="w-3 h-3" /> },
  celebr:       { label: 'Célébration',  color: 'bg-pink-100 text-pink-700',      icon: <Zap className="w-3 h-3" /> },
};
// Abbreviated aliases used in StepConfig
typeConfig.auto = typeConfig.automatisé;
typeConfig.cond = typeConfig.conditionnel;

const fallbackConfig: { label: string; color: string; icon: ReactNode } = {
  label: 'Manuel', color: 'bg-blue-100 text-blue-700', icon: <User className="w-3 h-3" />,
};

export function StepShell({
  step, title, subtitle, type, icon, children,
  onNext, onBack, nextLabel = 'Étape suivante →',
  nextDisabled = false, hideNav = false, skipLabel = 'Passer cette étape →',
}: StepShellProps) {
  const { goPrev, goNext, totalSteps } = useOnboarding();
  const tc = typeConfig[type] ?? fallbackConfig;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
      
      {/* Header */}
      <div className="flex-shrink-0 bg-gradient-to-br from-slate-800 to-slate-900 px-6 py-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center">
              {icon}
            </div>
            <div>
              <p className="text-slate-400 text-xs">Etape {step} / {totalSteps}</p>
              <h2 className="text-white text-base mt-0.5">{title}</h2>
            </div>
          </div>
          <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${tc.color}`}>
            {tc.icon}
            {tc.label}
          </span>
        </div>
        <p className="text-slate-400 text-sm mt-3 ml-12">{subtitle}</p>
      </div>

      <div className="flex-1 min-h-0 p-6 overflow-y-auto">
        {children}
      </div>

      {/* Navigation */}
      {!hideNav && (
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
          <button
            onClick={onBack ?? goPrev}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
          >
            ← Retour
          </button>
          <div className="flex items-center gap-2">
            {/* Skip button — shown only when next is disabled and skipLabel is not false */}
            {nextDisabled && skipLabel !== false && (
              <button
                onClick={goNext}
                className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200 rounded-lg transition-all"
                title="Passer cette étape sans la valider"
              >
                <SkipForward className="w-3.5 h-3.5" />
                {skipLabel}
              </button>
            )}
            <button
              onClick={onNext}
              disabled={nextDisabled}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                nextDisabled
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md'
              }`}
            >
              {nextLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Automation task row with animated states */
export function AutoTask({
  label,
  sublabel,
  status,
}: {
  label: string;
  sublabel?: string;
  status: 'pending' | 'loading' | 'done' | 'error';
}) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg transition-all ${
      status === 'done' ? 'bg-emerald-50 border border-emerald-100' :
      status === 'loading' ? 'bg-blue-50 border border-blue-100' :
      status === 'error' ? 'bg-red-50 border border-red-100' :
      'bg-gray-50 border border-gray-100'
    }`}>
      <div className="mt-0.5 flex-shrink-0">
        {status === 'pending' && <div className="w-4 h-4 rounded-full border-2 border-gray-300" />}
        {status === 'loading' && (
          <div className="w-4 h-4 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
        )}
        {status === 'done' && (
          <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
        {status === 'error' && (
          <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        )}
      </div>
      <div>
        <p className={`text-sm font-medium ${
          status === 'done' ? 'text-emerald-700' :
          status === 'loading' ? 'text-blue-700' :
          status === 'error' ? 'text-red-700' :
          'text-gray-500'
        }`}>{label}</p>
        {sublabel && <p className="text-xs text-gray-500 mt-0.5">{sublabel}</p>}
      </div>
    </div>
  );
}

/** Info card */
export function InfoCard({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-gray-50 rounded-lg px-4 py-3">
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`text-sm text-gray-900 ${mono ? 'font-mono' : 'font-medium'}`}>{value}</p>
    </div>
  );
}

/** Banner displayed when a step is auto-completed from pre-existing data (Devis / Lettre de Mission) */
export function AutoCompletedBanner({
  source,
  onEdit,
}: {
  /** Human-readable source label, e.g. "Devis" or "Lettre de Mission" */
  source: string;
  /** Optional callback to switch back to edit mode */
  onEdit?: () => void;
}) {
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-5 flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-emerald-800">Complétée automatiquement</p>
          <p className="text-xs text-emerald-600 mt-0.5">
            Ces données ont été récupérées lors du <strong>{source}</strong>. Vérifiez-les avant de continuer.
          </p>
        </div>
      </div>
      {onEdit && (
        <button
          onClick={onEdit}
          className="flex-shrink-0 flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 bg-white border border-emerald-200 hover:border-emerald-300 px-2.5 py-1.5 rounded-lg transition-all"
        >
          <Pencil className="w-3 h-3" />
          Modifier
        </button>
      )}
    </div>
  );
}
