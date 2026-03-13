import { useState } from 'react';
import { Building2, User, Mail, Phone, Loader2, Hash } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../../app/components/ui/dialog';
import { Input } from '../../app/components/ui/input';
import { Button } from '../../app/components/ui/button';
import { Label } from '../../app/components/ui/label';
import { useProspectStore } from '../../app/store/useProspectStore';
import { searchProspects } from '../../app/services/prospectApi';

interface NewProspectModalProps {
  open: boolean;
  onClose: () => void;
}

interface FormState {
  company_name: string;
  siren: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
}

const EMPTY_FORM: FormState = {
  company_name: '',
  siren: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
};

export function NewProspectModal({ open, onClose }: NewProspectModalProps) {
  const { addProspect, enrichProspectData } = useProspectStore();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);

  const handleChange = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleClose = () => {
    setForm(EMPTY_FORM);
    onClose();
  };

  /**
   * After the prospect is saved, try to enrich it in the background by
   * querying the API Sirene (recherche-entreprises.api.gouv.fr).
   * Errors are swallowed — this is best-effort enrichment.
   */
  async function enrichInBackground(prospectId: string, siren: string, companyName: string) {
    try {
      const query = siren || companyName;
      const result = await searchProspects({ q: query, perPage: 1 });
      if (!result.success || result.prospects.length === 0) return;
      const p = result.prospects[0];
      // Only use the match if the SIREN matches (when one was provided)
      if (siren && p.siren !== siren) return;
      await enrichProspectData(prospectId, {
        siren:                   p.siren || undefined,
        siret:                   p.siret || undefined,
        naf_code:                p.codeNAF || undefined,
        libelle_naf:             p.libelleNAF || undefined,
        secteur_activite:        p.secteur || undefined,
        forme_juridique:         p.formeJuridique || undefined,
        libelle_forme_juridique: p.libelleFormeJuridique || undefined,
        address:                 p.adresse || undefined,
        postal_code:             p.codePostal || undefined,
        city:                    p.ville || undefined,
        departement:             p.departement || undefined,
        date_creation:           p.dateCreation || undefined,
        effectif:                p.effectif || undefined,
        capital_social:          p.capitalSocial || undefined,
        categorie_entreprise:    p.categorieEntreprise || undefined,
        dirigeants:              p.dirigeants,
        dirigeant_principal:     p.dirigeantPrincipal as Record<string, unknown> | null | undefined,
      });
      toast.success('Fiche prospect enrichie depuis l\'API Sirene', { duration: 3000 });
    } catch {
      // Silently ignore enrichment errors
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company_name.trim()) {
      toast.error('La raison sociale / nom du projet est obligatoire');
      return;
    }
    const sirenTrimmed = form.siren.trim().replace(/\s/g, '');
    if (sirenTrimmed && !/^\d{9}$/.test(sirenTrimmed)) {
      toast.error('Le SIREN doit contenir exactement 9 chiffres');
      return;
    }
    const emailTrimmed = form.contact_email.trim();
    if (emailTrimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      toast.error('Veuillez saisir une adresse email valide');
      return;
    }
    setLoading(true);
    try {
      const result = await addProspect({
        company_name:  form.company_name.trim(),
        siren:         sirenTrimmed || null,
        contact_name:  form.contact_name.trim() || null,
        contact_email: emailTrimmed || null,
        contact_phone: form.contact_phone.trim() || null,
        status:        'a-contacter',
        kanban_column: 'a-contacter',
        source:        'manuel',
      });
      if (result.success) {
        toast.success('Prospect créé avec succès');
        handleClose();
        // Enrich in background — fire-and-forget
        if (result.id) {
          void enrichInBackground(result.id, sirenTrimmed, form.company_name.trim());
        }
      } else {
        toast.error(result.error ?? 'Impossible de créer le prospect. Veuillez vérifier votre connexion et réessayer.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouveau prospect</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Raison sociale */}
          <div className="space-y-1.5">
            <Label htmlFor="np-company">
              Raison sociale / Nom du projet <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="np-company"
                placeholder="Ex : SARL Dupont, Projet Alpha…"
                value={form.company_name}
                onChange={handleChange('company_name')}
                className="pl-9"
                required
                autoFocus
              />
            </div>
          </div>

          {/* SIREN */}
          <div className="space-y-1.5">
            <Label htmlFor="np-siren">
              SIREN{' '}
              <span className="text-gray-400 font-normal text-xs">(optionnel — enrichissement automatique)</span>
            </Label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="np-siren"
                placeholder="Ex : 123456789"
                value={form.siren}
                onChange={handleChange('siren')}
                className="pl-9"
                maxLength={9}
                inputMode="numeric"
                pattern="[0-9]{9}"
              />
            </div>
          </div>

          {/* Nom du dirigeant */}
          <div className="space-y-1.5">
            <Label htmlFor="np-contact">Nom du dirigeant</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="np-contact"
                placeholder="Ex : Jean Dupont"
                value={form.contact_name}
                onChange={handleChange('contact_name')}
                className="pl-9"
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="np-email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="np-email"
                type="email"
                placeholder="contact@exemple.fr"
                value={form.contact_email}
                onChange={handleChange('contact_email')}
                className="pl-9"
              />
            </div>
          </div>

          {/* Téléphone */}
          <div className="space-y-1.5">
            <Label htmlFor="np-phone">Téléphone</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="np-phone"
                type="tel"
                placeholder="06 00 00 00 00"
                value={form.contact_phone}
                onChange={handleChange('contact_phone')}
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Création…
                </>
              ) : (
                'Créer le prospect'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
