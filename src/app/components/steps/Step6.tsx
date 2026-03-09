import { useState } from 'react';
import { PenLine, CheckCircle2, Eye, Clock, ExternalLink, Euro, BookOpen, FileText, Loader2, Lock } from 'lucide-react';
import { useOnboarding, MISSIONS_LIST } from '../../context/OnboardingContext';
import { StepShell, AutoTask, AutoCompletedBanner, InfoCard } from '../StepShell';
import { uploadFile } from '../../services/sharepointApi';
import { createSignatureRequest as createYousignRequest } from '../../services/yousignApi';
import { createSignatureTransaction as createJeSignRequest } from '../../services/jesignexpertApi';
import { LetterPreviewModal } from '../modals/LetterPreviewModal';
import { useCabinet } from '../../context/CabinetContext';
import { useServices } from '../../context/ServicesContext';
import type { TemplateVariables } from '../../utils/templateUtils';
import { toast } from 'sonner';
import { delay } from '../../utils/delay';
import { generateLDMPdf } from '../../services/pdfGenerator';

type Phase = 'select' | 'preview' | 'yousign' | 'signed' | 'uploaded';

export function Step6() {
  const { clientData, updateClientData, goNext, goPrev } = useOnboarding();

  // Detect pre-filled Devis data and already-signed LDM
  const hasPrefilledDevis =
    clientData.missionsSelectionnees.length > 0 &&
    !!clientData.prixAnnuel &&
    !isNaN(parseFloat(clientData.prixAnnuel));
  const isLdmAlreadySigned = clientData.lettreMissionSignee;

  const [phase, setPhase] = useState<Phase>(() => {
    if (clientData.lettreMissionSignee) return 'uploaded';
    return 'select';
  });
  const [devisEditMode, setDevisEditMode] = useState(false);
  const [prix, setPrix] = useState(clientData.prixAnnuel || '');
  const [prixError, setPrixError] = useState('');
  const [selectedMissions, setSelectedMissions] = useState<string[]>(clientData.missionsSelectionnees);
  const [showModal, setShowModal] = useState(false);
  const [taskIdx, setTaskIdx] = useState(0);
  const [yousignRequestId, setYousignRequestId] = useState<string | null>(null);
  const [yousignDemo, setYousignDemo] = useState(false);
  const [yousignSigningUrl, setYousignSigningUrl] = useState<string | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  // Signature provider — defaults to cabinet signatureProvider setting or 'yousign'
  const [signatureProvider, setSignatureProvider] = useState<'jesignexpert' | 'yousign'>(() => {
    const pref = clientData.signatureProvider;
    return pref === 'jesignexpert' || pref === 'yousign' ? pref : 'yousign';
  });

  const { cabinet } = useCabinet();
  const { connections } = useServices();
  const [pdfLoading, setPdfLoading] = useState(false);
  const today = new Date();
  const formatDate = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  const toggleMission = (m: string) => {
    setSelectedMissions(prev =>
      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
    );
  };

  const validateSelect = () => {
    if (!prix || isNaN(parseFloat(prix))) { setPrixError('Veuillez saisir un prix annuel valide'); return false; }
    if (selectedMissions.length === 0) { setPrixError('Sélectionnez au moins une mission'); return false; }
    return true;
  };

  const handleOpenPreview = () => {
    if (!validateSelect()) return;
    updateClientData({ missionsSelectionnees: selectedMissions, prixAnnuel: prix });
    setShowModal(true);
  };

  const handlePreviewPdf = async () => {
    if (!validateSelect()) return;
    setPdfLoading(true);
    try {
      const prixAnnuelNum = parseFloat(prix) || 0;
      const prixMensuelNum = prixAnnuelNum / 12;
      const doc = await generateLDMPdf(
        {
          raisonSociale: clientData.raisonSociale || clientData.nom,
          nom: clientData.nom,
          siren: clientData.siren,
          adresse: clientData.adresse,
          codePostal: clientData.codePostal,
          ville: clientData.ville,
          email: clientData.email,
          formeJuridique: clientData.formeJuridique,
          missionsSelectionnees: selectedMissions,
          prixAnnuel: prix,
          // Pass detailed pricing breakdown from validated quote when available
          monthlyAccountingPrice: clientData.devisMonthlyAccounting || undefined,
          monthlyClosurePrice: clientData.devisMonthlyClosing || undefined,
          monthlySocialPrice: clientData.devisMonthlySocial || undefined,
          monthlyOptionsPrice: clientData.devisMonthlyOptions || undefined,
          setupFees: clientData.devisSetupFees || undefined,
          taxRegime: clientData.devisTaxRegime || undefined,
          bulletinsPerMonth: clientData.devisBulletinsPerMonth || undefined,
        },
        {
          nom: cabinet.nom,
          adresse: cabinet.adresse,
          codePostal: cabinet.codePostal,
          ville: cabinet.ville,
          siren: cabinet.siren,
          telephone: cabinet.telephone,
          expertNom: cabinet.expertNom,
          expertEmail: cabinet.expertEmail,
          numeroOrdre: cabinet.numeroOrdre,
        },
        prixMensuelNum,
      );
      window.open(doc.output('bloburl'), '_blank');
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.error('Erreur lors de la génération du PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  const missionsList = selectedMissions.map(m => `• ${m}`).join('\n');
  const prixAnnuelNum = parseFloat(prix) || 0;
  const prixMensuelNum = prixAnnuelNum > 0 ? Math.round(prixAnnuelNum / 12) : 0;

  // Devis breakdown (from validated quote via PricingEngine)
  const devisCompta = clientData.devisMonthlyAccounting || 0;
  const devisBilan = clientData.devisMonthlyClosing || 0;
  const devisSocial = clientData.devisMonthlySocial || 0;
  const devisOptions = clientData.devisMonthlyOptions || 0;
  const devisSetup = clientData.devisSetupFees || 0;

  const templateVars: TemplateVariables = {
    cabinet_nom: cabinet.nom,
    cabinet_adresse: cabinet.adresse,
    cabinet_code_postal: cabinet.codePostal,
    cabinet_ville: cabinet.ville,
    cabinet_siren: cabinet.siren,
    cabinet_numero_ordre: cabinet.numeroOrdre,
    cabinet_expert: cabinet.expertNom,
    cabinet_telephone: cabinet.telephone,
    cabinet_capital_social: cabinet.capitalSocial,
    client_nom: clientData.nom,
    client_raison_sociale: clientData.raisonSociale || clientData.nom,
    client_siren: clientData.siren,
    client_email: clientData.email,
    client_adresse: `${clientData.adresse}, ${clientData.codePostal} ${clientData.ville}`,
    client_forme_juridique: clientData.formeJuridique,
    missions_liste: missionsList,
    prix_annuel: prixAnnuelNum ? prixAnnuelNum.toLocaleString('fr-FR') : '',
    prix_mensuel: prixMensuelNum ? prixMensuelNum.toLocaleString('fr-FR') : '',
    // Aliases explicitly named in Supabase template variables
    honoraires_mensuels_ht: prixMensuelNum ? prixMensuelNum.toLocaleString('fr-FR') : '',
    honoraires_annuels_ht: prixAnnuelNum ? prixAnnuelNum.toLocaleString('fr-FR') : '',
    honoraires_mensuels_ttc: prixMensuelNum ? Math.round(prixMensuelNum * 1.2).toLocaleString('fr-FR') : '',
    honoraires_annuels_ttc: prixAnnuelNum ? Math.round(prixAnnuelNum * 1.2).toLocaleString('fr-FR') : '',
    // Devis breakdown
    honoraires_comptabilite_ht: devisCompta ? devisCompta.toLocaleString('fr-FR') : '',
    honoraires_bilan_ht: devisBilan ? devisBilan.toLocaleString('fr-FR') : '',
    honoraires_social_ht: devisSocial ? devisSocial.toLocaleString('fr-FR') : '',
    honoraires_options_ht: devisOptions ? devisOptions.toLocaleString('fr-FR') : '',
    frais_mise_en_place: devisSetup ? devisSetup.toLocaleString('fr-FR') : '',
    regime_fiscal: clientData.devisTaxRegime || '',
    nb_bulletins: clientData.devisBulletinsPerMonth ? String(clientData.devisBulletinsPerMonth) : '',
    date_du_jour: formatDate(today),
    date_effet: formatDate(nextMonth),
  };

  const handleSendFromModal = async (_content: string, _templateId: string) => {
    setShowModal(false);
    setPhase('preview');
    setTaskIdx(0);
    setTaskError(null);

    // Task 0: Load template
    await delay(600);
    setTaskIdx(1);

    // Task 1: Generate document
    await delay(700);
    setTaskIdx(2);

    // Task 2: Send via chosen signature provider
    // Handles compound names correctly: first token = prénom, rest = nom de famille
    const nameParts = clientData.nom.trim().split(/\s+/);
    const firstName = nameParts[0] || 'Client';
    const lastName = nameParts.slice(1).join(' ') || firstName;

    const signerPayload = {
      name: `Lettre de Mission — ${clientData.raisonSociale || clientData.nom} — ${new Date().getFullYear()}`,
      signers: [
        {
          firstName,
          lastName,
          email: clientData.email,
          locale: 'fr' as const,
        },
      ],
      documentName: `Lettre_Mission_${clientData.raisonSociale?.replace(/\s/g, '_') || 'Client'}.pdf`,
    };

    // Persist chosen provider on client data
    updateClientData({ signatureProvider });

    let signatureResult: { success: boolean; data?: { id: string; signers: { signatureLink?: string }[]; signingUrl?: string }; demo?: boolean; error?: string };

    if (signatureProvider === 'jesignexpert') {
      const raw = await createJeSignRequest(signerPayload);
      signatureResult = {
        success: raw.success,
        data: raw.data ? { id: raw.data.id, signers: raw.data.signers, signingUrl: raw.data.signingUrl } : undefined,
        demo: raw.demo,
        error: raw.error,
      };
    } else {
      const raw = await createYousignRequest(signerPayload);
      signatureResult = {
        success: raw.success,
        data: raw.data ? { id: raw.data.id, signers: raw.data.signers, signingUrl: raw.data.signingUrl } : undefined,
        demo: raw.demo,
        error: raw.error,
      };
    }

    if (signatureResult.success && signatureResult.data) {
      setYousignRequestId(signatureResult.data.id);
      setYousignDemo(signatureResult.demo ?? false);
      setYousignSigningUrl(signatureResult.data.signers[0]?.signatureLink ?? signatureResult.data.signingUrl ?? null);
      setTaskIdx(3);
      setPhase('yousign');

      // Persist signature ID for Dashboard tracking
      updateClientData({ lettreMissionSignatureId: signatureResult.data.id });

      const providerLabel = signatureProvider === 'jesignexpert' ? 'JeSignExpert' : 'Yousign';
      if (!signatureResult.demo) {
        toast.success(`Lettre de Mission envoyée via ${providerLabel} pour signature`);
      } else {
        toast.info(`Lettre de Mission envoyée (mode démo ${providerLabel})`);
      }
    } else {
      setTaskError(signatureResult.error ?? 'Erreur lors de l\'envoi en signature');
      setPhase('yousign');
      toast.error(`Erreur — vérifiez votre clé API dans /setup`);
    }
  };

  const simulateSign = async () => {
    await delay(600);
    updateClientData({ lettreMissionSignee: true });
    setPhase('signed');
    toast.success('Signature client confirmée ✓');
  };

  const uploadToSharepoint = async () => {
    const fakeBlob = new Blob(['Lettre de Mission — Contenu PDF'], { type: 'application/pdf' });
    const result = await uploadFile(
      clientData.sharepointFolderId || 'demo_folder',
      `Lettre de Mission — ${clientData.raisonSociale} — ${new Date().getFullYear()}.pdf`,
      fakeBlob
    );
    updateClientData({ lettreMissionSharepointUrl: result.webUrl });
    setPhase('uploaded');
    toast.success('LDM signée archivée dans SharePoint ✓');
  };

  const tasksGen = [
    { label: 'Chargement du modèle Lettre de Mission cabinet', sublabel: 'Template personnalisé validé' },
    { label: 'Personnalisation avec missions et tarif', sublabel: `${selectedMissions.length} missions | ${prix} € HT/an` },
    { label: `Envoi via API ${signatureProvider === 'jesignexpert' ? 'JeSignExpert' : 'Yousign'}${signatureProvider === 'jesignexpert' ? (!connections.jesignexpert.connected ? ' (Démo)' : ' (Live)') : (!connections.yousign.connected ? ' (Démo)' : ' (Live)')}`, sublabel: `Email → ${clientData.email}` },
  ];

  const getTaskStatus = (i: number): 'pending' | 'loading' | 'done' | 'error' => {
    if (taskIdx > i) return 'done';
    if (taskIdx === i && phase === 'preview') return 'loading';
    if (taskError && taskIdx === 2 && i === 2) return 'error';
    return 'pending';
  };

  // Next button is disabled when:
  // - Still in the selection phase without pre-filled Devis data confirmed (or edit mode is on)
  // - In the generation/sending phase (async tasks running)
  const isNextButtonDisabled =
    (phase === 'select' && !(hasPrefilledDevis && !devisEditMode)) ||
    phase === 'preview';

  return (
    <StepShell
      step={6}
      title="Contractualisation & Signature Électronique"
      subtitle="Sélection des missions et tarif, génération de la Lettre de Mission, prévisualisation, signature via Yousign et archivage SharePoint"
      type="automatisé"
      icon={<PenLine className="w-5 h-5 text-white" />}
      onBack={goPrev}
      onNext={goNext}
      nextLabel="Collecte KYC →"
      nextDisabled={isNextButtonDisabled}
    >
      {/* Auto-completed banner: LDM already signed before entering this step */}
      {isLdmAlreadySigned && phase === 'uploaded' && (
        <AutoCompletedBanner source="Lettre de Mission" />
      )}

      {/* Service status + Signature provider selector — hidden when LDM is already signed */}
      {!isLdmAlreadySigned && (
      <div className="flex gap-2 mb-5 flex-wrap items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${connections.yousign.connected ? 'bg-violet-50 border-violet-200 text-violet-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${connections.yousign.connected ? 'bg-violet-500' : 'bg-amber-500'}`} />
            Yousign {connections.yousign.connected ? '(Live)' : '(Démo)'}
          </div>
          <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${connections.jesignexpert.connected ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${connections.jesignexpert.connected ? 'bg-blue-500' : 'bg-gray-400'}`} />
            JeSignExpert {connections.jesignexpert.connected ? '(Live)' : '(Démo)'}
          </div>
        </div>
        {/* Provider selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">Prestataire :</span>
          {(['yousign', 'jesignexpert'] as const).map(p => (
            <button key={p} onClick={() => setSignatureProvider(p)}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                signatureProvider === p ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}>
              {p === 'yousign' ? 'Yousign' : 'JeSignExpert (OEC)'}
            </button>
          ))}
        </div>
      </div>
      )}

      {/* PHASE: Select missions + price */}
      {phase === 'select' && (
        <div className="space-y-5">
          {/* Banner: pre-filled Devis data (read-only view) */}
          {hasPrefilledDevis && !devisEditMode ? (
            <>
              <AutoCompletedBanner source="Devis" onEdit={() => setDevisEditMode(true)} />

              {/* Read-only price */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Lock className="w-4 h-4 text-gray-400" />
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Honoraires — issus du Devis</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <InfoCard label="Honoraires annuels (HT)" value={`${parseFloat(clientData.prixAnnuel).toLocaleString('fr-FR')} €`} />
                  <InfoCard label="Mensuel (HT)" value={`${Math.round(parseFloat(clientData.prixAnnuel) / 12).toLocaleString('fr-FR')} €`} />
                  <InfoCard label="Annuel (TTC)" value={`${Math.round(parseFloat(clientData.prixAnnuel) * 1.2).toLocaleString('fr-FR')} €`} />
                </div>
              </div>

              {/* Read-only missions */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Lock className="w-4 h-4 text-gray-400" />
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                    Missions — issues du Devis
                    <span className="ml-2 font-normal normal-case text-gray-500">
                      ({clientData.missionsSelectionnees.length} mission{clientData.missionsSelectionnees.length > 1 ? 's' : ''})
                    </span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {clientData.missionsSelectionnees.map(m => (
                    <span
                      key={m}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 font-medium"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      {m}
                    </span>
                  ))}
                </div>
              </div>

              {/* CTA: confirm pre-filled data and generate LDM */}
              <button
                onClick={() => {
                  updateClientData({ missionsSelectionnees: clientData.missionsSelectionnees, prixAnnuel: clientData.prixAnnuel });
                  setShowModal(true);
                }}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-medium transition-all shadow-sm"
              >
                <Eye className="w-4 h-4" />
                Confirmer et générer la Lettre de Mission
              </button>
            </>
          ) : (
            <>
              {/* Edit mode or no pre-filled data: show normal form */}
              {hasPrefilledDevis && devisEditMode && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <p className="text-xs text-blue-700">
                    Vous modifiez les données issues du Devis. Les nouvelles valeurs remplaceront celles récupérées automatiquement.
                  </p>
                </div>
              )}

              {/* Price */}
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1.5">
                  <Euro className="inline w-4 h-4 mr-1 text-blue-600" />
                  Honoraires annuels proposés (HT) <span className="text-red-400">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Ex : 3600"
                    value={prix}
                    onChange={e => { setPrix(e.target.value); setPrixError(''); }}
                    className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                  />
                  <span className="text-sm text-gray-600 whitespace-nowrap">€ HT / an</span>
                </div>
                {prix && !isNaN(parseFloat(prix)) && (
                  <p className="text-xs text-gray-400 mt-1">
                    Soit {Math.round(parseFloat(prix) / 12)} € HT/mois | {Math.round(parseFloat(prix) * 1.2)} € TTC/an
                  </p>
                )}
              </div>

              {/* Missions */}
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-2">
                  Missions à intégrer dans la LDM <span className="text-red-400">*</span>
                  <span className="ml-2 text-xs font-normal text-gray-500">({selectedMissions.length} sélectionnée{selectedMissions.length > 1 ? 's' : ''})</span>
                </label>
                <div className="space-y-1.5 max-h-80 overflow-y-auto pr-2">
                  {MISSIONS_LIST.map(mission => (
                    <button
                      key={mission}
                      onClick={() => toggleMission(mission)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all text-sm ${
                        selectedMissions.includes(mission)
                          ? 'border-blue-500 bg-blue-50 text-blue-800'
                          : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        selectedMissions.includes(mission) ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                      }`}>
                        {selectedMissions.includes(mission) && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      {mission}
                    </button>
                  ))}
                </div>
              </div>

              {prixError && <p className="text-xs text-red-500">{prixError}</p>}

              {/* Devis preview — breakdown of the proposed quote */}
              {(devisCompta > 0 || devisBilan > 0 || devisSocial > 0 || devisOptions > 0 || devisSetup > 0) && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Euro className="w-4 h-4 text-blue-600" />
                    <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">Détail du devis proposé</p>
                    {clientData.devisTaxRegime && (
                      <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{clientData.devisTaxRegime}</span>
                    )}
                  </div>
                  <div className="space-y-1.5 mb-3">
                    {devisCompta > 0 && (
                      <div className="flex justify-between text-xs text-blue-900">
                        <span>Tenue comptable</span>
                        <span className="font-medium">{devisCompta.toLocaleString('fr-FR')} € HT/mois</span>
                      </div>
                    )}
                    {devisBilan > 0 && (
                      <div className="flex justify-between text-xs text-blue-900">
                        <span>Révision / Bilan annuel</span>
                        <span className="font-medium">{devisBilan.toLocaleString('fr-FR')} € HT/mois</span>
                      </div>
                    )}
                    {devisSocial > 0 && (
                      <div className="flex justify-between text-xs text-blue-900">
                        <span>Social / Paie{clientData.devisBulletinsPerMonth ? ` (${clientData.devisBulletinsPerMonth} bulletin${clientData.devisBulletinsPerMonth > 1 ? 's' : ''}/mois)` : ''}</span>
                        <span className="font-medium">{devisSocial.toLocaleString('fr-FR')} € HT/mois</span>
                      </div>
                    )}
                    {devisOptions > 0 && (
                      <div className="flex justify-between text-xs text-blue-900">
                        <span>Options & services additionnels</span>
                        <span className="font-medium">{devisOptions.toLocaleString('fr-FR')} € HT/mois</span>
                      </div>
                    )}
                  </div>
                  <div className="border-t border-blue-200 pt-2 space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-blue-900">
                      <span>Total mensuel HT</span>
                      <span>{prixMensuelNum.toLocaleString('fr-FR')} € HT</span>
                    </div>
                    <div className="flex justify-between text-xs text-blue-700">
                      <span>TVA 20 %</span>
                      <span>{Math.round(prixMensuelNum * 0.2).toLocaleString('fr-FR')} €</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-blue-900">
                      <span>Total mensuel TTC</span>
                      <span>{Math.round(prixMensuelNum * 1.2).toLocaleString('fr-FR')} € TTC</span>
                    </div>
                    {devisSetup > 0 && (
                      <div className="flex justify-between text-xs text-blue-600 border-t border-blue-200 pt-1 mt-1">
                        <span>Frais de mise en place (une fois)</span>
                        <span className="font-medium">{devisSetup.toLocaleString('fr-FR')} € HT</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Model info */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="w-4 h-4 text-slate-600" />
                  <p className="text-xs font-medium text-slate-700">Lettre de Mission — Modèle récupéré depuis Supabase</p>
                </div>
                <p className="text-xs text-slate-500 mb-2">
                  La LDM sera générée depuis votre base de modèles (table <code className="bg-slate-100 px-1 rounded">documents</code> Supabase),
                  avec en-tête, clauses déontologiques, missions et tarif personnalisés.
                  Vous pouvez la prévisualiser et la modifier avant envoi.
                </p>
                <div className="flex gap-2 flex-wrap">
                  {['Variables auto-remplies', 'En-tête cabinet', 'Devis intégré', 'Modifiable avant envoi', 'Signature Yousign'].map(tag => (
                    <span key={tag} className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> {tag}
                    </span>
                  ))}
                </div>
              </div>

              <button
                onClick={handlePreviewPdf}
                disabled={pdfLoading}
                className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-800 disabled:opacity-60 text-white py-3 rounded-xl text-sm font-medium transition-all shadow-sm"
              >
                {pdfLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                {pdfLoading ? 'Génération en cours…' : 'Prévisualiser la Lettre de Mission (PDF)'}
              </button>

              <button
                onClick={handleOpenPreview}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-medium transition-all shadow-sm"
              >
                <Eye className="w-4 h-4" />
                Prévisualiser et générer la Lettre de Mission
              </button>
            </>
          )}
        </div>
      )}

      {/* PHASE: Generating/sending */}
      {phase === 'preview' && (
        <div className="space-y-2.5">
          {tasksGen.map((t, i) => (
            <AutoTask
              key={i}
              label={t.label}
              sublabel={taskIdx > i ? t.sublabel : undefined}
              status={getTaskStatus(i)}
            />
          ))}
          {taskError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
              ❌ {taskError}
            </div>
          )}
        </div>
      )}

      {/* PHASE: Yousign sent — only for the current session's signature flow */}
      {(phase === 'yousign' || phase === 'signed' || (phase === 'uploaded' && !isLdmAlreadySigned)) && (
        <div className="space-y-4">
          <div className="space-y-2">
            {tasksGen.map((t, i) => (
              <AutoTask key={i} label={t.label} sublabel={t.sublabel} status="done" />
            ))}
          </div>

          {/* Yousign status */}
          <div className={`border rounded-xl p-4 ${
            phase === 'yousign' ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'
          }`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                {phase === 'yousign' ? (
                  <Clock className="w-4 h-4 text-amber-600" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                )}
                <p className={`text-sm font-medium ${phase === 'yousign' ? 'text-amber-800' : 'text-emerald-800'}`}>
                  {phase === 'yousign' ? 'En attente de signature (Yousign)' : 'Lettre de Mission signée ✓'}
                </p>
                {yousignDemo && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Démo</span>
                )}
              </div>
              {phase === 'yousign' && (
                <div className="flex gap-2 flex-wrap">
                  {yousignSigningUrl && (
                    <a
                      href={yousignSigningUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 px-3 py-1.5 rounded-lg transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Lien de signature
                    </a>
                  )}
                  <button
                    onClick={simulateSign}
                    className="text-xs bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 px-3 py-1.5 rounded-lg transition-all"
                  >
                    ✍️ Simuler signature client
                  </button>
                </div>
              )}
            </div>
            {phase === 'yousign' && (
              <p className="text-xs text-amber-700 mt-2">
                Email envoyé à <strong>{clientData.email}</strong> via {
                  signatureProvider === 'jesignexpert'
                    ? (connections.jesignexpert.connected ? 'JeSignExpert (Live)' : 'JeSignExpert (mode démo)')
                    : (connections.yousign.connected ? 'Yousign (Live)' : 'Yousign (mode démo)')
                }.
                Relance automatique à J+3 et J+7.
              </p>
            )}
          </div>

          {/* Signature provider API info */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-700 mb-2">
              🔗 API {signatureProvider === 'jesignexpert' ? 'JeSignExpert (Universign)' : 'Yousign'} — Séquence d'appels
            </p>
            {signatureProvider === 'jesignexpert' ? (
              <div className="space-y-0.5 font-mono text-xs text-slate-500">
                <p>POST /v1/transactions → {yousignRequestId ? `ID: ${yousignRequestId.slice(0, 20)}...` : 'Créer la transaction'}</p>
                <p>POST /v1/files → Uploader la LDM PDF</p>
                <p>POST /v1/transactions/{'{id}'}/participants → Ajouter {clientData.nom}</p>
                <p>POST /v1/transactions/{'{id}'}/start → Notifier le signataire</p>
              </div>
            ) : (
              <div className="space-y-0.5 font-mono text-xs text-slate-500">
                <p>POST /v3/signature_requests → {yousignRequestId ? `ID: ${yousignRequestId.slice(0, 20)}...` : 'Créer la demande'}</p>
                <p>POST .../signers → Ajouter {clientData.nom}</p>
                <p>POST .../documents → Joindre la LDM PDF</p>
                <p>POST .../activate → Notifier le signataire par email</p>
              </div>
            )}
          </div>

          {/* Upload to SharePoint after signature */}
          {phase === 'signed' && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-sm font-medium text-blue-800 mb-2">📤 Archivage dans SharePoint</p>
              <p className="text-xs text-blue-700 mb-3">
                La version signée sera téléversée automatiquement dans le dossier SharePoint :
                Contrats & Lettres de Mission.
              </p>
              <button
                onClick={uploadToSharepoint}
                className="flex items-center gap-1.5 text-xs bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-lg transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Téléverser la LDM signée dans SharePoint
              </button>
            </div>
          )}

          {phase === 'uploaded' && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <p className="text-sm font-medium text-emerald-800">LDM signée archivée dans SharePoint</p>
              </div>
              <p className="text-xs text-emerald-700 font-mono break-all">
                {clientData.lettreMissionSharepointUrl || 'https://cabinet.sharepoint.com/Clients/[Dossier]/Contrats/LDM-signée.pdf'}
              </p>
              <div className="flex gap-3 mt-2 text-xs text-emerald-600">
                <span>✓ Lettre de Mission</span>
                <span>✓ Signature Yousign</span>
                <span>✓ Archivé SharePoint</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PHASE: LDM already signed — auto-completed summary */}
      {isLdmAlreadySigned && phase === 'uploaded' && (
        <div className="space-y-4">
          {/* Missions summary */}
          {clientData.missionsSelectionnees.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Lock className="w-4 h-4 text-gray-400" />
                <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                  Missions contractualisées
                  <span className="ml-2 font-normal normal-case text-gray-500">
                    ({clientData.missionsSelectionnees.length} mission{clientData.missionsSelectionnees.length > 1 ? 's' : ''})
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {clientData.missionsSelectionnees.map(m => (
                  <span
                    key={m}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 font-medium"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Price summary */}
          {clientData.prixAnnuel && !isNaN(parseFloat(clientData.prixAnnuel)) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <InfoCard label="Honoraires annuels (HT)" value={`${parseFloat(clientData.prixAnnuel).toLocaleString('fr-FR')} €`} />
              <InfoCard label="Mensuel (HT)" value={`${Math.round(parseFloat(clientData.prixAnnuel) / 12).toLocaleString('fr-FR')} €`} />
              <InfoCard label="Annuel (TTC)" value={`${Math.round(parseFloat(clientData.prixAnnuel) * 1.2).toLocaleString('fr-FR')} €`} />
            </div>
          )}

          {/* Signature confirmation */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <p className="text-sm font-medium text-emerald-800">Lettre de Mission signée ✓</p>
            </div>
            {clientData.lettreMissionSharepointUrl && (
              <p className="text-xs text-emerald-700 font-mono break-all mb-2">
                {clientData.lettreMissionSharepointUrl}
              </p>
            )}
            <div className="flex gap-3 mt-1 text-xs text-emerald-600">
              <span>✓ Contractualisation complète</span>
              <span>✓ Signature électronique</span>
              {clientData.lettreMissionSharepointUrl && <span>✓ Archivé SharePoint</span>}
            </div>
          </div>
        </div>
      )}

      {/* Letter Preview Modal */}
      {showModal && (
        <LetterPreviewModal
          type="mission"
          variables={templateVars}
          onSend={handleSendFromModal}
          onClose={() => setShowModal(false)}
          sendLabel={`Générer et envoyer via Yousign${connections.yousign.connected ? ' (Live)' : ' (Démo)'}`}
        />
      )}
    </StepShell>
  );
}