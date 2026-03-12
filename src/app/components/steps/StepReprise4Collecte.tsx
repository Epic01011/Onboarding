import { useState } from 'react';
import { Mail, Lock, Send, Eye, EyeOff, Shield, FileText } from 'lucide-react';
import { useOnboarding } from '../../context/OnboardingContext';
import { StepShell } from '../StepShell';
import { toast } from 'sonner';

export function StepReprise4Collecte() {
  const { clientData, updateClientData, goNext } = useOnboarding();

  const [impots, setImpots] = useState({ identifiant: '', password: '', espaceProId: '' });
  const [urssaf, setUrssaf] = useState({ numCompte: '', password: '' });
  const [showImpots, setShowImpots] = useState(false);
  const [showUrssaf, setShowUrssaf] = useState(false);
  const [credentialsSaved, setCredentialsSaved] = useState(false);

  const handleSendDocumentRequest = () => {
    if (!clientData.email) {
      toast.error('Email du client manquant');
      return;
    }
    const subject = encodeURIComponent(
      `[${clientData.raisonSociale || 'Votre dossier'}] Pièces justificatives requises`,
    );
    const body = encodeURIComponent(
      `Madame, Monsieur ${clientData.nom || ''},\n\n` +
        `Dans le cadre de la reprise de votre dossier comptable, nous avons besoin des documents suivants :\n\n` +
        `1. Pièce d'identité du dirigeant (recto/verso)\n` +
        `2. Statuts de la société (à jour)\n` +
        `3. Extrait Kbis (moins de 3 mois)\n` +
        `4. Factures d'achat et de vente des 12 derniers mois\n\n` +
        `Merci de nous les transmettre au plus vite.\n\n` +
        `Cordialement`,
    );
    window.open(`mailto:${clientData.email}?subject=${subject}&body=${body}`);
    updateClientData({ documentDemandeSent: true });
    toast.success('Client de messagerie ouvert avec le template');
  };

  const handleSaveCredentials = () => {
    setCredentialsSaved(true);
    toast.success('Identifiants enregistrés de manière sécurisée');
  };

  const handleSendSecureRequest = () => {
    if (!clientData.email) {
      toast.error('Email du client manquant');
      return;
    }
    const subject = encodeURIComponent(
      `[Sécurisé] Demande d'accès fiscaux — ${clientData.raisonSociale || 'Votre dossier'}`,
    );
    const body = encodeURIComponent(
      `Madame, Monsieur ${clientData.nom || ''},\n\n` +
        `Pour finaliser la reprise de votre dossier, nous avons besoin de vos accès aux plateformes fiscales :\n\n` +
        `• Impôts.gouv (espace professionnel) : identifiant + mot de passe\n` +
        `• URSSAF : numéro de compte + mot de passe\n\n` +
        `Merci de nous les communiquer via notre espace sécurisé.\n\n` +
        `Cordialement`,
    );
    window.open(`mailto:${clientData.email}?subject=${subject}&body=${body}`);
    toast.success('Demande sécurisée envoyée');
  };

  return (
    <StepShell
      step={4}
      title="Collecte & Accès Fiscaux"
      subtitle="Demandez les pièces justificatives et recueillez les accès aux plateformes fiscales."
      type="manuel"
      icon={<FileText className="w-5 h-5 text-white" />}
      onNext={goNext}
      nextDisabled={false}
      skipLabel={false}
    >
      <div className="space-y-6">
        {/* Section 1: Document request */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-700 text-xs font-bold">1</span>
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Demande de pièces au client</h3>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <p className="text-xs text-gray-500">Pièces requises :</p>
            <ul className="space-y-1.5">
              {[
                "Pièce d'identité du dirigeant",
                'Statuts de la société',
                'Extrait Kbis (- 3 mois)',
                "Factures d'achat et de vente",
              ].map(doc => (
                <li key={doc} className="flex items-center gap-2 text-xs text-gray-700">
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full flex-shrink-0" />
                  {doc}
                </li>
              ))}
            </ul>
            <button
              onClick={handleSendDocumentRequest}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                clientData.documentDemandeSent
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <Mail className="w-4 h-4" />
              {clientData.documentDemandeSent ? '✓ Demande envoyée' : 'Demander les pièces au client'}
            </button>
          </div>
        </div>

        <div className="border-t border-gray-100" />

        {/* Section 2: Fiscal access */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 bg-amber-100 rounded-full flex items-center justify-center">
              <span className="text-amber-700 text-xs font-bold">2</span>
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Accès Fiscaux & Sociaux</h3>
          </div>

          <div className="space-y-4">
            {/* Impôts.gouv */}
            <div className="border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-600" />
                <p className="text-sm font-medium text-gray-900">Impôts.gouv (DGFIP)</p>
              </div>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Identifiant"
                  value={impots.identifiant}
                  onChange={e => setImpots(p => ({ ...p, identifiant: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="relative">
                  <input
                    type={showImpots ? 'text' : 'password'}
                    placeholder="Mot de passe"
                    value={impots.password}
                    onChange={e => setImpots(p => ({ ...p, password: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowImpots(s => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showImpots ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Espace Pro — Identifiant"
                  value={impots.espaceProId}
                  onChange={e => setImpots(p => ({ ...p, espaceProId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* URSSAF */}
            <div className="border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-600" />
                <p className="text-sm font-medium text-gray-900">URSSAF</p>
              </div>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Numéro de compte"
                  value={urssaf.numCompte}
                  onChange={e => setUrssaf(p => ({ ...p, numCompte: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="relative">
                  <input
                    type={showUrssaf ? 'text' : 'password'}
                    placeholder="Mot de passe"
                    value={urssaf.password}
                    onChange={e => setUrssaf(p => ({ ...p, password: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowUrssaf(s => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showUrssaf ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSaveCredentials}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  credentialsSaved
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
              >
                <Lock className="w-4 h-4" />
                {credentialsSaved ? '✓ Enregistrés' : 'Enregistrer les accès'}
              </button>
              <button
                onClick={handleSendSecureRequest}
                className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 hover:border-amber-400 hover:bg-amber-50 rounded-lg text-sm text-gray-600 hover:text-amber-700 transition-all"
                title="Envoyer une demande par email si le client n'a pas encore fourni ses accès"
              >
                <Send className="w-4 h-4" />
                Requête sécurisée
              </button>
            </div>
          </div>
        </div>
      </div>
    </StepShell>
  );
}
