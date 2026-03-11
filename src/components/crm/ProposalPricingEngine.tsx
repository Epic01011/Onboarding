import { useState } from 'react';
import {
  Calculator, FileText, TrendingUp, Globe, Package,
  Receipt, Clock, CheckCircle2, AlertCircle, Loader2,
} from 'lucide-react';
import { useOnboarding } from '../../app/context/OnboardingContext';
import { useCabinet } from '../../app/context/CabinetContext';
import { toast } from 'sonner';
import { saveClientAndQuote } from '../../app/utils/supabaseSync';
import { useProspectStore } from '../../app/store/useProspectStore';

/* ─── Complexity drivers ────────────────────────────────────────────────── */

export interface ComplexityDrivers {
  /** Nombre de factures fournisseurs par mois */
  factures: number;
  /** Activité internationale (import/export) */
  international: boolean;
  /** Gestion de stock */
  stock: boolean;
  /** Gestion de paie (nombre de bulletins/mois) */
  bulletinsPaie: number;
  /** Liasse fiscale complexe (IS multi-activités, etc.) */
  liasseFiscaleComplexe: boolean;
  /** Nombre de salariés */
  salaries: number;
}

export const defaultDrivers: ComplexityDrivers = {
  factures: 20,
  international: false,
  stock: false,
  bulletinsPaie: 0,
  liasseFiscaleComplexe: false,
  salaries: 0,
};

/* ─── Pricing engine ────────────────────────────────────────────────────── */

export interface PricingLine {
  label: string;
  heures: number;
  tauxHoraire: number;
  montantAnnuel: number;
  montantMensuel: number;
  note?: string;
}

interface PricingResult {
  lines: PricingLine[];
  totalAnnuel: number;
  totalMensuel: number;
  coefficientsAppliques: { label: string; valeur: string; actif: boolean }[];
}

const TAUX_HORAIRE_BASE = 80; // €/h

export function computePricing(drivers: ComplexityDrivers): PricingResult {
  const { factures, international, stock, bulletinsPaie, liasseFiscaleComplexe, salaries } = drivers;

  // ── Base coefficients ──────────────────────────────────────────────────
  let coefBase = 1.0;
  if (factures > 60) coefBase += 0.60;
  else if (factures > 30) coefBase += 0.25;
  if (international) coefBase += 0.20;
  if (stock) coefBase += 0.15;
  if (liasseFiscaleComplexe) coefBase += 0.20;

  // ── Production lines ───────────────────────────────────────────────────
  const lines: PricingLine[] = [];

  // 1. Tenue comptable
  const hTenue = Math.round((factures * 0.15 + 8) * coefBase);
  lines.push({
    label: 'Tenue comptable & saisie',
    heures: hTenue,
    tauxHoraire: TAUX_HORAIRE_BASE,
    montantAnnuel: hTenue * TAUX_HORAIRE_BASE * 12,
    montantMensuel: hTenue * TAUX_HORAIRE_BASE,
    note: `${factures} factures/mois · coef ×${coefBase.toFixed(2)}`,
  });

  // 2. Déclarations fiscales (TVA, IS/IR)
  const hFiscal = Math.round((4 + (liasseFiscaleComplexe ? 6 : 2)) * coefBase);
  lines.push({
    label: 'Déclarations fiscales (TVA, IS/IR)',
    heures: hFiscal,
    tauxHoraire: TAUX_HORAIRE_BASE,
    montantAnnuel: hFiscal * TAUX_HORAIRE_BASE * 12,
    montantMensuel: hFiscal * TAUX_HORAIRE_BASE,
    note: liasseFiscaleComplexe ? 'Liasse complexe incluse' : undefined,
  });

  // 3. Social / Paie (si applicable)
  if (bulletinsPaie > 0 || salaries > 0) {
    const nbBulletins = bulletinsPaie || salaries;
    const hPaie = Math.round(nbBulletins * 0.5 + 2);
    lines.push({
      label: 'Gestion de la paie & déclarations sociales',
      heures: hPaie,
      tauxHoraire: TAUX_HORAIRE_BASE,
      montantAnnuel: hPaie * TAUX_HORAIRE_BASE * 12,
      montantMensuel: hPaie * TAUX_HORAIRE_BASE,
      note: `${nbBulletins} bulletin${nbBulletins > 1 ? 's' : ''}/mois`,
    });
  }

  // 4. Révision & Bilan annuel
  const hRevision = Math.round((12 + (liasseFiscaleComplexe ? 8 : 4)) * coefBase);
  lines.push({
    label: 'Révision annuelle & établissement du bilan',
    heures: hRevision,
    tauxHoraire: TAUX_HORAIRE_BASE,
    montantAnnuel: hRevision * TAUX_HORAIRE_BASE,
    montantMensuel: Math.round((hRevision * TAUX_HORAIRE_BASE) / 12),
    note: 'Forfait annuel',
  });

  // 5. Conseil & accompagnement
  const hConseil = Math.round(3 * coefBase);
  lines.push({
    label: 'Conseil fiscal & accompagnement',
    heures: hConseil,
    tauxHoraire: TAUX_HORAIRE_BASE,
    montantAnnuel: hConseil * TAUX_HORAIRE_BASE * 12,
    montantMensuel: hConseil * TAUX_HORAIRE_BASE,
  });

  // ── Totals ─────────────────────────────────────────────────────────────
  const totalAnnuel = lines.reduce((s, l) => s + l.montantAnnuel, 0);
  const totalMensuel = lines.reduce((s, l) => s + l.montantMensuel, 0);

  const coefficientsAppliques = [
    {
      label: 'Base',
      valeur: `×1.00 (${TAUX_HORAIRE_BASE} €/h)`,
      actif: true,
    },
    {
      label: factures > 60 ? `Volume factures > 60/mois` : factures > 30 ? 'Volume factures > 30/mois' : 'Volume factures ≤ 30/mois',
      valeur: factures > 60 ? '+60 %' : factures > 30 ? '+25 %' : '+0 %',
      actif: factures > 30,
    },
    {
      label: 'Activité internationale',
      valeur: '+20 %',
      actif: international,
    },
    {
      label: 'Gestion de stock',
      valeur: '+15 %',
      actif: stock,
    },
    {
      label: 'Liasse fiscale complexe',
      valeur: '+20 %',
      actif: liasseFiscaleComplexe,
    },
  ];

  return { lines, totalAnnuel, totalMensuel, coefficientsAppliques };
}

