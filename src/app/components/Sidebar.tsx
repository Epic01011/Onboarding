import {
  ClipboardList, Search, Mail, FolderOpen, Scale, PenLine,
  Upload, Cpu, Lock, Database, Trophy,
  CheckCircle2, Circle, MinusCircle, Zap, ChevronRight, RotateCcw,
  Settings, FileText, Home, Calendar, Calculator, Radar, CalendarCheck,
  CreditCard, Landmark, FileSpreadsheet, type LucideIcon,
} from 'lucide-react';
import { useOnboarding, StepStatus } from '../context/OnboardingContext';
import { useServices } from '../context/ServicesContext';
import { useNavigate } from 'react-router';

/** Map string icon names (from StepConfig) → Lucide components */
const ICON_MAP: Record<string, LucideIcon> = {
  ClipboardList, Search, Mail, FolderOpen, Scale, PenLine,
  Upload, Cpu, Lock, Database, Trophy,
  Home, CreditCard, Landmark, FileSpreadsheet,
  FileText, FileSignature: FileText, // alias
};

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === 'completed') return <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />;
  if (status === 'active') return <div className="w-4 h-4 rounded-full bg-blue-400 flex-shrink-0 animate-pulse" />;
  if (status === 'skipped') return <MinusCircle className="w-4 h-4 text-slate-500 flex-shrink-0" />;
  if (status === 'error') return <Circle className="w-4 h-4 text-red-400 flex-shrink-0" />;
  return <Circle className="w-4 h-4 text-slate-700 flex-shrink-0" />;
}

function TypeBadge({ type }: { type: string }) {
  if (type === 'auto') return (
    <span className="flex items-center gap-0.5 text-violet-400" style={{ fontSize: '10px' }}>
      <Zap className="w-2.5 h-2.5" />Auto
    </span>
  );
  if (type === 'cond') return <span className="text-amber-400" style={{ fontSize: '10px' }}>Cond.</span>;
  if (type === 'celebr') return <span className="text-yellow-400" style={{ fontSize: '10px' }}>🎉</span>;
  return null;
}

