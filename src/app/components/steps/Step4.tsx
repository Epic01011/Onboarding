import { useState } from 'react';
import { FolderOpen, ExternalLink, Folder, CloudOff } from 'lucide-react';
import { useOnboarding } from '../../context/OnboardingContext';
import { useSharePoint } from '../../context/SharePointContext';
import { StepShell, AutoTask, InfoCard } from '../StepShell';
import { createAirtableClientRecord, buildClientFields } from '../../services/airtableApi';
import { useServices } from '../../context/ServicesContext';
import { GED_SUBFOLDERS } from '../../utils/sharepointGed';
import { createClientUploadLink } from '../../utils/sharepointGed';
import { useMicrosoftAuth } from '../../context/MicrosoftAuthContext';
import { toast } from 'sonner';
import { delay } from '../../utils/delay';

type Phase = 'idle' | 'running' | 'done' | 'error';

export function Step4() {
  const { clientData, updateClientData, goNext, goPrev } = useOnboarding();
  const { createClientFolder, isConfigured, configuredSiteName, configuredSiteId } = useSharePoint();
  const { graphToken } = useMicrosoftAuth();
  const { connections } = useServices();

  const [phase, setPhase] = useState<Phase>('idle');
  const [taskIdx, setTaskIdx] = useState(0);
  const [airtableId, setAirtableId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const tasks = [
    {
      label: `Création de la fiche client dans le CRM (Airtable)${
        !connections.airtable.connected ? ' — Mode démo' : ''
      }`,
      sublabel: `Dossier #CAB-${new Date().getFullYear()}-${clientData.siren?.slice(-4) || '0000'}`,
    },
    {
      label: `Création du dossier client dans SharePoint${
        isConfigured ? ` (${configuredSiteName})` : ' — Mode démo'
      }`,
      sublabel: `📁 Clients CabinetFlow / ${clientData.raisonSociale || clientData.nom}`,
    },
    {
      label: 'Création de l\'arborescence (8 sous-dossiers)',
      sublabel: GED_SUBFOLDERS.map(s => s.name).join(' · '),
    },
    {
      label: 'Génération du lien de dépôt client (SharePoint Sharing Link)',
      sublabel: 'Lien anonyme éditable sur 06 - Documents client',
    },
  ];

  const run = async () => {
    setPhase('running');
    setErrorMsg(null);

    // — Tâche 0 : Airtable
    setTaskIdx(0);
    const airtableFields = buildClientFields({
      nom: clientData.nom,
      email: clientData.email,
      telephone: clientData.telephone,
      siren: clientData.siren,
      raisonSociale: clientData.raisonSociale || clientData.nom,
      formeJuridique: clientData.formeJuridique,
      missionType: clientData.missionType,
      prixAnnuel: clientData.prixAnnuel,
      currentStep: 4,
    });
    const airtableResult = await createAirtableClientRecord(airtableFields);
    if (airtableResult.success) {
      setAirtableId(airtableResult.data?.id ?? null);
    }

    // — Tâche 1 : Dossier SharePoint (réel ou démo)
    setTaskIdx(1);
    let folderUrl = clientData.sharepointFolderUrl;
    let folderId = clientData.sharepointFolderId;

    if (isConfigured) {
      try {
        const result = await createClientFolder({
          siren: clientData.siren,
          raisonSociale: clientData.raisonSociale,
          nom: clientData.nom,
        });
        folderUrl = result.folderUrl;
        folderId = result.folderId;
        updateClientData({ sharepointFolderUrl: folderUrl, sharepointFolderId: folderId });
      } catch (err: any) {
        setErrorMsg(err.message || 'Erreur création dossier SharePoint');
        setPhase('error');
        toast.error(err.message || 'Erreur création SharePoint');
        return;
      }
    } else {
      // Mode démo — URL fictive
      folderUrl = `https://cabinet.sharepoint.com/Clients CabinetFlow/${clientData.siren} - ${clientData.raisonSociale || clientData.nom}`;
      folderId = 'demo-' + clientData.siren;
      updateClientData({ sharepointFolderUrl: folderUrl, sharepointFolderId: folderId });
      await delay(900);
    }

    // — Tâche 2 : Sous-dossiers (déjà créés dans provisionClientFolder, on simule la progression)
    setTaskIdx(2);
    await delay(400);

    // — Tâche 3 : Lien de dépôt client (SharePoint Sharing Link)
    setTaskIdx(3);
    let uploadLink = clientData.sharepointUploadLink;

    if (isConfigured && graphToken && configuredSiteId && clientData.siren) {
      try {
        uploadLink = await createClientUploadLink(
          graphToken,
          configuredSiteId,
          clientData.siren,
          clientData.raisonSociale || clientData.nom,
        );
        updateClientData({ sharepointUploadLink: uploadLink });
      } catch {
        // Non bloquant : l'utilisateur peut créer le lien plus tard
        uploadLink = folderUrl;
        updateClientData({ sharepointUploadLink: folderUrl });
      }
    } else {
      uploadLink = `${folderUrl}/06 - Documents client`;
      updateClientData({ sharepointUploadLink: uploadLink });
      await delay(300);
    }

    setTaskIdx(4);
    setPhase('done');
    toast.success('Espace client SharePoint créé avec succès');
  };

  const getStatus = (i: number): 'pending' | 'loading' | 'done' => {
    if (phase === 'idle' || phase === 'error') return 'pending';
    if (i < taskIdx) return 'done';
    if (i === taskIdx && phase === 'running') return 'loading';
    return 'pending';
  };

  // Avertissement si pas de site SharePoint configuré
  const showSpWarning = !isConfigured;

  return (
    <StepShell
      step={4}
      title="Initialisation de l'Espace Client"
      subtitle="Création de la fiche CRM (Airtable) et de l'arborescence documentaire Microsoft SharePoint"
      type="automatisé"
      icon={<FolderOpen className="w-5 h-5 text-white" />}
      onBack={goPrev}
      onNext={goNext}
      nextLabel={clientData.missionType === 'reprise' ? 'Gestion déontologique →' : 'Contractualisation →'}
      nextDisabled={phase !== 'done'}
    >
      {/* Récap client */}
      <div className="grid grid-cols-2 gap-2 mb-5">
        <InfoCard label="Société" value={clientData.raisonSociale || clientData.nom} />
        <InfoCard label="SIREN" value={clientData.siren.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')} mono />
        <InfoCard label="Forme juridique" value={clientData.formeJuridique || '–'} />
        <InfoCard label="Mission" value={clientData.missionType === 'creation' ? '🏗️ Création' : '🔄 Reprise'} />
      </div>

      {/* Statuts services */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {[
          { label: 'Airtable CRM', connected: connections.airtable.connected },
          { label: `SharePoint${isConfigured ? ` (${configuredSiteName})` : ''}`, connected: isConfigured },
        ].map(svc => (
          <div
            key={svc.label}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
              svc.connected
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${svc.connected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {svc.label} {svc.connected ? '(Live)' : '(Démo)'}
          </div>
        ))}
      </div>

      {/* Alerte si SharePoint non configuré */}
      {showSpWarning && phase === 'idle' && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-700">
          <CloudOff className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
          <div>
            Aucun site SharePoint configuré. L'espace client sera créé en{' '}
            <strong>mode démo</strong> (URL fictive).
            <a href="/ged" target="_blank" rel="noreferrer" className="ml-1 underline">
              Configurer la GED →
            </a>
          </div>
        </div>
      )}

      {/* Aperçu arborescence */}
      {phase === 'idle' && (
        <div className="mb-5">
          <p className="text-sm text-gray-600 mb-2">Arborescence SharePoint à créer :</p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Folder className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-slate-700">
                Clients CabinetFlow / {clientData.raisonSociale || clientData.nom || '[Société]'}
              </span>
            </div>
            {GED_SUBFOLDERS.map(f => (
              <div key={f.name} className="flex items-center gap-2 ml-6 py-0.5 text-xs text-slate-500">
                <span>{f.icon}</span>
                <span className="font-medium">{f.name}</span>
                <span className="text-slate-400">— {f.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bouton lancement */}
      {phase === 'idle' && (
        <button
          onClick={run}
          className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white py-3 rounded-xl text-sm font-medium transition-all shadow-sm mb-5"
        >
          <FolderOpen className="w-4 h-4" />
          Initialiser l'espace client (Airtable + SharePoint)
        </button>
      )}

      {/* Tâches */}
      {(phase === 'running' || phase === 'done' || phase === 'error') && (
        <div className="space-y-2.5 mb-5">
          {tasks.map((t, i) => (
            <AutoTask
              key={i}
              label={t.label}
              sublabel={getStatus(i) !== 'pending' ? t.sublabel : undefined}
              status={getStatus(i)}
            />
          ))}
        </div>
      )}

      {/* Erreur */}
      {phase === 'error' && errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <p className="text-sm text-red-700">❌ {errorMsg}</p>
          <button onClick={run} className="mt-2 text-xs text-red-600 underline">Réessayer</button>
        </div>
      )}

      {/* Résultat */}
      {phase === 'done' && (
        <div className="space-y-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <p className="text-sm font-medium text-emerald-800 mb-2">✅ Espace client créé avec succès</p>
            <p className="text-xs text-emerald-700 font-mono break-all">{clientData.sharepointFolderUrl}</p>
            {airtableId && (
              <p className="text-xs text-emerald-600 mt-1">Airtable Record ID : {airtableId}</p>
            )}
          </div>

          {clientData.sharepointUploadLink && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-xs font-medium text-blue-800 mb-1">🔗 Lien de dépôt client (06 - Documents client)</p>
              <p className="text-xs text-blue-600 font-mono break-all">{clientData.sharepointUploadLink}</p>
              <p className="text-xs text-blue-500 mt-1">
                Ce lien sera inclus automatiquement dans la demande documentaire (étape 3 / 7).
              </p>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <a
              href={clientData.sharepointFolderUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline bg-blue-50 px-3 py-2 rounded-lg"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Ouvrir le dossier SharePoint
            </a>
            {clientData.sharepointUploadLink && (
              <a
                href={clientData.sharepointUploadLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-emerald-600 hover:underline bg-emerald-50 px-3 py-2 rounded-lg"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Lien dépôt client
              </a>
            )}
          </div>
        </div>
      )}
    </StepShell>
  );
}