/* ─── Component ─────────────────────────────────────────────────────────── */

interface Props {
  /** Override context data (useful when used standalone) */
  overrideDrivers?: Partial<ComplexityDrivers>;
  /** Prospect ID — when set, advances the prospect to 'en-negociation' after saving */
  prospectId?: string;
}

export function ProposalPricingEngine({ overrideDrivers = {}, prospectId }: Props = {}) {
  const { clientData, updateClientData } = useOnboarding();
  const { cabinet } = useCabinet();

  const [drivers, setDrivers] = useState<ComplexityDrivers>({
    ...defaultDrivers,
    ...overrideDrivers,
  });

  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pricing = computePricing(drivers);

  const updateDriver = <K extends keyof ComplexityDrivers>(
    key: K,
    value: ComplexityDrivers[K],
  ) => {
    setDrivers(prev => ({ ...prev, [key]: value }));
    setGenerated(false);
  };

  const fmt = (n: number) =>
    n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const handleGeneratePDF = async () => {
    setGenerating(true);
    setError(null);

    const webhookUrl =
      import.meta.env.VITE_N8N_WEBHOOK_URL ?? '/webhook/generate-proposal';

    const payload = {
      client: {
        nom: clientData.nom,
        raisonSociale: clientData.raisonSociale,
        siren: clientData.siren,
        email: clientData.email,
        adresse: clientData.adresse,
        codePostal: clientData.codePostal,
        ville: clientData.ville,
        formeJuridique: clientData.formeJuridique,
        effectif: clientData.effectif,
      },
      cabinet: {
        nom: cabinet.nom,
        adresse: cabinet.adresse,
        codePostal: cabinet.codePostal,
        ville: cabinet.ville,
        expertNom: cabinet.expertNom,
        expertEmail: cabinet.expertEmail,
        telephone: cabinet.telephone,
      },
      complexite: drivers,
      pricing: {
        lignes: pricing.lines.map(l => ({
          label: l.label,
          heures: l.heures,
          tauxHoraire: l.tauxHoraire,
          montantMensuel: l.montantMensuel,
          montantAnnuel: l.montantAnnuel,
          note: l.note,
        })),
        totalMensuel: pricing.totalMensuel,
        totalAnnuel: pricing.totalAnnuel,
      },
      generatedAt: new Date().toISOString(),
    };

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} — ${res.statusText}`);
      }

      // Persist the calculated price in clientData for Step 6
      updateClientData({ prixAnnuel: String(pricing.totalAnnuel) });

      // ── Persist to Supabase ──────────────────────────────────────────────
      // Build the rich payload so that LettreMission can reconstruct the
      // full document without any manual re-entry.
      const supabaseResult = await saveClientAndQuote(
        {
          clientName: clientData.raisonSociale || clientData.nom,
          clientEmail: clientData.email || undefined,
          siren: clientData.siren || undefined,
          siret: clientData.siret || undefined,
          raisonSociale: clientData.raisonSociale || undefined,
          nomContact: clientData.nom || undefined,
          adresse: clientData.adresse || undefined,
          codePostal: clientData.codePostal || undefined,
          ville: clientData.ville || undefined,
          legalForm: clientData.formeJuridique || undefined,
        },
        {
          status: 'VALIDATED',
          monthlyTotal: pricing.totalMensuel,
          setupFees: 0,
          quoteData: {
            // Exact pricing lines from the engine — used to build the LDM
            pricingLines: pricing.lines,
            // Inducteurs & company info snapshot — kept for audit / replay
            companyProfile: {
              ...drivers,
              nom: clientData.nom,
              raisonSociale: clientData.raisonSociale,
              formeJuridique: clientData.formeJuridique,
              siren: clientData.siren,
              adresse: clientData.adresse,
              codePostal: clientData.codePostal,
              ville: clientData.ville,
              email: clientData.email,
              effectif: clientData.effectif,
            },
            prixAnnuel: pricing.totalAnnuel,
            coefficientsAppliques: pricing.coefficientsAppliques,
          },
        },
      );

      if (!supabaseResult.success) {
        // Non-blocking: webhook already succeeded so we still show success,
        // but warn the user that the Supabase save failed.
        toast.error(`Sauvegarde Supabase échouée : ${supabaseResult.error}. Régénérez la proposition pour réessayer.`);
      } else if (prospectId) {
        // Advance the existing prospect to 'en-negociation' in the Kanban
        const kanbanResult = await useProspectStore.getState().updateProspectFields(prospectId, {
          pricing_data: pricing as unknown as Record<string, unknown>,
          kanban_column: 'en-negociation',
          status: 'en-negociation',
          estimated_value: pricing.totalAnnuel,
        });
        if (!kanbanResult.success) {
          toast.error(`Mise à jour du Kanban échouée : ${kanbanResult.error}`);
        }
      } else {
        // No existing CRM prospect — create one so the lead appears in the Kanban
        const addResult = await useProspectStore.getState().addProspect({
          company_name: clientData.raisonSociale || clientData.nom || 'Nouveau prospect',
          siren: clientData.siren || null,
          siret: clientData.siret || null,
          contact_name: clientData.nom || null,
          contact_email: clientData.email || null,
          contact_phone: clientData.telephone || null,
          address: clientData.adresse || null,
          postal_code: clientData.codePostal || null,
          city: clientData.ville || null,
          legal_form: clientData.formeJuridique || null,
          status: 'en-negociation',
          kanban_column: 'en-negociation',
          pricing_data: pricing as unknown as Record<string, unknown>,
          estimated_value: pricing.totalAnnuel,
          source: 'pricing',
        });
        if (!addResult.success) {
          toast.error(`Création du prospect CRM échouée : ${addResult.error}`);
        }
      }

      setGenerated(true);
      toast.success('Proposition tarifaire générée avec succès ✓');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(msg);
      toast.error(`Erreur lors de la génération : ${msg}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <Calculator className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">Moteur de pricing de proposition</h2>
          <p className="text-xs text-gray-500">
            {clientData.raisonSociale || clientData.nom || 'Client'} ·{' '}
            {clientData.formeJuridique || 'Forme juridique inconnue'}
          </p>
        </div>
      </div>

      {/* Complexity drivers */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-gray-500" />
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Inducteurs de complexité
          </span>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          {/* Factures */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-gray-400" />
              Factures fournisseurs / mois
            </label>
            <input
              type="number"
              min={0}
              value={drivers.factures}
              onChange={e => updateDriver('factures', parseInt(e.target.value, 10) || 0)}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
            />
            <p className="text-xs text-gray-400 mt-0.5">
              {drivers.factures > 60
                ? '⚠️ Coef +60 % appliqué'
                : drivers.factures > 30
                ? 'Coef +25 % appliqué'
                : 'Pas de surcoef'}
            </p>
          </div>

          {/* Salariés */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              Bulletins de paie / mois
            </label>
            <input
              type="number"
              min={0}
              value={drivers.bulletinsPaie}
              onChange={e => {
                const v = parseInt(e.target.value, 10) || 0;
                updateDriver('bulletinsPaie', v);
              }}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
            />
            <p className="text-xs text-gray-400 mt-0.5">
              {drivers.bulletinsPaie === 0 ? 'Pas de mission sociale' : `Mission paie : ${drivers.bulletinsPaie} bulletin(s)`}
            </p>
          </div>

          {/* Toggles */}
          {(
            [
              { key: 'international', label: 'Activité internationale', icon: Globe, surcoef: '+20 %' },
              { key: 'stock', label: 'Gestion de stock', icon: Package, surcoef: '+15 %' },
              { key: 'liasseFiscaleComplexe', label: 'Liasse fiscale complexe', icon: FileText, surcoef: '+20 %' },
            ] as const
          ).map(({ key, label, icon: Icon, surcoef }) => (
            <div
              key={key}
              className="col-span-1"
            >
              <button
                type="button"
                onClick={() => updateDriver(key, !drivers[key])}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border-2 transition-all text-sm ${
                  drivers[key]
                    ? 'border-blue-500 bg-blue-50 text-blue-800'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </span>
                <span
                  className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                    drivers[key]
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {surcoef}
                </span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Applied coefficients */}
      <div className="flex flex-wrap gap-2">
        {pricing.coefficientsAppliques.map(c => (
          <span
            key={c.label}
            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
              c.actif
                ? 'bg-amber-50 border-amber-200 text-amber-700'
                : 'bg-gray-50 border-gray-200 text-gray-400'
            }`}
          >
            {c.actif ? (
              <CheckCircle2 className="w-3 h-3" />
            ) : (
              <div className="w-3 h-3 rounded-full border border-gray-300" />
            )}
            {c.label} — <strong>{c.valeur}</strong>
          </span>
        ))}
      </div>

      {/* Pricing table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
          <Calculator className="w-4 h-4 text-gray-500" />
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Détail des honoraires
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-4 py-2.5 font-semibold text-gray-600 w-[40%]">Mission</th>
                <th className="text-right px-3 py-2.5 font-semibold text-gray-600">Temps (h/mois)</th>
                <th className="text-right px-3 py-2.5 font-semibold text-gray-600">Taux (€/h)</th>
                <th className="text-right px-3 py-2.5 font-semibold text-gray-600">Hon. mensuel HT</th>
                <th className="text-right px-4 py-2.5 font-semibold text-gray-600">Hon. annuel HT</th>
              </tr>
            </thead>
            <tbody>
              {pricing.lines.map((line, i) => (
                <tr
                  key={i}
                  className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    i % 2 === 0 ? '' : 'bg-gray-50/40'
                  }`}
                >
                  <td className="px-4 py-2.5 text-gray-800 font-medium">
                    {line.label}
                    {line.note && (
                      <span className="block text-gray-400 font-normal text-[11px] mt-0.5">
                        {line.note}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-700 tabular-nums">{line.heures}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700 tabular-nums">{fmt(line.tauxHoraire)} €</td>
                  <td className="px-3 py-2.5 text-right font-medium text-gray-800 tabular-nums">
                    {fmt(line.montantMensuel)} €
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-blue-700 tabular-nums">
                    {fmt(line.montantAnnuel)} €
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-blue-50 border-t-2 border-blue-200">
                <td colSpan={3} className="px-4 py-3 font-bold text-gray-900 text-sm">
                  TOTAL HT
                </td>
                <td className="px-3 py-3 text-right font-bold text-gray-900 tabular-nums text-sm">
                  {fmt(pricing.totalMensuel)} €<span className="text-xs font-normal text-gray-500">/mois</span>
                </td>
                <td className="px-4 py-3 text-right font-bold text-blue-800 tabular-nums text-sm">
                  {fmt(pricing.totalAnnuel)} €<span className="text-xs font-normal text-blue-600">/an</span>
                </td>
              </tr>
              <tr className="bg-gray-50 border-t border-gray-200">
                <td colSpan={3} className="px-4 py-2.5 text-gray-500 text-[11px]">
                  TVA 20 % applicable
                </td>
                <td className="px-3 py-2.5 text-right text-gray-500 tabular-nums text-[11px]">
                  {fmt(Math.round(pricing.totalMensuel * 1.2))} € TTC/mois
                </td>
                <td className="px-4 py-2.5 text-right text-gray-500 tabular-nums text-[11px]">
                  {fmt(Math.round(pricing.totalAnnuel * 1.2))} € TTC/an
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3.5 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Success */}
      {generated && !error && (
        <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-sm text-emerald-700">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          Proposition générée — honoraires enregistrés ({fmt(pricing.totalAnnuel)} € HT/an)
        </div>
      )}

      {/* CTA */}
      <button
        onClick={handleGeneratePDF}
        disabled={generating}
        className="w-full flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 rounded-xl text-sm font-medium transition-all shadow-sm"
      >
        {generating ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <FileText className="w-4 h-4" />
        )}
        {generating ? 'Génération en cours…' : 'Générer PDF proposition'}
      </button>
    </div>
  );
}
