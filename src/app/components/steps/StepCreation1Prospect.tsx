import { useState, useEffect } from 'react';
import { UserCheck, Building2, Mail, Phone, MapPin, ChevronDown } from 'lucide-react';
import { useOnboarding } from '../../context/OnboardingContext';
import { StepShell, InfoCard } from '../StepShell';
import { useProspectStore } from '../../store/useProspectStore';
import type { ProspectRow } from '../../store/useProspectStore';

export function StepCreation1Prospect() {
  const { clientData, updateClientData, goNext } = useOnboarding();
  const { prospects, fetchProspects, loading } = useProspectStore();
  const [selectedId, setSelectedId] = useState(clientData.creationProspectId ?? '');
  const [fetched, setFetched] = useState(false);

  // Load prospects eligible for creation (won or in negotiation)
  useEffect(() => {
    if (!fetched) {
      setFetched(true);
      fetchProspects();
    }
  }, [fetched, fetchProspects]);

  const eligibleProspects: ProspectRow[] = prospects.filter(
    (p) => p.status === 'gagne' || p.status === 'en-negociation',
  );

  const selected = eligibleProspects.find((p) => p.id === selectedId) ?? null;

  const handleSelect = (id: string) => {
    setSelectedId(id);
    const prospect = eligibleProspects.find((p) => p.id === id);
    if (!prospect) return;

    updateClientData({
      creationProspectId: id,
      nom: prospect.contact_name ?? '',
      email: prospect.contact_email ?? '',
      telephone: prospect.contact_phone ?? prospect.telephone ?? '',
      siren: prospect.siren ?? '',
      // Map to creation-specific denomination field; raisonSociale used as display fallback
      denominationCreation: prospect.company_name,
      raisonSociale: prospect.company_name,
      adresse: prospect.address ?? '',
      codePostal: prospect.postal_code ?? '',
      ville: prospect.city ?? '',
      formeJuridique: prospect.forme_juridique ?? prospect.legal_form ?? '',
      codeNAF: prospect.naf_code ?? '',
      libelleNAF: prospect.libelle_naf ?? '',
    });
  };

  const canProceed = Boolean(selectedId && selected);

  return (
    <StepShell
      step={1}
      title="Sélection du Prospect"
      subtitle="Choisissez le prospect CRM à convertir en dossier de création de société."
      type="manuel"
      icon={<UserCheck className="w-5 h-5 text-white" />}
      onNext={goNext}
      nextDisabled={!canProceed}
      nextLabel="Valider et continuer →"
    >
      {/* Prospect selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Prospect éligible <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <select
            value={selectedId}
            onChange={(e) => handleSelect(e.target.value)}
            disabled={loading}
            className="w-full appearance-none border border-gray-200 rounded-lg px-4 py-2.5 pr-10 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <option value="">
              {loading ? 'Chargement…' : '— Sélectionner un prospect —'}
            </option>
            {eligibleProspects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.company_name}
                {p.contact_name ? ` — ${p.contact_name}` : ''}
                {p.status === 'gagne' ? ' ✓' : ''}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        </div>
        {eligibleProspects.length === 0 && !loading && (
          <p className="mt-2 text-xs text-amber-600">
            Aucun prospect en statut "Gagné" ou "En négociation" trouvé. Vérifiez votre CRM Prospection.
          </p>
        )}
      </div>

      {/* Summary card */}
      {selected && (
        <div className="border border-blue-100 rounded-xl bg-blue-50/40 p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-4 h-4 text-blue-600" />
            <p className="text-sm font-semibold text-blue-800">{selected.company_name}</p>
            <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${
              selected.status === 'gagne'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {selected.status === 'gagne' ? 'Gagné' : 'En négociation'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <InfoCard
              label="Contact"
              value={selected.contact_name ?? '—'}
            />
            <InfoCard
              label="Forme juridique"
              value={selected.forme_juridique ?? selected.legal_form ?? '—'}
            />
          </div>

          <div className="grid grid-cols-1 gap-3">
            {selected.contact_email && (
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span>{selected.contact_email}</span>
              </div>
            )}
            {(selected.contact_phone ?? selected.telephone) && (
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span>{selected.contact_phone ?? selected.telephone}</span>
              </div>
            )}
            {selected.address && (
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span>
                  {selected.address}
                  {selected.postal_code ? `, ${selected.postal_code}` : ''}
                  {selected.city ? ` ${selected.city}` : ''}
                </span>
              </div>
            )}
          </div>

          {selected.notes && (
            <p className="text-xs text-gray-500 border-t border-blue-100 pt-3">{selected.notes}</p>
          )}
        </div>
      )}
    </StepShell>
  );
}
