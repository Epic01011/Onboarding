import { useOnboarding } from '../context/OnboardingContext';

export function TopBar() {
  const { currentStep, stepStatuses, clientData, activeSteps } = useOnboarding();
  const totalSteps = activeSteps.length;
  const currentStepConfig = activeSteps[currentStep - 1];
  const currentStepTitle = currentStepConfig?.title ?? '';
  const completed = stepStatuses.slice(0, totalSteps).filter(s => s === 'completed').length;
  const progress = totalSteps > 0 ? Math.round((completed / totalSteps) * 100) : 0;

  return (
    <header className="bg-white border-b border-gray-100 px-6 py-3.5 flex items-center gap-4 sticky top-0 z-10">
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400">Étape {currentStep}/{totalSteps}</span>
          <span className="text-gray-200">·</span>
          <span className="text-sm font-medium text-gray-800">{currentStepTitle}</span>
          {stepStatuses[currentStep - 1] === 'completed' && (
            <span className="text-xs bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded-full">
              ✓ Complété
            </span>
          )}
          {stepStatuses[currentStep - 1] === 'skipped' && (
            <span className="text-xs bg-gray-50 text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full">
              ⏭ Ignoré
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex gap-0.5 flex-1 max-w-xs">
            {activeSteps.map((_, i) => {
              const status = stepStatuses[i] ?? 'pending';
              return (
                <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                  status === 'completed' ? 'bg-emerald-500' :
                  status === 'active' ? 'bg-blue-400' :
                  status === 'skipped' ? 'bg-gray-200' :
                  'bg-gray-100'
                }`} />
              );
            })}
          </div>
          <span className="text-xs text-gray-400 flex-shrink-0">{progress}%</span>
        </div>
      </div>

      {clientData.nom && (
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
          <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-blue-700">{clientData.nom.charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-800 leading-none">{clientData.nom}</p>
            {clientData.raisonSociale && (
              <p className="text-gray-400 mt-0.5" style={{ fontSize: '10px' }}>{clientData.raisonSociale}</p>
            )}
          </div>
          {clientData.missionType && (
            <div className={`ml-1 px-1.5 py-0.5 rounded text-white`}
              style={{
                fontSize: '10px',
                backgroundColor: clientData.missionType === 'creation' ? '#3b82f6' : '#f59e0b',
              }}>
              {clientData.missionType === 'creation' ? '🏗️ Création' : '🔄 Reprise'}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
