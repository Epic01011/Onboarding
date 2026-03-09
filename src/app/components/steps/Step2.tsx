import { useState } from 'react';
import { Search, CheckCircle2, XCircle, RefreshCw, Globe, AlertTriangle, Wifi } from 'lucide-react';
import { useOnboarding } from '../../context/OnboardingContext';
import { StepShell, AutoTask, InfoCard } from '../StepShell';
import { fetchBySIREN, SirenData, SirenSource } from '../../services/sirenApi';

type Phase = 'idle' | 'calling' | 'done' | 'error';

// Labels UI pour chaque source
const SOURCE_LABEL: Record<SirenSource, { badge: string; color: string; msg: string }> = {
  api_direct: {
    badge: '🟢 API Directe',
    color: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
    msg: "Données récupérées en temps réel via l'API officielle du gouvernement.",
  },
  api_proxy: {
    badge: '🔵 API via Proxy',
    color: 'bg-blue-50 text-blue-600 border border-blue-200',
    msg: 'Données récupérées via un proxy CORS (appel direct bloqué par le navigateur).',
  },
  demo: {
    badge: '🟡 Démo',
    color: 'bg-amber-50 text-amber-600 border border-amber-200',
    msg: 'Mode démonstration — API inaccessible.',
  },
};

export function Step2() {
  const { clientData, updateClientData, goNext, goPrev } = useOnboarding();
  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [apiSource, setApiSource] = useState<SirenSource>('api_direct');
  const [tryCount, setTryCount] = useState<number>(0);

  const callAPI = async () => {
    const siren = clientData.siren.replace(/\s/g, '');
    setPhase('calling');
    setErrorMsg('');
    setTryCount((c) => c + 1);

    const result = await fetchBySIREN(siren);

    if (result.success) {
      const d: SirenData = result.data;
      updateClientData({
        siret: d.siret,
        codeNAF: d.codeNAF,
        libelleNAF: d.libelleNAF,
        capital: d.capitalSocial,
        adresse: d.adresse,
        codePostal: d.codePostal,
        ville: d.ville,
        raisonSociale: d.nomComplet,
        formeJuridique: d.formeJuridique,
        dateCreation: d.dateCreation,
        effectif: d.effectif,
      });
      setApiSource(result.source);
      setPhase('done');
    } else {
      setErrorMsg(result.error);
      setPhase('error');
    }
  };

  const reset = () => {
    setPhase('idle');
    setErrorMsg('');
  };

  // Mode saisie manuelle — permet de continuer même si l'API est KO
  const useManualMode = () => {
    updateClientData({
      siret: clientData.siren.replace(/\s/g, '') + '00017',
      codeNAF: '',
      libelleNAF: '',
      capital: '',
      adresse: '',
      codePostal: '',
      ville: '',
      raisonSociale: '',
      formeJuridique: '',
      dateCreation: '',
      effectif: '',
    });
    setApiSource('demo');
    setPhase('done');
  };

  const src = SOURCE_LABEL[apiSource];

  return (
    <StepShell
      step={2}
      title="Vérification SIREN — Répertoire des Entreprises"
      subtitle="Interrogation en temps réel de l'API gouvernementale (recherche-entreprises.api.gouv.fr) — aucune clé API requise"
      type="automatisé"
      icon={<Search className="w-5 h-5 text-white" />}
      onBack={goPrev}
      onNext={goNext}
      nextLabel="Demande documentaire →"
      nextDisabled={phase !== 'done'}
    >
      {/* ── Bloc SIREN + bouton d'appel ── */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-blue-500" />
              <p className="text-xs sm:text-sm text-gray-500">
                API :{' '}
                <code className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-xs sm:text-sm">
                  recherche-entreprises.api.gouv.fr
                </code>
              </p>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mb-2">SIREN à interroger</p>
            <p className="text-xl sm:text-2xl font-mono tracking-widest text-slate-800">
              {clientData.siren
                .replace(/\s/g, '')
                .replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')}
            </p>
          </div>

          <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-row sm:gap-3">
            {(phase === 'idle' || phase === 'error') && (
              <button
                onClick={callAPI}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm flex-1 sm:flex-none"
              >
                {phase === 'error' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                {phase === 'error'
                  ? tryCount >= 2
                    ? 'Réessayer (proxy)'
                    : 'Réessayer'
                  : 'Interroger API SIREN'}
              </button>
            )}
            {phase === 'done' && (
              <button
                onClick={reset}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-xs transition-all flex-1 sm:flex-none"
              >
                <RefreshCw className="w-4 h-4" />
                Relancer
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Tâches en cours ── */}
      {phase !== 'idle' && (
        <div className="space-y-3 mb-6">
          <AutoTask
            label="Requête GET → recherche-entreprises.api.gouv.fr"
            sublabel={
              phase === 'calling'
                ? `Recherche SIREN ${clientData.siren}…`
                : phase === 'error'
                ? 'Échec — voir message ci-dessous'
                : 'Réponse reçue'
            }
            status={phase === 'calling' ? 'loading' : phase === 'error' ? 'error' : 'done'}
          />
          {phase === 'done' && (
            <AutoTask
              label="Extraction des données légales"
              sublabel="Raison sociale, SIRET, forme juridique, NAF, adresse, capital"
              status="done"
            />
          )}
        </div>
      )}

      {/* ── Badge source (succès) ── */}
      {phase === 'done' && (
        <div className="flex flex-wrap items-center gap-3 mb-6 p-3 bg-white border rounded-lg">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          <p className="text-sm font-medium text-gray-700">Données récupérées</p>
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${src.color}`}>
            {src.badge}
          </span>
          {apiSource === 'api_proxy' && (
            <span className="text-xs text-blue-500 flex items-center gap-1 px-2 py-1 bg-blue-50 rounded-full">
              <Wifi className="w-3.5 h-3.5" /> proxy actif
            </span>
          )}
        </div>
      )}

      {/* ── Avertissement proxy ── */}
      {phase === 'done' && apiSource === 'api_proxy' && (
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <Wifi className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-700 mb-1">
              Proxy CORS activé
            </p>
            <p className="text-xs text-blue-600">
              L'appel direct a été bloqué (CORS). Données via proxy. En prod, configurez serveur backend.
            </p>
          </div>
        </div>
      )}

      {/* ── Données récupérées ── */}
      {phase === 'done' && (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            <InfoCard label="Raison Sociale / Nom" value={clientData.raisonSociale || '—'} />
            <InfoCard label="Forme Juridique" value={clientData.formeJuridique || '—'} />
            <InfoCard
              label="SIRET (siège)"
              value={clientData.siret.replace(/(\d{9})(\d{5})/, '$1 $2')}
              mono
            />
            <InfoCard
              label="Code NAF / APE"
              value={
                clientData.codeNAF
                  ? `${clientData.codeNAF} — ${clientData.libelleNAF}`
                  : '—'
              }
            />
            <InfoCard
              label="Adresse complète"
              value={
                clientData.adresse
                  ? `${clientData.adresse}, ${clientData.codePostal} ${clientData.ville}`
                  : '—'
              }
            />
            <InfoCard label="Capital social" value={clientData.capital || '—'} />
            <InfoCard label="Date de création" value={clientData.dateCreation || '—'} />
            <InfoCard label="Effectif" value={clientData.effectif || '—'} />
          </div>

          <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-emerald-700 mb-1">
                Données enrichies et prêtes
              </p>
              <p className="text-xs text-emerald-600">
                Vérifiez les informations ci-dessus avant de continuer vers la demande documentaire.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Erreur API ── */}
      {phase === 'error' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-5">
            <XCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
            <div>
              <p className="text-lg font-semibold text-red-700">API SIREN inaccessible</p>
              <p className="text-sm text-red-600 mt-1">{errorMsg}</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 bg-amber-50 border border-amber-200 rounded-xl p-5">
            <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-1" />
            <div className="flex-1 space-y-2">
              <p className="font-semibold text-amber-700 text-sm">Solutions :</p>
              <ul className="space-y-1 text-xs text-amber-700 list-disc list-inside">
                <li>Cliquez <strong>Réessayer</strong> (proxy auto après 2 essais).</li>
                <li>Vérifiez connexion internet / VPN.</li>
                <li>
                  Ou <button
                    onClick={useManualMode}
                    className="underline font-semibold hover:text-amber-900 transition-colors"
                  >
                    saisie manuelle
                  </button>
                  (pré-rempli étape suivante).
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </StepShell>
  );
}