export function Sidebar() {
  const { currentStep, stepStatuses, goToStep, resetDemo, clientData, activeSteps } = useOnboarding();
  const navigate = useNavigate();
  const { connections } = useServices();

  const totalSteps = activeSteps.length;
  const completedCount = stepStatuses.slice(0, totalSteps).filter(s => s === 'completed').length;
  const progress = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

  const serviceStatus = [
    { name: 'M365', key: 'microsoft' as const, label: 'Microsoft 365' },
    { name: 'JSign', key: 'jesignexpert' as const, label: 'JeSignExpert' },
    { name: 'Airtable', key: 'airtable' as const, label: 'Airtable' },
    { name: 'PLane', key: 'pennylane' as const, label: 'Pennylane' },
    { name: 'SendGrid', key: 'sendgrid' as const, label: 'SendGrid Email' },
    { name: 'HubSpot', key: 'hubspot' as const, label: 'HubSpot CRM' },
    { name: 'Pipedrive', key: 'pipedrive' as const, label: 'Pipedrive CRM' },
  ];

  return (
    <aside className="w-72 h-screen sticky top-0 bg-slate-900 flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-700/60">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-none">CabinetFlow</p>
            <p className="text-slate-400" style={{ fontSize: '11px', marginTop: '2px' }}>Onboarding client automatisé</p>
          </div>
        </div>

        {/* Quick nav */}
        <div className="grid grid-cols-3 gap-1 mb-2">
          <button
            onClick={() => navigate('/')}
            className="flex items-center justify-center gap-1 py-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all"
            style={{ fontSize: '10px' }}
          >
            <Home className="w-3 h-3" /> Dashboard
          </button>
          <button
            onClick={() => navigate('/templates')}
            className="flex items-center justify-center gap-1 py-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all"
            style={{ fontSize: '10px' }}
          >
            <FileText className="w-3 h-3" /> Bibliothèque
          </button>
          <button
            onClick={() => navigate('/setup')}
            className="flex items-center justify-center gap-1 py-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all"
            style={{ fontSize: '10px' }}
          >
            <Settings className="w-3 h-3" /> Config.
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1 mb-4">
          <button
            onClick={() => navigate('/fiscal-calendar')}
            className="flex items-center justify-center gap-1 py-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all"
            style={{ fontSize: '10px' }}
          >
            <Calendar className="w-3 h-3" /> Fiscal
          </button>
          <button
            onClick={() => navigate('/prospection')}
            className="flex items-center justify-center gap-1 py-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all"
            style={{ fontSize: '10px' }}
          >
            <Radar className="w-3 h-3" /> Prospection
          </button>
          <button
            onClick={() => navigate('/pricing')}
            className="flex items-center justify-center gap-1 py-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all"
            style={{ fontSize: '10px' }}
          >
            <Calculator className="w-3 h-3" /> Pricing
          </button>
          <button
            onClick={() => navigate('/events-campaign')}
            className="flex items-center justify-center gap-1 py-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all col-span-3"
            style={{ fontSize: '10px' }}
          >
            <CalendarCheck className="w-3 h-3" /> Événements Locaux
          </button>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-slate-400 text-xs">Progression dossier</span>
            <span className="text-slate-300 text-xs font-medium">{progress}%</span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-slate-500 mt-1.5" style={{ fontSize: '11px' }}>{completedCount}/{totalSteps} étapes complétées</p>
        </div>

        {clientData.nom && (
          <div className="mt-3 bg-slate-800 rounded-lg px-3 py-2">
            <p className="text-slate-400" style={{ fontSize: '11px' }}>Client en cours</p>
            <p className="text-white text-xs font-medium truncate">{clientData.nom}</p>
            {clientData.raisonSociale && (
              <p className="text-slate-400 truncate" style={{ fontSize: '11px' }}>{clientData.raisonSociale}</p>
            )}
            {clientData.missionType && (
              <span className={`inline-block mt-1 px-2 py-0.5 rounded text-white`}
                style={{
                  fontSize: '10px',
                  backgroundColor: clientData.missionType === 'creation' ? '#3b82f6' : '#f59e0b',
                }}>
                {clientData.missionType === 'creation' ? '🏗️ Création' : '🔄 Reprise'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Steps list */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {activeSteps.map((step, idx) => {
          const stepNum = idx + 1;
          const status = stepStatuses[idx] ?? 'pending';
          const isActive = currentStep === stepNum;
          // All steps are freely navigable — no locking
          const Icon = ICON_MAP[step.icon] ?? ClipboardList;

          return (
            <button
              key={step.id}
              onClick={() => goToStep(stepNum)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all relative ${
                isActive ? 'bg-blue-600/20 text-white' :
                status === 'completed' ? 'text-slate-300 hover:bg-slate-800/60 cursor-pointer' :
                status === 'active' ? 'text-slate-300 hover:bg-slate-800/60 cursor-pointer' :
                status === 'skipped' ? 'text-slate-500 hover:bg-slate-800/40 cursor-pointer' :
                'text-slate-500 hover:bg-slate-800/40 cursor-pointer'
              }`}
            >
              {isActive && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-400 rounded-r" />}

              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                isActive ? 'bg-blue-600' :
                status === 'completed' ? 'bg-emerald-600/20' :
                'bg-slate-800'
              }`}>
                <Icon className={`w-3.5 h-3.5 ${
                  isActive ? 'text-white' :
                  status === 'completed' ? 'text-emerald-400' :
                  'text-slate-600'
                }`} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium truncate">{step.title}</span>
                  <TypeBadge type={step.type} />
                </div>
                <p className={`truncate ${isActive ? 'text-blue-300' : 'text-slate-600'}`} style={{ fontSize: '10px' }}>
                  {step.short}
                </p>
              </div>

              <StatusIcon status={status} />
              {isActive && <ChevronRight className="w-3 h-3 text-blue-400 flex-shrink-0" />}
            </button>
          );
        })}
      </nav>

      {/* API Connections indicator — real status */}
      <div className="px-4 py-3 border-t border-slate-700/60 space-y-2">
        <p className="text-slate-500 text-xs">Intégrations API</p>
        <div className="grid grid-cols-2 gap-1.5">
          {serviceStatus.map(svc => {
            const connected = connections[svc.key]?.connected;
            return (
              <button
                key={svc.key}
                onClick={() => navigate('/setup')}
                className="flex items-center gap-1 hover:opacity-80 transition-opacity"
              >
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${connected ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                <span className="text-slate-500 truncate" style={{ fontSize: '10px' }}>{svc.name}</span>
                {!connected && <span className="text-amber-500 ml-auto" style={{ fontSize: '9px' }}>⚙</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700/60">
        <button
          onClick={resetDemo}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-all text-xs"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Réinitialiser le dossier
        </button>
      </div>
    </aside>
  );
}
