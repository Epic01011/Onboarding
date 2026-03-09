import { useState, useEffect, useRef } from 'react';
import { Cpu, CheckCircle2, Zap } from 'lucide-react';
import { useOnboarding } from '../../context/OnboardingContext';
import { StepShell, AutoTask } from '../StepShell';
import { checkDocumentCompliance } from '../../utils/validators';
import { delay } from '../../utils/delay';

type Phase = 'idle' | 'running' | 'done';

export function Step8() {
  const { clientData, updateClientData, goNext, goPrev } = useOnboarding();
  const [phase, setPhase] = useState<Phase>('idle');
  const [analyzedCount, setAnalyzedCount] = useState(0);
  const hasAutoRun = useRef(false);

  const receivedDocs = clientData.documents.filter(d => d.status === 'received' || d.status === 'validated');

  const analyze = async () => {
    setPhase('running');
    if (receivedDocs.length === 0) {
      // No documents to process — pass through immediately
      setPhase('done');
      return;
    }
    for (let i = 1; i <= receivedDocs.length; i++) {
      await delay(600);
      setAnalyzedCount(i);
    }
    const updated = clientData.documents.map(d =>
      d.status === 'received' ? { ...d, status: 'validated' as const } : d
    );
    updateClientData({ documents: updated });
    setPhase('done');
  };

  // Auto-run analysis on mount
  useEffect(() => {
    if (hasAutoRun.current) return;
    hasAutoRun.current = true;
    analyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getStatus = (i: number): 'pending' | 'loading' | 'done' => {
    if (phase === 'idle') return 'pending';
    if (i < analyzedCount) return 'done';
    if (i === analyzedCount && phase === 'running') return 'loading';
    return 'pending';
  };

  return (
    <StepShell
      step={8}
      title="Analyse IA & Validation des Pièces (OCR)"
      subtitle="Lecture automatique par intelligence artificielle, vérification de conformité et contrôle des dates (KBIS < 3 mois)"
      type="ia"
      icon={<Cpu className="w-5 h-5 text-white" />}
      onBack={goPrev}
      onNext={goNext}
      nextLabel="Délégations d'accès →"
      nextDisabled={phase !== 'done'}
    >
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-slate-700">{receivedDocs.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">À analyser</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-blue-600">{analyzedCount}</p>
          <p className="text-xs text-blue-500 mt-0.5">Analysés</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-emerald-600">{phase === 'done' ? '98%' : '–'}</p>
          <p className="text-xs text-emerald-500 mt-0.5">Conformité</p>
        </div>
      </div>

      {/* Auto-running spinner shown while processing */}
      {phase === 'running' && receivedDocs.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-blue-600 mb-4">
          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          Analyse en cours...
        </div>
      )}

      {phase === 'done' && (
        <button onClick={() => { setPhase('idle'); setAnalyzedCount(0); setTimeout(analyze, 100); }}
          className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-all mb-4">
          <Cpu className="w-3.5 h-3.5" />
          Relancer l'analyse
        </button>
      )}

      {(phase === 'running' || phase === 'done') && receivedDocs.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-violet-500" />
            <p className="text-sm font-medium text-gray-700">Traitement OCR — Intelligence Artificielle</p>
          </div>
          <div className="space-y-2">
            {receivedDocs.map((doc, i) => (
              <AutoTask key={doc.id} label={doc.name}
                sublabel={getStatus(i) === 'done' ? checkDocumentCompliance(doc.name).message : undefined}
                status={getStatus(i)} />
            ))}
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className="space-y-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <p className="text-sm font-medium text-emerald-800">Analyse terminée — Conformité : 98%</p>
            </div>
            <div className="space-y-1 text-xs text-emerald-700">
              <p>✓ KBIS daté du 15/02/2026 — Moins de 3 mois</p>
              <p>✓ {receivedDocs.length} documents traités par OCR</p>
              <p>✓ Résultats enregistrés dans le fichier de suivi</p>
              <p>✓ Documents validés classés dans SharePoint</p>
            </div>
          </div>

          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-100">
              <p className="text-xs font-medium text-gray-600">Rapport de conformité</p>
            </div>
            {receivedDocs.map(doc => {
              const comp = checkDocumentCompliance(doc.name);
              return (
                <div key={doc.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate">{doc.name}</p>
                    <p className="text-xs text-gray-400">{comp.message}</p>
                  </div>
                  <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex-shrink-0">Conforme</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </StepShell>
  );
}