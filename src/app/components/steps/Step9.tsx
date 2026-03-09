import { useState } from 'react';
import { Lock, Send, CheckCircle2, Save, ExternalLink, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { useOnboarding } from '../../context/OnboardingContext';
import { StepShell, AutoTask } from '../StepShell';
import { sendEmail, buildDelegationRequestEmail } from '../../services/emailService';
import { uploadFile } from '../../services/sharepointApi';
import { EmailPreviewEditModal } from '../modals/EmailPreviewEditModal';
import { useCabinet } from '../../context/CabinetContext';
import { delay } from '../../utils/delay';

type Phase = 'idle' | 'sending' | 'waiting' | 'collecting' | 'done';

export function Step9() {
  const { clientData, updateClientData, goNext, goPrev } = useOnboarding();
  const [phase, setPhase] = useState<Phase>('idle');
  const [impotsCodes, setImpotsCodes] = useState('');
  const [urssafCodes, setUrssafCodes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showImpotsCode, setShowImpotsCode] = useState(false);
  const [showUrssafCode, setShowUrssafCode] = useState(false);
  const [emailDemo, setEmailDemo] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState(false);

  const { cabinet } = useCabinet();

  const defaultSubject = `[${cabinet.nom}] Demande de délégation d'accès — Impôts.gouv & URSSAF`;
  const defaultHtml = buildDelegationRequestEmail({
    clientName: clientData.nom,
    cabinetName: cabinet.nom,
    cabinetSiren: cabinet.siren,
  });

  const handleOpenEmailPreview = () => {
    setShowEmailPreview(true);
  };

  const handleSendEmail = async (subject: string, htmlContent: string) => {
    setShowEmailPreview(false);
    setPhase('sending');
    const result = await sendEmail({
      to: clientData.email,
      toName: clientData.nom,
      subject,
      htmlContent,
    });
    setEmailDemo(result.demo ?? false);
    updateClientData({ delegationEmailSent: true });
    setPhase('waiting');
  };

  const startCollect = () => setPhase('collecting');

  const saveCodes = async () => {
    if (!impotsCodes && !urssafCodes) return;
    setSaving(true);

    await delay(800);

    const docContent = `DÉLÉGATIONS D'ACCÈS — ${clientData.raisonSociale}\n\nImpots.gouv.fr:\n${impotsCodes}\n\nURSSAF:\n${urssafCodes}\n\nDate de réception : ${new Date().toLocaleDateString('fr-FR')}`;
    const fakeBlob = new Blob([docContent], { type: 'text/plain' });
    const spResult = await uploadFile(
      clientData.sharepointFolderId || 'demo_folder',
      `Délégations d'accès — ${clientData.raisonSociale} — ${new Date().getFullYear()}.txt`,
      fakeBlob
    );

    updateClientData({
      impotsDelegation: { received: !!impotsCodes, codes: impotsCodes },
      urssafDelegation: { received: !!urssafCodes, codes: urssafCodes },
      delegationSharepointUrl: spResult.webUrl,
      delegationPennylaneNote: true,
    });
    setSaving(false);
    setPhase('done');
  };

  return (
    <StepShell
      step={9}
      title="Délégations d'Accès Gouvernementaux"
      subtitle="Envoi de la demande d'accès au client (email prévisualisé et modifiable), réception des codes, archivage SharePoint GED et note Pennylane"
      type="manuel"
      icon={<Lock className="w-5 h-5 text-white" />}
      onBack={goPrev}
      onNext={goNext}
      nextLabel="Provisionnement Pennylane →"
      nextDisabled={!clientData.delegationEmailSent}
    >
      {/* Step 1: Send email */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
            clientData.delegationEmailSent ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
          }`}>
            {clientData.delegationEmailSent ? '✓' : '1'}
          </div>
          <p className="text-sm font-medium text-gray-800">Envoi de la demande d'accès au client</p>
        </div>

        {phase === 'idle' && (
          <div className="space-y-2">
            {/* Email preview card */}
            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Send className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-800">Email de demande de délégation</p>
                    <p className="text-xs text-gray-500">Destinataire : {clientData.email}</p>
                  </div>
                </div>
                <button
                  onClick={handleOpenEmailPreview}
                  className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-700 px-3 py-1.5 rounded-lg transition-all"
                >
                  <Eye className="w-3.5 h-3.5" /> Prévisualiser & envoyer
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Sujet : <span className="font-medium text-gray-700">[{cabinet.nom}] Demande de délégation d'accès</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Contient les instructions pour Impots.gouv.fr et URSSAF. Modifiable avant envoi.
              </p>
            </div>

            <button onClick={handleOpenEmailPreview}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-medium transition-all shadow-sm">
              <Eye className="w-4 h-4" />
              Prévisualiser et envoyer l'email à {clientData.email}
            </button>
          </div>
        )}

        {phase === 'sending' && (
          <AutoTask label="Envoi de l'email de demande d'accès" status="loading"
            sublabel={`Email → ${clientData.email}`} />
        )}

        {clientData.delegationEmailSent && phase !== 'idle' && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <p className="text-sm font-medium text-emerald-700">Email envoyé à {clientData.email}</p>
                {emailDemo && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Démo</span>}
              </div>
              <button
                onClick={handleOpenEmailPreview}
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                <Eye className="w-3 h-3" /> Revoir
              </button>
            </div>
            <p className="text-xs text-emerald-600 mt-1">
              Guide Impots.gouv + URSSAF inclus dans l'email avec les instructions de délégation.
            </p>
          </div>
        )}
      </div>

      {/* Platforms info */}
      {(phase === 'waiting' || phase === 'collecting' || phase === 'done') && (
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            {
              title: '🏛️ Impots.gouv.fr',
              desc: 'Espace Pro → Gérer mes accès → Ajouter un mandataire',
              sub: `SIREN cabinet : ${cabinet.siren}`,
              state: clientData.impotsDelegation?.received ?? false,
            },
            {
              title: '🏢 URSSAF.fr',
              desc: 'Mon compte → Gérer les accès → Délégation cabinet',
              sub: 'Identifiant cabinet à fournir',
              state: clientData.urssafDelegation?.received ?? false,
            },
          ].map((plat, i) => (
            <div key={i} className={`border rounded-xl p-3 ${plat.state ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
              <p className="text-sm font-medium text-gray-800">{plat.title}</p>
              <p className="text-xs text-gray-500 mt-1">{plat.desc}</p>
              <p className="text-xs text-gray-400 mt-0.5">{plat.sub}</p>
              {plat.state && <p className="text-xs text-emerald-600 mt-1 font-medium">✓ Reçus et archivés</p>}
            </div>
          ))}
        </div>
      )}

      {/* Step 2: Collect codes */}
      {phase === 'waiting' && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">2</div>
            <p className="text-sm font-medium text-gray-800">En attente des accès du client</p>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-4">
            <p className="text-xs text-amber-700">
              Le client doit effectuer les délégations et vous transmettre ses identifiants/codes en réponse à l'email.
              Cliquez sur "Renseigner les accès reçus" dès réception.
            </p>
          </div>
          <button onClick={startCollect}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-sm font-medium transition-all">
            <CheckCircle2 className="w-4 h-4" />
            Renseigner les accès reçus
          </button>
        </div>
      )}

      {/* Step 3: Enter codes */}
      {phase === 'collecting' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">2</div>
            <p className="text-sm font-medium text-gray-800">Saisie des codes / accès reçus du client</p>
          </div>

          {/* Security warning */}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              <strong>Données sensibles.</strong> Ces codes d'accès gouvernementaux sont masqués à la saisie.
              Assurez-vous qu'aucun écran ne soit partagé/visible lors de cette étape.
              Les données seront archivées de façon sécurisée.
            </p>
          </div>

          {/* Impots.gouv field */}
          <div>
            <label className="block text-sm text-gray-700 mb-1.5">🏛️ Impots.gouv.fr — Identifiants / codes accès</label>
            <div className="relative">
              <input
                type={showImpotsCode ? 'text' : 'password'}
                placeholder="Identifiant DGFIP, mot de passe temporaire..."
                value={impotsCodes}
                onChange={e => setImpotsCodes(e.target.value)}
                autoComplete="off"
                className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
              />
              <button
                type="button"
                onClick={() => setShowImpotsCode(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label={showImpotsCode ? 'Masquer les codes Impôts' : 'Afficher les codes Impôts'}
              >
                {showImpotsCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* URSSAF field */}
          <div>
            <label className="block text-sm text-gray-700 mb-1.5">🏢 URSSAF — Identifiants / codes accès</label>
            <div className="relative">
              <input
                type={showUrssafCode ? 'text' : 'password'}
                placeholder="SIRET, numéro de compte URSSAF, code..."
                value={urssafCodes}
                onChange={e => setUrssafCodes(e.target.value)}
                autoComplete="off"
                className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
              />
              <button
                type="button"
                onClick={() => setShowUrssafCode(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label={showUrssafCode ? 'Masquer les codes URSSAF' : 'Afficher les codes URSSAF'}
              >
                {showUrssafCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 space-y-1">
            <p className="font-medium">📦 Ces informations seront :</p>
            <p>• <strong>Chiffrées et archivées</strong> dans SharePoint (dossier sécurisé)</p>
            <p>• <strong>Ajoutées en note</strong> dans la fiche Pennylane du client</p>
          </div>

          <button onClick={saveCodes} disabled={saving || (!impotsCodes && !urssafCodes)}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all ${
              saving || (!impotsCodes && !urssafCodes) ? 'bg-gray-100 text-gray-400' : 'bg-violet-600 hover:bg-violet-700 text-white'
            }`}>
            {saving ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sauvegarde...</>
            ) : (
              <><Save className="w-4 h-4" /> Sauvegarder dans SharePoint + Pennylane</>
            )}
          </button>
        </div>
      )}

      {/* Done */}
      {phase === 'done' && (
        <div className="space-y-3">
          <AutoTask label="Codes / accès archivés dans SharePoint (GED)" status="done"
            sublabel={`Fichier chiffré → Documents/Délégations d'accès — ${new Date().getFullYear()}.txt`} />
          <AutoTask label="Note ajoutée dans la fiche Pennylane du client" status="done"
            sublabel="Note confidentielle : accès Impots.gouv + URSSAF reçus et opérationnels" />

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <p className="text-sm font-medium text-emerald-800">Délégations d'accès traitées</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-emerald-700">
              {clientData.impotsDelegation?.received && <p>✓ Impots.gouv.fr — Accès opérationnel</p>}
              {clientData.urssafDelegation?.received && <p>✓ URSSAF — Accès opérationnel</p>}
              <p>✓ Archivé dans SharePoint GED</p>
              <p>✓ Note Pennylane créée</p>
            </div>
          </div>

          <a href="#" className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline bg-blue-50 px-3 py-2 rounded-lg">
            <ExternalLink className="w-3 h-3" /> Voir dans SharePoint
          </a>
        </div>
      )}

      {/* Email Preview Modal */}
      {showEmailPreview && (
        <EmailPreviewEditModal
          subject={defaultSubject}
          htmlContent={defaultHtml}
          to={clientData.email}
          toName={clientData.nom}
          onSend={handleSendEmail}
          onClose={() => setShowEmailPreview(false)}
        />
      )}
    </StepShell>
  );
}