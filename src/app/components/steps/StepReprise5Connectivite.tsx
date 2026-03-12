import { useState } from 'react';
import { Database, Loader2, Archive, CreditCard, FileCheck, CheckSquare, Square } from 'lucide-react';
import { useOnboarding } from '../../context/OnboardingContext';
import { StepShell } from '../StepShell';
import { toast } from 'sonner';

interface Task {
  id: string;
  label: string;
  sublabel: string;
  type: 'api' | 'manual';
  done: boolean;
  loading?: boolean;
}

export function StepReprise5Connectivite() {
  const { clientData, updateClientData, goNext } = useOnboarding();

  const [tasks, setTasks] = useState<Task[]>([
    {
      id: 'pennylane',
      label: 'Créer le client dans Pennylane',
      sublabel: 'Action API — Provisionnement automatique',
      type: 'api',
      done: clientData.pennylaneCreated,
    },
    {
      id: 'sharepoint',
      label: 'Archiver la LDM signée dans SharePoint',
      sublabel: 'Action API — Dépôt dans le dossier client',
      type: 'api',
      done: !!clientData.lettreMissionSharepointUrl,
    },
    {
      id: 'billing',
      label: "Créer l'abonnement de facturation",
      sublabel: 'Action manuelle — À valider dans votre outil de facturation',
      type: 'manual',
      done: false,
    },
    {
      id: 'sepa',
      label: 'Valider le mandat de prélèvement SEPA',
      sublabel: 'Action manuelle — Vérifier la signature du mandat',
      type: 'manual',
      done: clientData.pennylaneMandat === 'signed',
    },
  ]);

  const allDone = tasks.every(t => t.done);

  const handleToggle = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    if (task.type === 'manual') {
      const nowDone = !task.done;
      setTasks(prev => prev.map(t => t.id === id ? { ...t, done: nowDone } : t));
      if (id === 'sepa') {
        updateClientData({ pennylaneMandat: nowDone ? 'signed' : 'pending' });
      }
      return;
    }

    // API action — simulate with a loading state
    setTasks(prev => prev.map(t => t.id === id ? { ...t, loading: true } : t));
    try {
      if (id === 'pennylane') {
        await new Promise(resolve => setTimeout(resolve, 1500));
        updateClientData({ pennylaneCreated: true, pennylaneClientId: `PNY-${Date.now()}` });
        toast.success('Client créé dans Pennylane');
      } else if (id === 'sharepoint') {
        await new Promise(resolve => setTimeout(resolve, 1200));
        updateClientData({
          lettreMissionSharepointUrl: `https://sharepoint.com/dossiers/${clientData.siren || 'new'}`,
        });
        toast.success('LDM archivée dans SharePoint');
      }
      setTasks(prev => prev.map(t => t.id === id ? { ...t, done: true, loading: false } : t));
    } catch {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, loading: false } : t));
      toast.error("Erreur lors de l'action");
    }
  };

  const getTaskIcon = (task: Task) => {
    if (task.id === 'pennylane') return <Database className="w-4 h-4" />;
    if (task.id === 'sharepoint') return <Archive className="w-4 h-4" />;
    if (task.id === 'billing') return <CreditCard className="w-4 h-4" />;
    if (task.id === 'sepa') return <FileCheck className="w-4 h-4" />;
    return <CheckSquare className="w-4 h-4" />;
  };

  return (
    <StepShell
      step={5}
      title="Connectivité & Pennylane"
      subtitle="Configurez les intégrations et validez les prérequis de facturation."
      type="conditionnel"
      icon={<Database className="w-5 h-5 text-white" />}
      onNext={goNext}
      nextDisabled={!allDone}
      skipLabel="Passer — à compléter ultérieurement →"
    >
      <div className="space-y-3">
        {tasks.map(task => (
          <div
            key={task.id}
            className={`flex items-start gap-3 p-4 rounded-xl border transition-all ${
              task.done ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="mt-0.5 flex-shrink-0">
              {task.loading ? (
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
              ) : task.done ? (
                <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-medium ${task.done ? 'text-emerald-700' : 'text-gray-900'}`}
                >
                  {task.label}
                </span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                    task.type === 'api'
                      ? 'bg-violet-100 text-violet-600'
                      : 'bg-blue-100 text-blue-600'
                  }`}
                >
                  {task.type === 'api' ? 'API' : 'Manuel'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{task.sublabel}</p>
            </div>

            <button
              onClick={() => handleToggle(task.id)}
              disabled={task.loading}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                task.done
                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                  : task.type === 'api'
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {task.loading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : task.done ? (
                <>{getTaskIcon(task)} Fait</>
              ) : task.type === 'api' ? (
                <>{getTaskIcon(task)} Exécuter</>
              ) : (
                <>{task.done ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />} Cocher</>
              )}
            </button>
          </div>
        ))}

        {allDone && (
          <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded-xl text-center">
            <p className="text-sm font-medium text-blue-800">
              ✅ Toutes les intégrations sont configurées !
            </p>
          </div>
        )}
      </div>
    </StepShell>
  );
}
