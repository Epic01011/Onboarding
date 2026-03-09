import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface ApiSetupGuideProps {
  serviceName: string;
  steps: string[];
  credentialsUrl: string;
  onTest?: () => Promise<boolean>;
  lastSync?: string;
  isConnected: boolean;
}

export function ApiSetupGuide({ 
  serviceName, 
  steps, 
  credentialsUrl, 
  onTest,
  lastSync,
  isConnected 
}: ApiSetupGuideProps) {
  const [expanded, setExpanded] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const handleTest = async () => {
    if (!onTest) return;
    setTesting(true);
    setTestResult(null);
    try {
      const success = await onTest();
      setTestResult(success ? 'success' : 'error');
      setTimeout(() => setTestResult(null), 3000);
    } catch {
      setTestResult('error');
      setTimeout(() => setTestResult(null), 3000);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="mt-3 border border-slate-600 rounded-xl overflow-hidden bg-slate-800/30">
      {/* Header collapsible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-blue-400 font-medium">📖 Guide de configuration</span>
          {isConnected && lastSync && (
            <span className="text-slate-500">
              · Dernière sync: {new Date(lastSync).toLocaleString('fr-FR')}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {/* Content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-600/50 pt-3">
          {/* Steps */}
          <div>
            <p className="text-xs text-slate-300 font-medium mb-2">Étapes de configuration:</p>
            <ol className="space-y-1.5">
              {steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                  <span className="flex-shrink-0 w-5 h-5 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center text-[10px] font-medium">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Link to credentials page */}
          <a
            href={credentialsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Accéder à la page des identifiants {serviceName}
          </a>

          {/* Test connection button */}
          {onTest && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleTest}
                disabled={testing}
                className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-700/50 text-white text-xs px-3 py-2 rounded-lg transition-all disabled:cursor-not-allowed"
              >
                {testing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Test en cours...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Tester la connexion
                  </>
                )}
              </button>

              {/* Test result */}
              {testResult === 'success' && (
                <span className="flex items-center gap-1 text-xs text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Connexion réussie
                </span>
              )}
              {testResult === 'error' && (
                <span className="flex items-center gap-1 text-xs text-red-400">
                  <XCircle className="w-3.5 h-3.5" />
                  Échec de connexion
                </span>
              )}
            </div>
          )}

          {/* Security note */}
          <div className="bg-slate-700/30 border border-slate-600/50 rounded-lg p-2.5 flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-slate-400">
              Vos clés API sont masquées après sauvegarde (affichage •••• uniquement).
              Stockage local sécurisé dans votre navigateur.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
