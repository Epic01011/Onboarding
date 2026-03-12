import { useState, useEffect } from 'react';
import { Users, Building2, Mail, Phone, MapPin, CheckCircle2 } from 'lucide-react';
import { useOnboarding } from '../../context/OnboardingContext';
import { StepShell } from '../StepShell';
import { supabase } from '../../utils/supabaseClient';
import { toast } from 'sonner';

interface ProspectOption {
  id: string;
  company_name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  siren: string | null;
  siret: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  status: string;
  pricing_data: Record<string, number> | null;
  naf_code: string | null;
  libelle_naf: string | null;
  legal_form: string | null;
}

// Columns to fetch — kept in sync with ProspectOption type above
const PROSPECT_SELECT_FIELDS = [
  'id', 'company_name', 'contact_name', 'contact_email', 'contact_phone',
  'siren', 'siret', 'address', 'postal_code', 'city', 'status',
  'pricing_data', 'naf_code', 'libelle_naf', 'legal_form',
].join(', ');

export function StepReprise1Prospect() {
  const { updateClientData, goNext } = useOnboarding();
  const [prospects, setProspects] = useState<ProspectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>('');
  const [selected, setSelected] = useState<ProspectOption | null>(null);

  useEffect(() => {
    const fetchProspects = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('prospects')
        .select(PROSPECT_SELECT_FIELDS)
        .in('status', ['gagne', 'en-negociation'])
        .order('company_name');

      if (error) {
        toast.error('Erreur lors du chargement des prospects');
      } else {
        setProspects((data ?? []) as unknown as ProspectOption[]);
      }
      setLoading(false);
    };
    fetchProspects();
  }, []);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    const prospect = prospects.find(p => p.id === id) ?? null;
    setSelected(prospect);

    if (prospect) {
      const pricingUpdates = prospect.pricing_data
        ? {
            devisMonthlyAccounting: prospect.pricing_data.monthlyAccounting ?? 0,
            devisMonthlyClosing: prospect.pricing_data.monthlyClosing ?? 0,
            devisMonthlySocial: prospect.pricing_data.monthlySocial ?? 0,
            devisMonthlyOptions: prospect.pricing_data.monthlyOptions ?? 0,
            devisSetupFees: prospect.pricing_data.setupFees ?? 0,
          }
        : {};

      updateClientData({
        nom: prospect.contact_name ?? '',
        email: prospect.contact_email ?? '',
        telephone: prospect.contact_phone ?? '',
        siren: prospect.siren ?? '',
        siret: prospect.siret ?? '',
        raisonSociale: prospect.company_name,
        adresse: prospect.address ?? '',
        codePostal: prospect.postal_code ?? '',
        ville: prospect.city ?? '',
        codeNAF: prospect.naf_code ?? '',
        libelleNAF: prospect.libelle_naf ?? '',
        formeJuridique: prospect.legal_form ?? '',
        ...pricingUpdates,
      });
    }
  };

  return (
    <StepShell
      step={1}
      title="Sélection du Prospect"
      subtitle="Importez les données du prospect qualifié pour initialiser le dossier de reprise."
      type="manuel"
      icon={<Users className="w-5 h-5 text-white" />}
      onNext={goNext}
      nextDisabled={!selected}
      skipLabel={false}
    >
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Sélectionner un prospect qualifié
          </label>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-3">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              Chargement des prospects...
            </div>
          ) : (
            <select
              value={selectedId}
              onChange={e => handleSelect(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">-- Choisir un prospect --</option>
              {prospects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.company_name}
                  {p.siren ? ` (${p.siren})` : ''}
                  {' — '}
                  {p.status === 'gagne' ? '✅ Gagné' : '🔄 En négociation'}
                </option>
              ))}
            </select>
          )}

          {prospects.length === 0 && !loading && (
            <p className="text-xs text-amber-600 mt-1.5">
              Aucun prospect avec le statut "Gagné" ou "En négociation" trouvé.
            </p>
          )}
        </div>

        {selected && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              <p className="text-sm font-semibold text-blue-800">
                Données importées — Vérifiez avant de continuer
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-start gap-2">
                <Building2 className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Raison sociale</p>
                  <p className="text-sm font-medium text-gray-900">{selected.company_name}</p>
                </div>
              </div>

              {selected.contact_name && (
                <div className="flex items-start gap-2">
                  <Users className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Contact</p>
                    <p className="text-sm font-medium text-gray-900">{selected.contact_name}</p>
                  </div>
                </div>
              )}

              {selected.contact_email && (
                <div className="flex items-start gap-2">
                  <Mail className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="text-sm font-medium text-gray-900">{selected.contact_email}</p>
                  </div>
                </div>
              )}

              {selected.contact_phone && (
                <div className="flex items-start gap-2">
                  <Phone className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Téléphone</p>
                    <p className="text-sm font-medium text-gray-900">{selected.contact_phone}</p>
                  </div>
                </div>
              )}

              {selected.siren && (
                <div className="flex items-start gap-2">
                  <Building2 className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">SIREN</p>
                    <p className="text-sm font-mono font-medium text-gray-900">{selected.siren}</p>
                  </div>
                </div>
              )}

              {(selected.city || selected.postal_code) && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Ville</p>
                    <p className="text-sm font-medium text-gray-900">
                      {[selected.postal_code, selected.city].filter(Boolean).join(' ')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </StepShell>
  );
}
