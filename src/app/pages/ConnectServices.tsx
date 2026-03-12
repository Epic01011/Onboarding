import { useState, ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useServices } from '../context/ServicesContext';
import { useCabinet } from '../context/CabinetContext';
import { ServiceConnections } from '../utils/servicesStorage';
import { toast } from 'sonner';
import {
  Zap, ChevronRight, Loader2, Mail, AlertCircle,
  Building2, CheckCircle2, ExternalLink, Lock, Key,
  Info, Hash, Award, Phone, MapPin, User, Settings,
  Send, Eye, EyeOff, ShieldCheck,
} from 'lucide-react';

type Tab = 'services' | 'email' | 'cabinet';

// ─── Field ────────────────────────────────────────────────────────────────────
interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: ReactNode;
  type?: string;
  hint?: string;
  required?: boolean;
}

function Field({ label, value, onChange, placeholder, icon, type = 'text', hint }: FieldProps) {
  const [showPwd, setShowPwd] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPwd ? 'text' : 'password') : type;
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-slate-400 font-medium">{label}</label>
      <div className="relative flex items-center">
        {icon && <span className="absolute left-3 text-slate-500">{icon}</span>}
        <input
          type={inputType}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full bg-slate-800 border border-slate-600 rounded-xl text-sm text-white placeholder:text-slate-600 py-2.5 pr-3 focus:outline-none focus:border-blue-500 transition-colors ${icon ? 'pl-9' : 'pl-3'}`}
        />
        {isPassword && (
          <button type="button" onClick={() => setShowPwd(p => !p)} className="absolute right-3 text-slate-500 hover:text-slate-300">
            {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {hint && <p className="text-xs text-slate-600">{hint}</p>}
    </div>
  );
}

// ─── ServiceCard ──────────────────────────────────────────────────────────────
interface ServiceCardProps {
  id: string;
  title: string;
  subtitle: string;
  icon: ReactNode;
  color?: string;
  badge?: string;
  badgeColor?: string;
  connected: boolean;
  displayName?: string;
  onConnect: () => void;
  onDisconnect: () => void;
}

function ServiceCard({ title, subtitle, icon, color = 'bg-slate-700', badge, badgeColor = 'amber', connected, displayName, onConnect, onDisconnect }: ServiceCardProps) {
  const badgeClasses: Record<string, string> = {
    amber: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    blue: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    green: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  };
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-800/60 border border-slate-700">
      <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-white">{title}</p>
          {badge && (
            <span className={`text-xs px-2 py-0.5 rounded-full border ${badgeClasses[badgeColor] ?? badgeClasses.amber}`}>
              {badge}
            </span>
          )}
          {connected && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              ✓ Connecté
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 truncate">{subtitle}</p>
        {connected && displayName && <p className="text-xs text-emerald-400 mt-0.5">{displayName}</p>}
      </div>
      <div className="flex-shrink-0">
        {connected ? (
          <button
            onClick={onDisconnect}
            className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg transition-colors"
          >
            Retirer
          </button>
        ) : (
          <button
            onClick={onConnect}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            Configurer
          </button>
        )}
      </div>
    </div>
  );
}

// ─── ApiKeyModal ──────────────────────────────────────────────────────────────
interface ApiKeyField {
  key: string;
  label: string;
  placeholder: string;
  hint?: string;
  type?: string;
  required?: boolean;
}

interface ApiKeyModalProps {
  title: string;
  subtitle: string;
  docsUrl?: string;
  color?: string;
  initialValues: Record<string, string>;
  fields: ApiKeyField[];
  onSuccess: (values: Record<string, string>) => void;
  onClose: () => void;
}

function ApiKeyModal({ title, subtitle, docsUrl, color = 'bg-blue-600', initialValues, fields, onSuccess, onClose }: ApiKeyModalProps) {
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const requiredFields = fields.filter(f => f.required !== false);
    const missing = requiredFields.find(f => !values[f.key]?.trim());
    if (missing) { toast.error(`Le champ "${missing.label}" est requis`); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 400));
    onSuccess(values);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className={`${color} rounded-t-2xl p-5`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-white">{title}</p>
              <p className="text-xs text-white/70 mt-0.5">{subtitle}</p>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white p-1">
              <Key className="w-4 h-4" />
            </button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {fields.map(f => (
            <Field
              key={f.key}
              label={f.label}
              value={values[f.key] ?? ''}
              onChange={v => setValues(prev => ({ ...prev, [f.key]: v }))}
              placeholder={f.placeholder}
              hint={f.hint}
              type={f.type ?? (f.key === 'apiKey' ? 'password' : 'text')}
            />
          ))}
          {docsUrl && (
            <a href={docsUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300">
              <ExternalLink className="w-3 h-3" /> Documentation officielle
            </a>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-xl text-sm transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={loading}
              className={`flex-1 ${color} hover:opacity-90 text-white py-2.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2`}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              {loading ? 'Vérification...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── MicrosoftModal ───────────────────────────────────────────────────────────
interface MicrosoftModalProps {
  onSuccess: (email: string, appPassword: string, name: string) => void;
  onClose: () => void;
}

function MicrosoftModal({ onSuccess, onClose }: MicrosoftModalProps) {
  const [email, setEmail] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Email requis');
      return;
    }
    if (!appPassword.trim()) {
      toast.error('Mot de passe d\'application requis');
      return;
    }
    setLoading(true);
    await new Promise(r => setTimeout(r, 400));
    onSuccess(email.trim(), appPassword.trim(), name || email.split('@')[0]);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="bg-[#0078d4] rounded-t-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-white">Configurer Microsoft Outlook / Exchange</p>
              <p className="text-xs text-white/70 mt-0.5">Envoi d'emails + SharePoint, OneDrive, Exchange</p>
            </div>
            <svg viewBox="0 0 23 23" className="w-8 h-8" fill="none">
              <rect x="1" y="1" width="10" height="10" fill="#f25022"/>
              <rect x="12" y="1" width="10" height="10" fill="#7fba00"/>
              <rect x="1" y="12" width="10" height="10" fill="#00a4ef"/>
              <rect x="12" y="12" width="10" height="10" fill="#ffb900"/>
            </svg>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-300 space-y-1">
              <p>Connectez votre boîte Microsoft 365 / Exchange pour envoyer tous les emails depuis cette adresse.</p>
              <a href="https://support.microsoft.com/account-billing/using-app-passwords-with-apps-that-don-t-support-two-step-verification-5896ed9b-4263-e681-128a-a6f2979a7944" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300">
                <ExternalLink className="w-3 h-3" /> Créer un mot de passe d'application Microsoft
              </a>
            </div>
          </div>
          <Field label="Email Microsoft 365 / Exchange *" value={email} onChange={setEmail}
            placeholder="prenom.nom@votre-cabinet.fr" icon={<Mail className="w-4 h-4" />} type="email" />
          <Field label="Mot de passe d'application *" value={appPassword} onChange={setAppPassword}
            placeholder="Mot de passe généré dans Compte Microsoft → Sécurité"
            icon={<ShieldCheck className="w-4 h-4" />} type="password"
            hint="Généré dans Compte Microsoft → Sécurité → Options de sécurité avancées" />
          <Field label="Nom affiché (optionnel)" value={name} onChange={setName}
            placeholder="Cabinet Martin Expert-Comptable" icon={<User className="w-4 h-4" />} />
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-xl text-sm transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-[#0078d4] hover:opacity-90 text-white py-2.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              {loading ? 'Connexion...' : 'Connecter Outlook'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── GoogleModal ──────────────────────────────────────────────────────────────
interface GoogleModalProps {
  onSuccess: (email: string, appPassword: string, name: string) => void;
  onClose: () => void;
}

function GoogleModal({ onSuccess, onClose }: GoogleModalProps) {
  const [email, setEmail] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Adresse Gmail requise');
      return;
    }
    if (!appPassword.trim()) {
      toast.error('Mot de passe d\'application requis');
      return;
    }
    if (appPassword.replace(/\s/g, '').length !== 16) {
      toast.error('Le mot de passe d\'application doit comporter 16 caractères');
      return;
    }
    setLoading(true);
    await new Promise(r => setTimeout(r, 400));
    onSuccess(email.trim(), appPassword.replace(/\s/g, ''), name || email.split('@')[0]);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="bg-gradient-to-r from-red-600 to-orange-500 rounded-t-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-white">Configurer Google Gmail</p>
              <p className="text-xs text-white/70 mt-0.5">Envoi d'emails depuis votre adresse Gmail</p>
            </div>
            <svg viewBox="0 0 48 48" className="w-8 h-8" fill="none">
              <path d="M43.6 20.5H42V20H24v8h11.3C33.6 33 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" fill="#FFC107"/>
              <path d="M6.3 14.7 13 19.6C14.8 15.1 19 12 24 12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.6 4 24 4 16.3 4 9.7 8.4 6.3 14.7z" fill="#FF3D00"/>
              <path d="M24 44c5.5 0 10.5-2.1 14.3-5.5L32.2 33C30.3 34.3 27.9 35 24 35c-5.2 0-9.6-3-11.3-7.2l-6.6 5.1C9.5 39.5 16.2 44 24 44z" fill="#4CAF50"/>
              <path d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.4 5.5l.1.1 6 4.9c-.4.4 6.5-4.7 6.5-14.5 0-1.2-.1-2.3-.4-3.5z" fill="#1976D2"/>
            </svg>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-300 space-y-1">
              <p>Utilisez un <strong>mot de passe d'application</strong> Google (pas votre mot de passe habituel).</p>
              <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300">
                <ExternalLink className="w-3 h-3" /> myaccount.google.com/apppasswords
              </a>
            </div>
          </div>
          <Field label="Adresse Gmail *" value={email} onChange={setEmail}
            placeholder="votre-cabinet@gmail.com" icon={<Mail className="w-4 h-4" />} type="email" />
          <Field label="Mot de passe d'application * (16 caractères)" value={appPassword} onChange={setAppPassword}
            placeholder="xxxx xxxx xxxx xxxx" icon={<ShieldCheck className="w-4 h-4" />} type="password"
            hint="Généré dans Compte Google → Sécurité → Mots de passe d'application" />
          <Field label="Nom affiché (optionnel)" value={name} onChange={setName}
            placeholder="Cabinet Martin Expert-Comptable" icon={<User className="w-4 h-4" />} />
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-xl text-sm transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-gradient-to-r from-red-600 to-orange-500 hover:opacity-90 text-white py-2.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              {loading ? 'Vérification...' : 'Connecter Gmail'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── GoogleDriveModal ─────────────────────────────────────────────────────────
interface GoogleDriveModalProps {
  onSuccess: (email: string, folderId: string, name: string) => void;
  onClose: () => void;
}

function GoogleDriveModal({ onSuccess, onClose }: GoogleDriveModalProps) {
  const [email, setEmail] = useState('');
  const [folderId, setFolderId] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Adresse Google requise');
      return;
    }
    setLoading(true);
    await new Promise(r => setTimeout(r, 400));
    onSuccess(email.trim(), folderId.trim(), name || email.split('@')[0]);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="bg-gradient-to-r from-blue-600 to-green-500 rounded-t-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-white">Configurer Google Drive</p>
              <p className="text-xs text-white/70 mt-0.5">GED — Stockage et gestion des documents clients</p>
            </div>
            <svg viewBox="0 0 87.3 78" className="w-8 h-8" fill="none">
              <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
              <path d="M43.65 25L29.9 1.2C28.55.4 27 0 25.45 0c-1.55 0-3.1.4-4.45 1.2L3.85 31.5H31.3z" fill="#00ac47"/>
              <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75L85.1 57.5c.8-1.4 1.2-2.95 1.2-4.5H58.5l5.85 12.65z" fill="#ea4335"/>
              <path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.95 0H34.35c-1.55 0-3.1.4-4.45 1.2z" fill="#00832d"/>
              <path d="M58.5 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.45 1.2h50.6c1.55 0 3.1-.4 4.45-1.2z" fill="#2684fc"/>
              <path d="M73.4 26.5L59.65 2.7c-1.35-.8-2.9-1.2-4.45-1.2h-11.4l12.7 22.2 12.75 22.1 12.85-22.1h-.7z" fill="#ffba00"/>
            </svg>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-300 space-y-1">
              <p>Connectez votre Google Drive pour stocker et partager les documents clients (GED).</p>
              <p>Renseignez l'identifiant du dossier Drive partagé (visible dans l'URL du dossier).</p>
              <a href="https://drive.google.com" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300">
                <ExternalLink className="w-3 h-3" /> Ouvrir Google Drive
              </a>
            </div>
          </div>
          <Field label="Adresse Google *" value={email} onChange={setEmail}
            placeholder="votre-cabinet@gmail.com" icon={<Mail className="w-4 h-4" />} type="email" />
          <Field label="ID du dossier Drive (optionnel)" value={folderId} onChange={setFolderId}
            placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs"
            icon={<Key className="w-4 h-4" />}
            hint="Trouvez l'ID dans l'URL de votre dossier Google Drive : drive.google.com/drive/folders/[ID]" />
          <Field label="Nom affiché (optionnel)" value={name} onChange={setName}
            placeholder="Drive Cabinet Martin" icon={<User className="w-4 h-4" />} />
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-xl text-sm transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-gradient-to-r from-blue-600 to-green-500 hover:opacity-90 text-white py-2.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              {loading ? 'Connexion...' : 'Connecter Google Drive'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ConnectServices() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('services');
  const [saved, setSaved] = useState(false);
  const [modal, setModal] = useState<keyof ServiceConnections | null>(null);

  const { connections, updateService, loading: servicesLoading } = useServices();
  const { cabinet, updateCabinet, saveCabinet } = useCabinet();

  const handleConnect = async (service: keyof ServiceConnections, data: Partial<typeof connections.microsoft>) => {
    await updateService(service, { ...data, connected: true, connectedAt: new Date().toISOString() });
    setModal(null);
    const labels: Record<keyof ServiceConnections, string> = {
      microsoft: 'Microsoft 365',
      google: 'Google Gmail',
      googleDrive: 'Google Drive',
      jesignexpert: 'JeSignExpert',
      airtable: 'Airtable',
      pennylane: 'Pennylane',
      sendgrid: 'SendGrid',
      yousign: 'Yousign',
      pappers: 'Pappers',
      hubspot: 'HubSpot',
      pipedrive: 'Pipedrive',
      impotsgouv: 'Impôts.gouv (DGFIP)',
    };
    toast.success(`${labels[service]} configuré avec succès`);
  };

  const handleDisconnect = async (service: keyof ServiceConnections) => {
    await updateService(service, { connected: false, apiKey: undefined, displayName: undefined, appPassword: undefined, email: undefined });
    toast.info('Service retiré');
  };

  const handleSaveCabinet = async () => {
    try {
      await saveCabinet();
      setSaved(true);
      toast.success('Informations cabinet sauvegardées');
      setTimeout(() => setSaved(false), 2500);
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const connectedCount = Object.values(connections).filter(c => c.connected).length;
  const totalServices = Object.keys(connections).length;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'services', label: '🔌 Connexions API' },
    { id: 'email', label: '📧 Envoi d\'emails' },
    { id: 'cabinet', label: '🏢 Informations Cabinet' },
  ];

  // Helper : initialValues pour un service déjà connecté
  const getInitialValues = (service: keyof ServiceConnections): Record<string, string> => {
    const c = connections[service];
    return {
      apiKey: c.apiKey ?? '',
      baseId: (c as { baseId?: string }).baseId ?? '',
      fromEmail: (c as { fromEmail?: string }).fromEmail ?? '',
      fromName: (c as { fromName?: string }).fromName ?? '',
      email: c.email ?? '',
    };
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 px-8 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm leading-none">CabinetFlow</p>
              <p className="text-slate-500 text-xs mt-0.5">Configuration & Connexions API</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {servicesLoading && <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />}
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <div className={`w-2 h-2 rounded-full ${connectedCount === totalServices ? 'bg-emerald-400' : connectedCount > 0 ? 'bg-amber-400' : 'bg-slate-600'}`} />
              {connectedCount} / {totalServices} services configurés
            </div>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-5 py-2 rounded-xl text-sm font-medium transition-all"
            >
              Tableau de bord <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-8 py-10">
        {/* Title */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl text-white mb-2">Configuration de CabinetFlow</h1>
          <p className="text-slate-400 text-sm max-w-xl mx-auto">
            Renseignez vos propres clés API pour activer chaque fonctionnalité.
            Chaque membre de l'équipe conserve ses propres identifiants, liés à son compte.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-900 p-1 rounded-xl w-fit mx-auto mb-8">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── TAB: Services ── */}
        {tab === 'services' && (
          <div className="space-y-4">
            {/* Info */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
              <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-300">
                Aucune clé n'est pré-remplie. Saisissez vos propres identifiants API — ils seront
                sauvegardés dans votre espace personnel et rechargés à chaque connexion.
              </p>
            </div>

            {/* GED / Documents — Microsoft SharePoint & Google Drive */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                <p className="text-xs text-slate-400">GED / Stockage documents — Choisissez votre solution de gestion documentaire</p>
              </div>

              {/* Microsoft SharePoint */}
              <ServiceCard
                id="microsoft"
                title="Microsoft 365 / SharePoint"
                subtitle="SharePoint, OneDrive, Exchange — GED + Outlook (email) — SMTP | Graph API"
                badge="SharePoint"
                badgeColor="blue"
                icon={
                  <svg viewBox="0 0 23 23" className="w-6 h-6" fill="none">
                    <rect x="1" y="1" width="10" height="10" fill="#f25022"/>
                    <rect x="12" y="1" width="10" height="10" fill="#7fba00"/>
                    <rect x="1" y="12" width="10" height="10" fill="#00a4ef"/>
                    <rect x="12" y="12" width="10" height="10" fill="#ffb900"/>
                  </svg>
                }
                color="bg-[#0078d4]/20"
                connected={connections.microsoft.connected}
                displayName={connections.microsoft.email}
                onConnect={() => setModal('microsoft')}
                onDisconnect={() => handleDisconnect('microsoft')}
              />

              {/* Google Drive */}
              <ServiceCard
                id="googleDrive"
                title="Google Drive"
                subtitle="Google Drive — GED & stockage documents clients dans votre Drive partagé"
                badge="Google Drive"
                badgeColor="green"
                icon={
                  <svg viewBox="0 0 87.3 78" className="w-6 h-6" fill="none">
                    <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                    <path d="M43.65 25L29.9 1.2C28.55.4 27 0 25.45 0c-1.55 0-3.1.4-4.45 1.2L3.85 31.5H31.3z" fill="#00ac47"/>
                    <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75L85.1 57.5c.8-1.4 1.2-2.95 1.2-4.5H58.5l5.85 12.65z" fill="#ea4335"/>
                    <path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.95 0H34.35c-1.55 0-3.1.4-4.45 1.2z" fill="#00832d"/>
                    <path d="M58.5 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.45 1.2h50.6c1.55 0 3.1-.4 4.45-1.2z" fill="#2684fc"/>
                    <path d="M73.4 26.5L59.65 2.7c-1.35-.8-2.9-1.2-4.45-1.2h-11.4l12.7 22.2 12.75 22.1 12.85-22.1h-.7z" fill="#ffba00"/>
                  </svg>
                }
                color="bg-green-500/20"
                connected={connections.googleDrive.connected}
                displayName={connections.googleDrive.email}
                onConnect={() => setModal('googleDrive')}
                onDisconnect={() => handleDisconnect('googleDrive')}
              />

              {(connections.microsoft.connected || connections.googleDrive.connected) && (
                <div className="mt-1 pl-1 flex flex-wrap gap-x-4 gap-y-1">
                  {connections.microsoft.connected && ['SharePoint', 'OneDrive', 'Microsoft Graph'].map(f => (
                    <div key={f} className="flex items-center gap-1.5 text-xs text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" />{f}
                    </div>
                  ))}
                  {connections.googleDrive.connected && ['Google Drive', 'Dossier partagé'].map(f => (
                    <div key={f} className="flex items-center gap-1.5 text-xs text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" />{f}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Email */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <p className="text-xs text-slate-400">Envoi d'emails — Outlook ou Gmail (optionnel, géré dans l'onglet Email)</p>
              </div>
              <ServiceCard
                id="microsoft-email"
                title="Microsoft Outlook / Exchange"
                subtitle="Envoi d'emails Outlook — SMTP | Configuré avec le compte Microsoft ci-dessus"
                icon={
                  <svg viewBox="0 0 23 23" className="w-6 h-6" fill="none">
                    <rect x="1" y="1" width="10" height="10" fill="#f25022"/>
                    <rect x="12" y="1" width="10" height="10" fill="#7fba00"/>
                    <rect x="1" y="12" width="10" height="10" fill="#00a4ef"/>
                    <rect x="12" y="12" width="10" height="10" fill="#ffb900"/>
                  </svg>
                }
                color="bg-[#0078d4]/20"
                connected={connections.microsoft.connected && !!connections.microsoft.appPassword}
                displayName={connections.microsoft.email ? `Depuis : ${connections.microsoft.email}` : undefined}
                onConnect={() => setModal('microsoft')}
                onDisconnect={() => handleDisconnect('microsoft')}
              />
            </div>

            {/* Services optionnels */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                <p className="text-xs text-slate-400">Services optionnels — activez uniquement ceux que vous utilisez</p>
              </div>

              <ServiceCard
                id="jesignexpert"
                title="JeSignExpert"
                subtitle="Signature electronique des documents — API Universign"
                icon={<span className="text-base">&#9997;&#65039;</span>}
                color="bg-violet-500/20"
                connected={connections.jesignexpert.connected}
                displayName={connections.jesignexpert.displayName}
                onConnect={() => setModal('jesignexpert')}
                onDisconnect={() => handleDisconnect('jesignexpert')}
              />

              <ServiceCard
                id="airtable"
                title="Airtable"
                subtitle="CRM clients — Base de données des dossiers — Webhook automatique"
                icon={<span className="text-base">🟠</span>}
                color="bg-orange-500/20"
                connected={connections.airtable.connected}
                displayName={connections.airtable.displayName}
                onConnect={() => setModal('airtable')}
                onDisconnect={() => handleDisconnect('airtable')}
              />

              <ServiceCard
                id="pennylane"
                title="Pennylane"
                subtitle="Provisionnement comptable, mandat SEPA, fiches clients — API REST"
                icon={<span className="text-base">💚</span>}
                color="bg-emerald-500/20"
                connected={connections.pennylane.connected}
                displayName={connections.pennylane.displayName}
                onConnect={() => setModal('pennylane')}
                onDisconnect={() => handleDisconnect('pennylane')}
              />

              <ServiceCard
                id="yousign"
                title="Yousign"
                subtitle="Signature électronique des Lettres de Mission — API v3"
                icon={<span className="text-base">✍️</span>}
                color="bg-violet-500/20"
                connected={connections.yousign.connected}
                displayName={connections.yousign.displayName}
                onConnect={() => setModal('yousign')}
                onDisconnect={() => handleDisconnect('yousign')}
              />
            </div>

            {/* Sécurité */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
              <Lock className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-blue-300 mb-1">Sécurité & Confidentialité</p>
                <p className="text-xs text-blue-400/80">
                  Vos clés API sont chiffrées dans Supabase (kv_store, isolé par userId) et mis en cache localement.
                  Elles ne sont jamais partagées entre utilisateurs ni transmises à des tiers.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: Email / Envoi ── */}
        {tab === 'email' && (
          <div className="space-y-4">

            {/* ── Microsoft Outlook / Exchange ── */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <svg viewBox="0 0 23 23" className="w-4 h-4 flex-shrink-0" fill="none">
                  <rect x="1" y="1" width="10" height="10" fill="#f25022"/>
                  <rect x="12" y="1" width="10" height="10" fill="#7fba00"/>
                  <rect x="1" y="12" width="10" height="10" fill="#00a4ef"/>
                  <rect x="12" y="12" width="10" height="10" fill="#ffb900"/>
                </svg>
                <p className="text-sm font-medium text-white">Microsoft Outlook / Exchange</p>
                <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">Priorité 1</span>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-5 flex items-start gap-3">
                <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-300 space-y-1.5">
                  <p>Envoyez vos emails directement depuis votre adresse Microsoft 365 / Exchange professionnelle.</p>
                  <p>Activez l'<strong>authentification à deux facteurs</strong> sur votre compte Microsoft, puis créez un mot de passe d'application.</p>
                  <a href="https://support.microsoft.com/account-billing/using-app-passwords-with-apps-that-don-t-support-two-step-verification-5896ed9b-4263-e681-128a-a6f2979a7944" target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300">
                    <ExternalLink className="w-3 h-3" /> Créer un mot de passe d'application Microsoft
                  </a>
                </div>
              </div>

              <ServiceCard
                id="microsoft"
                title="Microsoft Outlook / Exchange"
                subtitle="Envoi d'emails depuis votre boîte Microsoft 365 ou Exchange — SMTP sécurisé"
                icon={
                  <svg viewBox="0 0 23 23" className="w-6 h-6" fill="none">
                    <rect x="1" y="1" width="10" height="10" fill="#f25022"/>
                    <rect x="12" y="1" width="10" height="10" fill="#7fba00"/>
                    <rect x="1" y="12" width="10" height="10" fill="#00a4ef"/>
                    <rect x="12" y="12" width="10" height="10" fill="#ffb900"/>
                  </svg>
                }
                color="bg-[#0078d4]/20"
                connected={connections.microsoft.connected && !!connections.microsoft.appPassword}
                displayName={connections.microsoft.email
                  ? `Depuis : ${connections.microsoft.email}`
                  : connections.microsoft.displayName}
                onConnect={() => setModal('microsoft')}
                onDisconnect={() => handleDisconnect('microsoft')}
              />

              {connections.microsoft.connected && connections.microsoft.appPassword && (
                <div className="mt-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                  <p className="text-xs text-emerald-300 mb-2">✅ <strong>Outlook configuré</strong> — Les emails seront envoyés depuis votre adresse Microsoft.</p>
                  <div className="space-y-1 text-xs text-emerald-400">
                    <p>• Compte : {connections.microsoft.email ?? '–'}</p>
                    <p>• Nom affiché : {connections.microsoft.displayName ?? '–'}</p>
                    <p>• Mot de passe app : ••••••••••••••••</p>
                  </div>
                </div>
              )}

              {connections.microsoft.connected && !connections.microsoft.appPassword && (
                <div className="mt-4 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                  <p className="text-xs text-amber-300">
                    ℹ️ Microsoft connecté pour SharePoint/GED. Cliquez sur <strong>Configurer</strong> pour ajouter un mot de passe d'application et activer l'envoi d'emails.
                  </p>
                </div>
              )}
            </div>

            {/* ── Google Gmail ── */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <svg viewBox="0 0 48 48" className="w-4 h-4 flex-shrink-0" fill="none">
                  <path d="M43.6 20.5H42V20H24v8h11.3C33.6 33 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" fill="#FFC107"/>
                  <path d="M6.3 14.7 13 19.6C14.8 15.1 19 12 24 12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.6 4 24 4 16.3 4 9.7 8.4 6.3 14.7z" fill="#FF3D00"/>
                  <path d="M24 44c5.5 0 10.5-2.1 14.3-5.5L32.2 33C30.3 34.3 27.9 35 24 35c-5.2 0-9.6-3-11.3-7.2l-6.6 5.1C9.5 39.5 16.2 44 24 44z" fill="#4CAF50"/>
                  <path d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.4 5.5l.1.1 6 4.9c-.4.4 6.5-4.7 6.5-14.5 0-1.2-.1-2.3-.4-3.5z" fill="#1976D2"/>
                </svg>
                <p className="text-sm font-medium text-white">Google Gmail</p>
                <span className="text-xs bg-slate-600/60 text-slate-300 border border-slate-500/30 px-2 py-0.5 rounded-full">Priorité 2</span>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-5 flex items-start gap-3">
                <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-300 space-y-1.5">
                  <p>Envoyez vos emails directement depuis votre adresse Gmail professionnelle.</p>
                  <p>Activez la <strong>validation en 2 étapes</strong> sur votre compte Google, puis créez un mot de passe d'application.</p>
                  <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300">
                    <ExternalLink className="w-3 h-3" /> Créer un mot de passe d'application Google
                  </a>
                </div>
              </div>

              <ServiceCard
                id="google"
                title="Google Gmail"
                subtitle="Envoi d'emails depuis votre adresse Gmail — SMTP sécurisé"
                icon={
                  <svg viewBox="0 0 48 48" className="w-6 h-6" fill="none">
                    <path d="M43.6 20.5H42V20H24v8h11.3C33.6 33 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" fill="#FFC107"/>
                    <path d="M6.3 14.7 13 19.6C14.8 15.1 19 12 24 12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.6 4 24 4 16.3 4 9.7 8.4 6.3 14.7z" fill="#FF3D00"/>
                    <path d="M24 44c5.5 0 10.5-2.1 14.3-5.5L32.2 33C30.3 34.3 27.9 35 24 35c-5.2 0-9.6-3-11.3-7.2l-6.6 5.1C9.5 39.5 16.2 44 24 44z" fill="#4CAF50"/>
                    <path d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.4 5.5l.1.1 6 4.9c-.4.4 6.5-4.7 6.5-14.5 0-1.2-.1-2.3-.4-3.5z" fill="#1976D2"/>
                  </svg>
                }
                color="bg-red-500/20"
                connected={connections.google.connected}
                displayName={connections.google.email
                  ? `Depuis : ${connections.google.email}`
                  : connections.google.displayName}
                onConnect={() => setModal('google')}
                onDisconnect={() => handleDisconnect('google')}
              />

              {connections.google.connected && (
                <div className="mt-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                  <p className="text-xs text-emerald-300 mb-2">✅ <strong>Gmail configuré</strong> — Les emails seront envoyés depuis votre adresse Gmail.</p>
                  <div className="space-y-1 text-xs text-emerald-400">
                    <p>• Compte : {connections.google.email ?? '–'}</p>
                    <p>• Nom affiché : {connections.google.displayName ?? '–'}</p>
                    <p>• Mot de passe app : ••••••••••••••••</p>
                  </div>
                </div>
              )}
            </div>

            {/* ── SendGrid ── */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Send className="w-4 h-4 text-blue-400" />
                <p className="text-sm font-medium text-white">Envoi d'emails — SendGrid</p>
                <span className="text-xs bg-slate-600/60 text-slate-300 border border-slate-500/30 px-2 py-0.5 rounded-full">Priorité 3</span>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-5 flex items-start gap-3">
                <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-300 space-y-1.5">
                  <p><strong>Alternative :</strong> Utilisez SendGrid si vous n'avez pas de boîte Microsoft 365 / Gmail ou souhaitez un envoi transactionnel avancé.</p>
                  <p>Microsoft Outlook et Google Gmail ont la priorité si configurés.</p>
                  <a href="https://sendgrid.com" target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300">
                    <ExternalLink className="w-3 h-3" /> sendgrid.com → Settings → API Keys
                  </a>
                </div>
              </div>

              <ServiceCard
                id="sendgrid"
                title="SendGrid (Email)"
                subtitle="Envoi réel des emails clients, confrères, bienvenue — API Mail Send"
                icon={<Send className="w-5 h-5 text-blue-300" />}
                color="bg-blue-500/20"
                connected={connections.sendgrid.connected}
                displayName={
                  (connections.sendgrid as { fromEmail?: string }).fromEmail
                    ? `Depuis : ${(connections.sendgrid as { fromEmail?: string }).fromEmail}`
                    : connections.sendgrid.displayName
                }
                onConnect={() => setModal('sendgrid')}
                onDisconnect={() => handleDisconnect('sendgrid')}
              />

              {connections.sendgrid.connected && (
                <div className="mt-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                  <p className="text-xs text-emerald-300 mb-2">✅ <strong>SendGrid configuré</strong> — Les emails seront envoyés en production.</p>
                  <div className="space-y-1 text-xs text-emerald-400">
                    <p>• Clé API : •••{connections.sendgrid.apiKey?.slice(-4) ?? '••••'}</p>
                    <p>• Expéditeur : {(connections.sendgrid as { fromEmail?: string }).fromEmail ?? '–'}</p>
                    <p>• Nom affiché : {(connections.sendgrid as { fromName?: string }).fromName ?? connections.sendgrid.displayName ?? '–'}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Status global */}
            {!connections.microsoft.appPassword && !connections.google.connected && !connections.sendgrid.connected && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <p className="text-xs text-amber-300">
                  ⚠️ <strong>Mode démo actif</strong> — Aucun service d'envoi configuré. Les emails sont simulés dans la console du navigateur.
                  Configurez Microsoft Outlook, Google Gmail ou SendGrid pour activer l'envoi réel.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Cabinet ── */}
        {tab === 'cabinet' && (
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-5 h-5 text-blue-400" />
              <p className="text-sm font-medium text-white">Informations de votre cabinet</p>
            </div>
            <p className="text-xs text-slate-500 mb-6">
              Utilisées dans toutes les lettres, emails et documents générés. Ces informations sont propres à votre compte.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <Field label="Nom du cabinet *" value={cabinet.nom} onChange={v => updateCabinet({ nom: v })}
                placeholder="Cabinet Martin Expert-Comptable" icon={<Building2 className="w-4 h-4" />} />
              <Field label="SIREN du cabinet *" value={cabinet.siren} onChange={v => updateCabinet({ siren: v })}
                placeholder="123 456 789" icon={<Hash className="w-4 h-4" />} />
              <Field label="N° d'Ordre OEC *" value={cabinet.numeroOrdre} onChange={v => updateCabinet({ numeroOrdre: v })}
                placeholder="OEC 75-XXXX" icon={<Award className="w-4 h-4" />} />
              <Field label="Téléphone" value={cabinet.telephone} onChange={v => updateCabinet({ telephone: v })}
                placeholder="01 XX XX XX XX" icon={<Phone className="w-4 h-4" />} />
              <Field label="Expert-comptable responsable *" value={cabinet.expertNom} onChange={v => updateCabinet({ expertNom: v })}
                placeholder="Me. Prénom Nom" icon={<User className="w-4 h-4" />} />
              <Field label="Email professionnel" value={cabinet.expertEmail} onChange={v => updateCabinet({ expertEmail: v })}
                placeholder="contact@votre-cabinet.fr" icon={<Mail className="w-4 h-4" />} type="email" />
              <div className="md:col-span-2">
                <Field label="Adresse du cabinet" value={cabinet.adresse} onChange={v => updateCabinet({ adresse: v })}
                  placeholder="12 rue de la Paix" icon={<MapPin className="w-4 h-4" />} />
              </div>
              <Field label="Code postal" value={cabinet.codePostal} onChange={v => updateCabinet({ codePostal: v })}
                placeholder="75001" />
              <Field label="Ville" value={cabinet.ville} onChange={v => updateCabinet({ ville: v })}
                placeholder="Paris" />
              <Field label="Capital social" value={cabinet.capitalSocial} onChange={v => updateCabinet({ capitalSocial: v })}
                placeholder="10 000 €" icon={<Hash className="w-4 h-4" />}
                hint="Affiché dans l'en-tête de toutes les lettres générées" />
            </div>

            {/* Aperçu */}
            <div className="bg-slate-800 border border-slate-600 rounded-xl p-4 mb-5">
              <p className="text-xs font-medium text-slate-400 mb-2">📄 Aperçu en-tête des lettres générées</p>
              {cabinet.nom || cabinet.adresse || cabinet.expertNom ? (
                <div className="text-xs text-slate-300 space-y-0.5 font-mono">
                  <p className="text-white font-bold">{cabinet.nom || '—'}</p>
                  <p>{cabinet.adresse || '—'}{cabinet.codePostal ? `, ${cabinet.codePostal}` : ''}{cabinet.ville ? ` ${cabinet.ville}` : ''}</p>
                  {cabinet.capitalSocial && <p>Capital social : {cabinet.capitalSocial}</p>}
                  <p>N° Ordre : {cabinet.numeroOrdre || '—'} | Tél. : {cabinet.telephone || '—'}</p>
                  <p>Expert-Comptable : {cabinet.expertNom || '—'} | {cabinet.expertEmail || '—'}</p>
                </div>
              ) : (
                <p className="text-xs text-slate-600 italic">Remplissez les champs ci-dessus pour voir l'aperçu.</p>
              )}
            </div>

            {(!cabinet.nom || !cabinet.siren || !cabinet.expertNom) && (
              <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-4">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <p className="text-xs text-amber-300">Les champs marqués * sont nécessaires pour générer les lettres et emails.</p>
              </div>
            )}

            <button
              onClick={handleSaveCabinet}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-medium transition-all"
            >
              {saved
                ? <><CheckCircle2 className="w-4 h-4" /> Sauvegardé !</>
                : <><Settings className="w-4 h-4" /> Sauvegarder les informations cabinet</>}
            </button>
          </div>
        )}
      </main>

      {/* ── Modals ── */}
      {modal === 'microsoft' && (
        <MicrosoftModal
          onSuccess={(email, appPassword, name) => handleConnect('microsoft', { email, appPassword, displayName: name })}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'google' && (
        <GoogleModal
          onSuccess={(email, appPassword, name) => handleConnect('google', { email, appPassword, displayName: name })}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'googleDrive' && (
        <GoogleDriveModal
          onSuccess={(email, folderId, name) => handleConnect('googleDrive', { email, folderId, displayName: name })}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'jesignexpert' && (
        <ApiKeyModal
          title="Configurer JeSignExpert"
          subtitle="Cle API disponible dans votre espace JeSignExpert / Universign"
          docsUrl="https://apps.universign.com/docs"
          color="bg-violet-600"
          initialValues={getInitialValues('jesignexpert')}
          fields={[
            {
              key: 'apiKey',
              label: 'Cle API JeSignExpert (Universign)',
              placeholder: 'votre_cle_api_universign',
              hint: 'Cle sandbox pour les tests, cle production pour l\'envoi reel',
            },
          ]}
          onSuccess={v => handleConnect('jesignexpert', {
            apiKey: v.apiKey,
            displayName: `API •••${v.apiKey.slice(-4)}`,
          })}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'airtable' && (
        <ApiKeyModal
          title="Configurer Airtable"
          subtitle="Token disponible dans Airtable → Compte → Personal access tokens"
          docsUrl="https://airtable.com/create/tokens"
          color="bg-orange-600"
          initialValues={getInitialValues('airtable')}
          fields={[
            {
              key: 'apiKey',
              label: 'Personal Access Token (PAT)',
              placeholder: 'patXXXXXXXXXXXXXXXX.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
              hint: 'Commençant par "pat" — à créer dans les paramètres de votre compte',
            },
            {
              key: 'baseId',
              label: 'ID de la base Airtable',
              placeholder: 'appXXXXXXXXXXXXXX',
              hint: 'Visible dans l\'URL : airtable.com/appXXXX/.../...',
            },
          ]}
          onSuccess={v => handleConnect('airtable', {
            apiKey: v.apiKey,
            baseId: v.baseId,
            displayName: `Base ${v.baseId.slice(0, 8)}...`,
          })}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'pennylane' && (
        <ApiKeyModal
          title="Configurer Pennylane"
          subtitle="Clé API disponible dans Pennylane → Paramètres → Intégrations → API"
          docsUrl="https://pennylane.readme.io/docs"
          color="bg-emerald-600"
          initialValues={getInitialValues('pennylane')}
          fields={[
            {
              key: 'apiKey',
              label: 'Clé API Pennylane',
              placeholder: 'pnl_live_xxxxxxxxxxxxxxxxxxxxxxxxx',
              hint: 'Clé de production commençant par pnl_live_',
            },
          ]}
          onSuccess={v => handleConnect('pennylane', {
            apiKey: v.apiKey,
            displayName: `API •••${v.apiKey.slice(-4)}`,
          })}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'sendgrid' && (
        <ApiKeyModal
          title="Configurer SendGrid"
          subtitle="Créez votre clé dans SendGrid → Settings → API Keys → Create API Key"
          docsUrl="https://app.sendgrid.com/settings/api_keys"
          color="bg-blue-600"
          initialValues={getInitialValues('sendgrid')}
          fields={[
            {
              key: 'apiKey',
              label: 'Clé API SendGrid',
              placeholder: 'SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
              hint: 'Commençant par "SG." — permissions "Mail Send" suffisantes',
            },
            {
              key: 'fromEmail',
              label: 'Email expéditeur vérifié',
              placeholder: 'onboarding@votre-cabinet.fr',
              hint: 'Doit être un expéditeur vérifié dans votre compte SendGrid',
              type: 'email',
            },
            {
              key: 'fromName',
              label: 'Nom affiché (optionnel)',
              placeholder: 'Cabinet Martin Expert-Comptable',
              hint: 'Optionnel — nom visible dans la boîte de réception du destinataire',
              required: false,
            },
          ]}
          onSuccess={v => handleConnect('sendgrid', {
            apiKey: v.apiKey,
            fromEmail: v.fromEmail,
            fromName: v.fromName || undefined,
            displayName: v.fromEmail,
          })}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'yousign' && (
        <ApiKeyModal
          title="Configurer Yousign"
          subtitle="Clé API disponible dans Yousign → Paramètres → API"
          docsUrl="https://developers.yousign.com/docs"
          color="bg-violet-600"
          initialValues={getInitialValues('yousign')}
          fields={[
            {
              key: 'apiKey',
              label: 'Clé API Yousign',
              placeholder: 'ys_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
              hint: 'Clé sandbox (ys_sandbox_...) pour les tests, clé live (ys_live_...) pour la production',
            },
          ]}
          onSuccess={v => handleConnect('yousign', {
            apiKey: v.apiKey,
            displayName: `API •••${v.apiKey.slice(-4)}`,
          })}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

