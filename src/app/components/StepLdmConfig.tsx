/**
 * StepLdmConfig — Task 9
 * Configuration avancée du Moteur Lettre de Mission :
 *  - Sélection du modèle (BNC, BIC/IS, Social, Impôt sur le revenu)
 *  - Récapitulatif dynamique de l'offre depuis le store Zustand
 *  - Sélection des annexes et CGV
 */

import { FileText, Package, Paperclip, Euro, Users, CheckCircle2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { usePricingStore } from '../store/usePricingStore';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ModeleType = 'BNC' | 'BIC/IS' | 'Social' | 'IR';

export interface LdmConfigState {
  modeleType: ModeleType;
  annexesCGV: boolean;
  annexesRGPD: boolean;
  annexesPennylane: boolean;
  annexesConfraternel: boolean;
  annexesMandatSEPA: boolean;
}

interface StepLdmConfigProps {
  config: LdmConfigState;
  onChange: <K extends keyof LdmConfigState>(key: K, value: LdmConfigState[K]) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MODELE_OPTIONS: { value: ModeleType; label: string; description: string }[] = [
  { value: 'BNC', label: 'BNC', description: 'Bénéfices Non Commerciaux — professions libérales' },
  { value: 'BIC/IS', label: 'BIC / IS', description: 'Bénéfices Industriels & Commerciaux soumis à l\'IS' },
  { value: 'Social', label: 'Social', description: 'Mission sociale / gestion de la paie uniquement' },
  { value: 'IR', label: 'Impôt sur le revenu', description: 'Régime d\'imposition à l\'IR (EI, EIRL, SNC…)' },
];

const REVENUE_LABELS: Record<string, string> = {
  '<100k': '< 100 000 €',
  '100k-250k': '100 000 – 250 000 €',
  '250k-500k': '250 000 – 500 000 €',
  '500k-1M': '500 000 – 1 000 000 €',
  '>1M': '> 1 000 000 €',
};

const INVOICE_LABELS: Record<string, string> = {
  '<10': '< 10 / mois',
  '10-20': '10 – 20 / mois',
  '20-40': '20 – 40 / mois',
  '40-80': '40 – 80 / mois',
  '>80': '> 80 / mois',
};

// ─── Offer Detail Card ────────────────────────────────────────────────────────

function OfferDetailCard() {
  const { companyProfile, accounting, social, options, savedQuotes } = usePricingStore();

  const lastQuote = savedQuotes[0] ?? null;

  const monthlyTotal = lastQuote?.totalMonthlyHT ?? 0;
  const monthlyAccounting = lastQuote?.monthlyAccountingPrice ?? 0;
  const monthlySocial = lastQuote?.monthlySocialPrice ?? 0;
  const monthlyClosure = lastQuote?.monthlyClosurePrice ?? 0;
  const monthlyOpts = lastQuote?.monthlyOptionsPrice ?? 0;
  const setupFees = lastQuote?.setupFees ?? 0;
  const hasData = companyProfile.clientName || lastQuote;

  if (!hasData) {
    return (
      <Card className="border-dashed border-gray-300 bg-gray-50">
        <CardContent className="py-6 text-center text-sm text-gray-500">
          <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          Aucune proposition tarifaire disponible.
          <br />
          <span className="text-xs">Utilisez le Moteur de Pricing pour générer une offre.</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-100 bg-blue-50/40">
      <CardHeader className="pb-3 pt-5 px-5">
        <CardTitle className="text-sm font-semibold text-blue-900 flex items-center gap-2">
          <Package className="w-4 h-4 text-blue-600" />
          Détail de l'offre sélectionnée
          {lastQuote && (
            <span className="ml-auto text-xs font-normal text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
              {new Date(lastQuote.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5 space-y-3">
        {/* Client & structure */}
        <div className="bg-white rounded-lg border border-blue-100 px-4 py-3 space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            <Users className="w-3.5 h-3.5" /> Profil client
          </div>
          {companyProfile.clientName && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Raison sociale</span>
              <span className="font-medium text-gray-900">{companyProfile.clientName}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Forme juridique</span>
            <span className="font-medium text-gray-900">{companyProfile.legalForm}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">CA estimé</span>
            <span className="font-medium text-gray-900">{REVENUE_LABELS[companyProfile.revenueRange] ?? companyProfile.revenueRange}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Régime fiscal</span>
            <span className="font-medium text-gray-900">{companyProfile.taxRegime}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Factures ventes</span>
            <span className="font-medium text-gray-900">{INVOICE_LABELS[accounting.salesInvoices] ?? accounting.salesInvoices}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Factures achats</span>
            <span className="font-medium text-gray-900">{INVOICE_LABELS[accounting.purchaseInvoices] ?? accounting.purchaseInvoices}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Dématérialisation</span>
            <span className="font-medium text-gray-900">{accounting.digitalization === 'numerique' ? '✅ Numérique' : '📄 Papier'}</span>
          </div>
        </div>

        {/* Volumes & options */}
        {social.bulletinsPerMonth > 0 && (
          <div className="bg-white rounded-lg border border-blue-100 px-4 py-3 space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              <Users className="w-3.5 h-3.5" /> Social
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Bulletins / mois</span>
              <span className="font-medium text-gray-900">{social.bulletinsPerMonth}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Multi-établissements</span>
              <span className="font-medium text-gray-900">{social.multiEtablissement ? 'Oui' : 'Non'}</span>
            </div>
          </div>
        )}

        {/* Options */}
        {(options.ticketsSupport5an || options.whatsappDedie || options.appelsPrioritaires || options.assembleGenerale) && (
          <div className="bg-white rounded-lg border border-blue-100 px-4 py-3 space-y-1">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Options incluses</div>
            {options.ticketsSupport5an && <div className="text-sm text-gray-700 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> 5 tickets support / an</div>}
            {options.whatsappDedie && <div className="text-sm text-gray-700 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Ligne WhatsApp dédiée</div>}
            {options.appelsPrioritaires && <div className="text-sm text-gray-700 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Appels prioritaires compris</div>}
            {options.assembleGenerale && <div className="text-sm text-gray-700 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Assemblée générale + dépôt des comptes</div>}
          </div>
        )}

        {/* Pricing breakdown */}
        {lastQuote && (
          <div className="bg-white rounded-lg border border-blue-100 px-4 py-3 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              <Euro className="w-3.5 h-3.5" /> Tarification
            </div>
            {monthlyAccounting > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tenue comptable</span>
                <span className="text-gray-900">{monthlyAccounting.toLocaleString('fr-FR')} € HT/mois</span>
              </div>
            )}
            {monthlyClosure > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Clôture & liasse</span>
                <span className="text-gray-900">{monthlyClosure.toLocaleString('fr-FR')} € HT/mois</span>
              </div>
            )}
            {monthlySocial > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Gestion sociale</span>
                <span className="text-gray-900">{monthlySocial.toLocaleString('fr-FR')} € HT/mois</span>
              </div>
            )}
            {monthlyOpts > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Options</span>
                <span className="text-gray-900">{monthlyOpts.toLocaleString('fr-FR')} € HT/mois</span>
              </div>
            )}
            {setupFees > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Frais de dossier</span>
                <span className="text-gray-900">{setupFees.toLocaleString('fr-FR')} € HT (unique)</span>
              </div>
            )}
            <div className="border-t border-blue-100 mt-2 pt-2 flex justify-between text-sm font-semibold">
              <span className="text-blue-800">Total tenue mensuelle</span>
              <span className="text-blue-900 text-base">{monthlyTotal.toLocaleString('fr-FR')} € HT/mois</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Forfait annuel</span>
              <span>{(monthlyTotal * 12).toLocaleString('fr-FR')} € HT/an</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function StepLdmConfig({ config, onChange }: StepLdmConfigProps) {
  return (
    <div className="space-y-6">
      {/* Model selection */}
      <div>
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
          <FileText className="w-4 h-4 text-violet-600" />
          Sélection du modèle de lettre de mission
        </label>
        <Select
          value={config.modeleType}
          onValueChange={(v) => onChange('modeleType', v as ModeleType)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choisir le modèle…" />
          </SelectTrigger>
          <SelectContent>
            {MODELE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{opt.label}</span>
                  <span className="text-xs text-gray-500">{opt.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500 mt-1.5">
          Le modèle détermine la structure juridique et fiscale du contrat.
        </p>
      </div>

      {/* Offer detail card */}
      <div>
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
          <Package className="w-4 h-4 text-blue-600" />
          Récapitulatif de l'offre
        </label>
        <OfferDetailCard />
      </div>

      {/* Annexes & CGV */}
      <div>
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
          <Paperclip className="w-4 h-4 text-emerald-600" />
          Annexes et Conditions Générales à joindre
        </label>
        <div className="space-y-3">
          <div className="flex items-start space-x-3 rounded-lg border border-gray-200 px-4 py-3 hover:bg-gray-50 transition-colors">
            <Checkbox
              id="annexe-cgv"
              checked={config.annexesCGV}
              onCheckedChange={(checked) => onChange('annexesCGV', Boolean(checked))}
              className="mt-0.5"
            />
            <div className="flex-1">
              <Label htmlFor="annexe-cgv" className="text-sm font-medium text-gray-900 cursor-pointer">
                Conditions Générales standards
              </Label>
              <p className="text-xs text-gray-500 mt-0.5">
                CGV et conditions de prestation du cabinet HAYOT EXPERTISE.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3 rounded-lg border border-gray-200 px-4 py-3 hover:bg-gray-50 transition-colors">
            <Checkbox
              id="annexe-rgpd"
              checked={config.annexesRGPD}
              onCheckedChange={(checked) => onChange('annexesRGPD', Boolean(checked))}
              className="mt-0.5"
            />
            <div className="flex-1">
              <Label htmlFor="annexe-rgpd" className="text-sm font-medium text-gray-900 cursor-pointer">
                Annexe « Traitement des données personnelles » (RGPD)
              </Label>
              <p className="text-xs text-gray-500 mt-0.5">
                Charte RGPD conforme au Règlement Général sur la Protection des Données.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3 rounded-lg border border-gray-200 px-4 py-3 hover:bg-gray-50 transition-colors">
            <Checkbox
              id="annexe-pennylane"
              checked={config.annexesPennylane}
              onCheckedChange={(checked) => onChange('annexesPennylane', Boolean(checked))}
              className="mt-0.5"
            />
            <div className="flex-1">
              <Label htmlFor="annexe-pennylane" className="text-sm font-medium text-gray-900 cursor-pointer">
                Annexe spécifique « Utilisation du Logiciel Pennylane »
              </Label>
              <p className="text-xs text-gray-500 mt-0.5">
                Conditions d'usage et droits d'accès à la plateforme Pennylane.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3 rounded-lg border border-gray-200 px-4 py-3 hover:bg-gray-50 transition-colors">
            <Checkbox
              id="annexe-confraternel"
              checked={config.annexesConfraternel}
              onCheckedChange={(checked) => onChange('annexesConfraternel', Boolean(checked))}
              className="mt-0.5"
            />
            <div className="flex-1">
              <Label htmlFor="annexe-confraternel" className="text-sm font-medium text-gray-900 cursor-pointer">
                Reprise confraternelle
              </Label>
              <p className="text-xs text-gray-500 mt-0.5">
                Clause de prise en charge confraternelle (changement de cabinet précédent).
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3 rounded-lg border border-gray-200 px-4 py-3 hover:bg-gray-50 transition-colors">
            <Checkbox
              id="annexe-mandat-sepa"
              checked={config.annexesMandatSEPA}
              onCheckedChange={(checked) => onChange('annexesMandatSEPA', Boolean(checked))}
              className="mt-0.5"
            />
            <div className="flex-1">
              <Label htmlFor="annexe-mandat-sepa" className="text-sm font-medium text-gray-900 cursor-pointer">
                Mandat de prélèvement SEPA
              </Label>
              <p className="text-xs text-gray-500 mt-0.5">
                Autorisation de prélèvement automatique pour le règlement des honoraires.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
