import { useState } from 'react';
import { Building2, User, Mail, Phone, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../../app/components/ui/dialog';
import { Input } from '../../app/components/ui/input';
import { Button } from '../../app/components/ui/button';
import { Label } from '../../app/components/ui/label';
import { useProspectStore } from '../../app/store/useProspectStore';

interface NewProspectModalProps {
  open: boolean;
  onClose: () => void;
}

interface FormState {
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
}

const EMPTY_FORM: FormState = {
  company_name: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
};

export function NewProspectModal({ open, onClose }: NewProspectModalProps) {
  const { addProspect } = useProspectStore();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);

  const handleChange = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleClose = () => {
    setForm(EMPTY_FORM);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company_name.trim()) {
      toast.error('La raison sociale / nom du projet est obligatoire');
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
        company_name: form.company_name.trim(),
        contact_name: form.contact_name.trim() || null,
        contact_email: emailTrimmed || null,
        contact_phone: form.contact_phone.trim() || null,
        status: 'a-contacter',
        kanban_column: 'a-contacter',
        source: 'manuel',
      });
      if (result.success) {
        toast.success('Prospect créé avec succès');
        handleClose();
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
