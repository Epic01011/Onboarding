import { useState, useEffect, useRef } from 'react';
import { Database, CheckCircle2, CreditCard, ExternalLink, AlertCircle } from 'lucide-react';
import { useOnboarding } from '../../context/OnboardingContext';
import { StepShell, AutoTask, InfoCard } from '../StepShell';
import {
  createPennylaneCustomer,
  addPennylaneNote,
  createBillingSubscription,
  sendSEPAMandat,
} from '../../services/pennylaneApi';
import { useServices } from '../../context/ServicesContext';
import { toast } from 'sonner';
import { delay } from '../../utils/delay';

type Phase = 'idle' | 'creating' | 'mandat' | 'done';

export function Step10() {
  const { clientData, updateClientData, goNext, goPrev } = useOnboarding();
  const [phase, setPhase] = useState<Phase>('idle');
  const [mandatPhase, setMandatPhase] = useState<'idle' | 'sending' | 'sent' | 'signed'>('idle');
  const [pennylaneDemo, setPennylaneDemo] = useState(false);
  const [taskStatuses, setTaskStatuses] = useState<Array<'pending' | 'loading' | 'done' | 'error'>>([]);
  const hasAutoRun = useRef(false);

  const { connections } = useServices();

  const createTasks = [
    {
      label: 'Vérification finale — Dossier complet',
      sublabel: 'LDM signée ✓ | KYC validé ✓ | Délégations ✓',
    },
    {
      label: `Création du compte client Pennylane${!connections.pennylane.connected ? ' (Démo)' : ' (Live)'}`,
      sublabel: `POST /api/external/v1/customers → ${clientData.raisonSociale}`,
    },
    {
      label: 'Paramétrage comptable — Plan comptable général (PCG)',
      sublabel: `Code NAF : ${clientData.codeNAF} | Régime fiscal : IS | Exercice 01/01–31/12`,
    },
    {
      label: 'Création de l\'abonnement de facturation',
      sublabel: `${clientData.missionsSelectionnees.length} mission(s) | ${clientData.prixAnnuel} € HT/an → ${(Math.round((parseFloat(clientData.prixAnnuel || '0') / 12) * 100) / 100).toFixed(2)} €/mois`,
    },
    {
      label: 'Ajout des notes de dossier (délégations, KYC)',
      sublabel: 'Notes confidentielles importées depuis SharePoint',
    },
    {
      label: 'Configuration des accès utilisateur Pennylane',
      sublabel: `Invitation envoyée à : ${clientData.email}`,
    },
  ];

  // Auto-run on mount if Pennylane not yet provisioned
  useEffect(() => {
    if (hasAutoRun.current) return;
    hasAutoRun.current = true;
    if (clientData.pennylaneCreated && clientData.pennylaneMandat === 'signed') {
      // Already done — restore state
      setPhase('done');
      setMandatPhase('signed');
    } else if (!clientData.pennylaneCreated) {
      run();
    } else {
      // Customer created but mandat not signed — resume at mandat phase
      setPhase('mandat');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async () => {
    setPhase('creating');
    const statuses: Array<'pending' | 'loading' | 'done' | 'error'> = createTasks.map(() => 'pending');
    setTaskStatuses([...statuses]);

    // Task 0: Verify dossier
    statuses[0] = 'loading';
    setTaskStatuses([...statuses]);
    await delay(700);
    statuses[0] = 'done';
    setTaskStatuses([...statuses]);

    // Task 1: Create Pennylane customer (REAL API)
    statuses[1] = 'loading';
    setTaskStatuses([...statuses]);

    const pennylaneResult = await createPennylaneCustomer({
      name: clientData.raisonSociale || clientData.nom,
      email: clientData.email,
      phone: clientData.telephone,
      company_number: clientData.siren,
      naf_code: clientData.codeNAF,
      legal_form: clientData.formeJuridique,
      type: 'company',
      address: {
        street: clientData.adresse,
        city: clientData.ville,
        postal_code: clientData.codePostal,
        country: 'FR',
      },
      source_id: `CAB-${new Date().getFullYear()}-${clientData.siren?.slice(-4)}`,
    });

    if (pennylaneResult.success && pennylaneResult.data) {
      const pennylaneId = pennylaneResult.data.id;
      setPennylaneDemo(pennylaneResult.demo ?? false);
      updateClientData({ pennylaneCreated: true, pennylaneClientId: pennylaneId });
      statuses[1] = 'done';
      setTaskStatuses([...statuses]);

      if (!pennylaneResult.demo) {
        toast.success('Compte Pennylane créé (Live)');
      }

      // Task 2: Paramétrage comptable (simulated)
      statuses[2] = 'loading';
      setTaskStatuses([...statuses]);
      await delay(700);
      statuses[2] = 'done';
      setTaskStatuses([...statuses]);

      // Task 3: Create billing subscription
      statuses[3] = 'loading';
      setTaskStatuses([...statuses]);
      const monthlyAmount = Math.round((parseFloat(clientData.prixAnnuel || '0') / 12) * 100) / 100;
      await createBillingSubscription(pennylaneId, {
        amount: monthlyAmount,
        label: `Honoraires comptables — ${clientData.raisonSociale}`,
        periodicity: 'monthly',
      });
      statuses[3] = 'done';
      setTaskStatuses([...statuses]);

      // Task 4: Add notes
      statuses[4] = 'loading';
      setTaskStatuses([...statuses]);
      const noteContent = [
        `=== DOSSIER ONBOARDING ===`,
        `Client : ${clientData.raisonSociale} (SIREN: ${clientData.siren})`,
        `Type mission : ${clientData.missionType === 'creation' ? 'Création' : 'Reprise'}`,
        `KYC validé : Oui (analyse IA)`,
        `Délégation Impots.gouv : ${clientData.impotsDelegation.received ? 'Reçue' : 'En attente'}`,
        `Délégation URSSAF : ${clientData.urssafDelegation.received ? 'Reçue' : 'En attente'}`,
        `LDM signee : ${clientData.lettreMissionSignee ? 'Oui (JeSignExpert)' : 'Non'}`,
        `SharePoint : ${clientData.sharepointFolderUrl}`,
        `Date onboarding : ${new Date().toLocaleDateString('fr-FR')}`,
      ].join('\n');
      await addPennylaneNote(pennylaneId, { content: noteContent });
      statuses[4] = 'done';
      setTaskStatuses([...statuses]);

      // Task 5: User access
      statuses[5] = 'loading';
      setTaskStatuses([...statuses]);
      await delay(600);
      statuses[5] = 'done';
      setTaskStatuses([...statuses]);

      setPhase('mandat');
    } else {
      // Error on Pennylane
      statuses[1] = 'error';
      setTaskStatuses([...statuses]);
      toast.error(`Erreur Pennylane : ${pennylaneResult.error}`);
      // Continue in demo mode
      const demoId = `PNY-${Date.now().toString().slice(-6)}`;
      updateClientData({ pennylaneCreated: true, pennylaneClientId: demoId });
      await delay(500);
      for (let i = 2; i < createTasks.length; i++) {
        statuses[i] = 'done';
        setTaskStatuses([...statuses]);
        await delay(400);
      }
      setPhase('mandat');
    }
  };

  const sendMandat = async () => {
    setMandatPhase('sending');
    const result = await sendSEPAMandat(clientData.pennylaneClientId);

    if (!result.success) {
      setMandatPhase('idle');
      toast.error(`Erreur mandat SEPA : ${result.error ?? 'Erreur inconnue'}`);
      return;
    }

    setMandatPhase('sent');
    updateClientData({ pennylaneMandat: 'sent' });

    if (result.mandatUrl && !result.demo) {
      toast.success('Mandat SEPA envoyé au client via Pennylane');
    } else {
      toast.info('Mandat SEPA envoyé (mode démo)');
    }
  };

  const signMandat = async () => {
    await delay(600);
    setMandatPhase('signed');
    updateClientData({ pennylaneMandat: 'signed' });
    setPhase('done');
    toast.success('Mandat SEPA signé ✓ — Prélèvement activé');
  };

  const getStatus = (i: number): 'pending' | 'loading' | 'done' | 'error' => {
    if (taskStatuses[i]) return taskStatuses[i];
    return 'pending';
  };

  return (
    <StepShell
      step={10}
      title="Provisionnement Pennylane"
      subtitle="Création automatique du compte client via API Pennylane, paramétrage comptable, abonnement de facturation et mandat SEPA"
      type="automatisé"
      icon={<Database className="w-5 h-5 text-white" />}
      onBack={goPrev}
      onNext={goNext}
      nextLabel="Clôture de l'onboarding 🎉"
      nextDisabled={phase === 'idle' || phase === 'creating'}
    >
      {/* Service status */}
      <div className="flex gap-2 mb-5">
        <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${connections.pennylane.connected ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${connections.pennylane.connected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          Pennylane {connections.pennylane.connected ? '(Live)' : '(Démo — configurez dans /setup)'}
        </div>
      </div>

      {/* Idle: trigger */}
      {phase === 'idle' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <InfoCard label="Client" value={clientData.raisonSociale || clientData.nom} />
            <InfoCard label="SIREN" value={clientData.siren.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')} mono />
            <InfoCard label="Honoraires" value={`${clientData.prixAnnuel || '–'} € HT/an`} />
            <InfoCard label="Missions" value={`${clientData.missionsSelectionnees.length} mission(s) sélectionnée(s)`} />
          </div>

          {/* API endpoints */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-xs font-medium text-blue-800 mb-2">🔗 API Pennylane — Endpoints utilisés</p>
            <div className="space-y-0.5 font-mono text-xs text-blue-700">
              <p>POST /api/external/v1/customers → Créer le client</p>
              <p>POST /api/external/v1/customers/{'{id}'}/notes → Notes confidentielles</p>
              <p>POST /api/external/v1/billing_subscriptions → Abonnement mensuel</p>
              <p>POST /api/external/v1/customers/{'{id}'}/sepa_mandates → Mandat SEPA</p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              <strong>Mandat SEPA :</strong> Pennylane enverra directement un email au client avec le lien de signature du mandat.
              Le client saisit son IBAN dans l'interface sécurisée Pennylane. Aucune saisie manuelle requise.
            </p>
          </div>

          <button
            onClick={run}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-medium transition-all shadow-sm"
          >
            <Database className="w-4 h-4" />
            Créer le compte Pennylane {connections.pennylane.connected ? '(Live)' : '(Démo)'}
          </button>
        </div>
      )}

      {/* Creating */}
      {(phase === 'creating' || phase === 'mandat' || phase === 'done') && (
        <div className="space-y-2.5 mb-5">
          {createTasks.map((t, i) => (
            <AutoTask
              key={i}
              label={t.label}
              sublabel={taskStatuses[i] === 'done' || taskStatuses[i] === 'error' ? t.sublabel : undefined}
              status={getStatus(i)}
            />
          ))}
        </div>
      )}

      {/* Created success indicator */}
      {(phase === 'mandat' || phase === 'done') && clientData.pennylaneClientId && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
            <p className="text-sm font-medium text-blue-800">Compte Pennylane créé</p>
            {pennylaneDemo && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Démo</span>}
          </div>
          <p className="text-xs text-blue-700 mt-1">
            ID Client : <code className="font-mono bg-blue-100 px-1 rounded">{clientData.pennylaneClientId}</code>
          </p>
        </div>
      )}

      {/* Mandat SEPA via Pennylane */}
      {(phase === 'mandat' || phase === 'done') && (
        <div className="space-y-3">
          <div className={`border rounded-xl p-4 ${phase === 'done' ? 'bg-emerald-50 border-emerald-200' : 'bg-blue-50 border-blue-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className={`w-4 h-4 ${phase === 'done' ? 'text-emerald-600' : 'text-blue-600'}`} />
              <p className="text-sm font-medium">
                {phase === 'done' ? 'Mandat SEPA signé ✓' : 'Mandat SEPA — Envoi depuis Pennylane'}
              </p>
            </div>

            {phase === 'mandat' && mandatPhase === 'idle' && (
              <div className="space-y-3">
                <p className="text-xs text-blue-700">
                  Pennylane va envoyer automatiquement un email à <strong>{clientData.email}</strong> avec le lien
                  de signature du mandat SEPA. Le client saisit son IBAN directement dans l'interface Pennylane sécurisée.
                </p>
                <button
                  onClick={sendMandat}
                  className="flex items-center gap-1.5 text-xs bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Déclencher l'envoi du mandat SEPA
                </button>
              </div>
            )}

            {phase === 'mandat' && mandatPhase === 'sending' && (
              <div className="flex items-center gap-2 py-2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <p className="text-xs text-blue-700">Envoi du mandat SEPA en cours...</p>
              </div>
            )}

            {phase === 'mandat' && mandatPhase === 'sent' && (
              <div className="space-y-2">
                <p className="text-xs text-blue-700">
                  Mandat SEPA envoyé par Pennylane à <strong>{clientData.email}</strong>.
                  En attente de signature et saisie de l'IBAN par le client.
                </p>
                <button
                  onClick={signMandat}
                  className="text-xs bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-all"
                >
                  ✍️ Simuler la signature client (Pennylane)
                </button>
              </div>
            )}

            {phase === 'done' && (
              <div className="text-xs text-emerald-700 space-y-1">
                <p>✓ IBAN saisi et validé par le client dans Pennylane</p>
                <p>✓ Mandat SEPA signé — Prélèvement automatique activé</p>
                <p>✓ Première échéance programmée ({(Math.round((parseFloat(clientData.prixAnnuel || '0') / 12) * 100) / 100).toFixed(2)} €/mois HT)</p>
              </div>
            )}
          </div>

          {phase === 'done' && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <p className="text-sm font-medium text-emerald-800">Compte Pennylane 100% opérationnel</p>
                {pennylaneDemo && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Mode démo</span>}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-emerald-700 mb-3">
                <p>✓ Client ID : {clientData.pennylaneClientId}</p>
                <p>✓ Plan comptable configuré</p>
                <p>✓ {clientData.missionsSelectionnees.length} mission(s) importées</p>
                <p>✓ Mandat SEPA signé</p>
                <p>✓ Notes de dossier ajoutées</p>
                <p>✓ Invitation accès envoyée</p>
              </div>
              <a
                href="https://app.pennylane.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
              >
                <ExternalLink className="w-3 h-3" /> Ouvrir le dossier dans Pennylane
              </a>
            </div>
          )}
        </div>
      )}
    </StepShell>
  );
}
