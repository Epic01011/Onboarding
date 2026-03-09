import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Users, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Skeleton } from '../components/ui/skeleton';
import { getSignedClients } from '../utils/supabaseSync';
import type { SignedClient } from '../utils/supabaseSync';
import { useDossiersContext } from '../context/DossiersContext';

// ─── Form field component ─────────────────────────────────────────────────────

function FormField({
  label,
  value,
  loading,
}: {
  label: string;
  value: string;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    );
  }
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <input
        type="text"
        readOnly
        value={value}
        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-800 outline-none"
      />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function OnboardingClient() {
  const navigate = useNavigate();
  const { createDossier, saveDossier } = useDossiersContext();
  const [loadingClients, setLoadingClients] = useState(true);
  const [clients, setClients] = useState<SignedClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [loadingClientData, setLoadingClientData] = useState(false);
  const [selectedClient, setSelectedClient] = useState<SignedClient | null>(null);
  const [startingOnboarding, setStartingOnboarding] = useState(false);

  // Fetch signed clients on mount
  useEffect(() => {
    (async () => {
      setLoadingClients(true);
      const result = await getSignedClients();
      if (result.success) {
        setClients(result.clients);
      } else {
        toast.error(`Impossible de charger les clients : ${result.error}`);
      }
      setLoadingClients(false);
    })();
  }, []);

  // Load client data when selection changes
  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    setSelectedClient(null);
    if (!clientId) return;
    setLoadingClientData(true);
    const found = clients.find(c => c.clientId === clientId) ?? null;
    setSelectedClient(found);
    setLoadingClientData(false);
  };

  const quoteData = selectedClient?.quoteData ?? {};

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au tableau de bord
        </button>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-100 rounded-lg flex items-center justify-center">
            <Users className="w-5 h-5 text-violet-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Onboarding Client</h1>
            <p className="text-sm text-gray-500">
              Sélectionnez un client validé pour pré-remplir le formulaire d'onboarding
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-8">

        {/* Client selector */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Sélectionner un client validé
          </h2>

          {loadingClients ? (
            <Skeleton className="h-10 w-full rounded-lg" />
          ) : clients.length === 0 ? (
            <p className="text-sm text-gray-500 italic">
              Aucun client avec un devis signé pour l'instant.
              Validez d'abord un devis depuis le{' '}
              <button
                onClick={() => navigate('/pricing')}
                className="text-blue-600 underline hover:text-blue-800"
              >
                Moteur de Tarification
              </button>
              .
            </p>
          ) : (
            <Select value={selectedClientId} onValueChange={handleSelectClient}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sélectionner un client validé…" />
              </SelectTrigger>
              <SelectContent>
                {clients.map(c => (
                  <SelectItem key={c.clientId} value={c.clientId}>
                    {c.clientName}
                    {c.clientEmail ? ` — ${c.clientEmail}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Prefilled form */}
        {(selectedClientId && (loadingClientData || selectedClient)) && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
            <h2 className="text-base font-semibold text-gray-800">
              Formulaire d'Onboarding — Données pré-remplies
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Raison sociale"
                value={selectedClient?.clientName ?? ''}
                loading={loadingClientData}
              />
              <FormField
                label="SIRET"
                value={selectedClient?.siret ?? ''}
                loading={loadingClientData}
              />
              <FormField
                label="Forme juridique"
                value={selectedClient?.legalForm ?? ''}
                loading={loadingClientData}
              />
              <FormField
                label="Régime fiscal"
                value={selectedClient?.taxRegime ?? ''}
                loading={loadingClientData}
              />
              <FormField
                label="Activité principale"
                value={selectedClient?.activity ?? ''}
                loading={loadingClientData}
              />
              <FormField
                label="Email"
                value={selectedClient?.clientEmail ?? ''}
                loading={loadingClientData}
              />
            </div>

            {/* Accounting & payroll options from quoteData */}
            <div className="border-t border-gray-100 pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Options comptables &amp; paie
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="Options comptables (numérisation)"
                  value={
                    loadingClientData
                      ? ''
                      : (quoteData.digitalization as string) === 'numerique'
                      ? 'Numérique'
                      : (quoteData.digitalization as string) === 'papier'
                      ? 'Papier'
                      : (quoteData.digitalization as string) ?? ''
                  }
                  loading={loadingClientData}
                />
                <FormField
                  label="Bulletins de paie / mois"
                  value={
                    loadingClientData
                      ? ''
                      : String(quoteData.bulletinsPerMonth ?? 0)
                  }
                  loading={loadingClientData}
                />
                <FormField
                  label="Honoraires mensuels HT"
                  value={
                    loadingClientData
                      ? ''
                      : selectedClient
                      ? `${selectedClient.monthlyTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`
                      : ''
                  }
                  loading={loadingClientData}
                />
                <FormField
                  label="Frais d'intégration"
                  value={
                    loadingClientData
                      ? ''
                      : selectedClient
                      ? `${selectedClient.setupFees.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`
                      : ''
                  }
                  loading={loadingClientData}
                />
              </div>
            </div>

            {/* CTA — launch full onboarding flow */}
            {selectedClient && !loadingClientData && (
              <div className="pt-2 flex justify-end">
                <button
                  onClick={async () => {
                    if (!selectedClient) return;
                    setStartingOnboarding(true);
                    try {
                      const quoteData = selectedClient.quoteData ?? {};
                      const newDossier = await createDossier();
                      await saveDossier({
                        ...newDossier,
                        clientData: {
                          ...newDossier.clientData,
                          nom: selectedClient.clientName,
                          email: selectedClient.clientEmail ?? '',
                          raisonSociale: selectedClient.clientName,
                          siret: selectedClient.siret ?? '',
                          formeJuridique: selectedClient.legalForm ?? '',
                          hasPayroll: (quoteData.bulletinsPerMonth as number) > 0,
                        },
                      });
                      navigate(`/onboarding/${newDossier.id}`);
                    } catch {
                      toast.error("Erreur lors de la création du dossier d'onboarding");
                    } finally {
                      setStartingOnboarding(false);
                    }
                  }}
                  disabled={startingOnboarding}
                  className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  {startingOnboarding ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Démarrer l'onboarding
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
