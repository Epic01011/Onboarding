/**
 * SettingsPage.tsx
 *
 * Page de configuration unifiée du cabinet.
 * Organisée en trois onglets :
 *  1. "Cabinet & IA"       — informations du cabinet + fournisseur d'IA
 *  2. "Emails & Stockage"  — Microsoft 365, Google Gmail, Google Drive, SendGrid
 *  3. "Intégrations"       — API tierces (JeSignExpert, Airtable, Pennylane, Yousign, etc.)
 *
 * Contextes utilisés : useServices (ServicesContext)
 */

import { useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useForm, FieldErrors, FieldError } from 'react-hook-form';
import { toast } from 'sonner';
import {
  Settings, Eye, EyeOff, Save, Building2, Bot, ImageIcon,
  ShieldCheck, Database, CheckCircle2, XCircle, Loader2, RefreshCw,
  Info, ExternalLink, Lock, Key, Send, Search, MapPin, ArrowLeft,
  Landmark,
} from 'lucide-react';
import { supabase, checkSupabaseConnection, type SupabaseConnectionReport } from '../utils/supabaseClient';
import { encryptApiKey, decryptApiKey } from '../utils/cryptoUtils';
import { useAuth } from '../context/AuthContext';
import {
  fetchBySIREN,
  searchCompaniesByName,
  type CompanySuggestion,
  type SirenData,
} from '../services/sirenApi';
import { useServices } from '../context/ServicesContext';
import { useCabinet } from '../context/CabinetContext';
import { ServiceConnections } from '../utils/servicesStorage';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

// ─── Form type (Cabinet & AI tab) ─────────────────────────────────────────────

interface SettingsFormValues {
  cabinet_name: string;
  expert_name: string;
  logo_url: string;
  /** IA par défaut du cabinet */
  ai_provider: 'claude' | 'openai' | 'perplexity';
  /** Clé API Anthropic (Claude) ou OpenAI */
  ai_api_key: string;
  /** Clé API Perplexity (recherche et synthèse web) */
  perplexity_api_key: string;
  // SIREN / firm identity
  siren: string;
  siret: string;
  adresse: string;
  code_postal: string;
  ville: string;
  forme_juridique: string;
  code_naf: string;
  capital_social: string;
}

// ─── Shared field wrapper ──────────────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-gray-700">{label}</Label>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 pb-4 border-b border-gray-100 mb-6">
      <div className="p-2 bg-blue-50 rounded-lg">
        <Icon className="w-5 h-5 text-blue-600" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

// ─── ServiceCard (light theme) ────────────────────────────────────────────────

function ServiceCard({
  title, subtitle, icon, connected, displayName, onConnect, onDisconnect,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  connected: boolean;
  displayName?: string;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 border border-gray-200">
      <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-gray-900">{title}</p>
          {connected && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
              ✓ Connecté
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 truncate">{subtitle}</p>
        {connected && displayName && <p className="text-xs text-green-600 mt-0.5">{displayName}</p>}
      </div>
      <div className="flex-shrink-0">
        {connected ? (
          <button
            type="button"
            onClick={onDisconnect}
            className="text-xs bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            Retirer
          </button>
        ) : (
          <button
            type="button"
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

// ─── TextField (for modals) ───────────────────────────────────────────────────

function TextField({
  label, value, onChange, placeholder, type = 'text', hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
}) {
  const [showPwd, setShowPwd] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPwd ? 'text' : 'password') : type;
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-gray-700">{label}</Label>
      <div className="relative">
        <Input
          type={inputType}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="pr-10"
          autoComplete="off"
          spellCheck={false}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPwd(p => !p)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
            tabIndex={-1}
          >
            {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

// ─── Generic ApiKeyModal ──────────────────────────────────────────────────────

interface ApiKeyFieldDef {
  key: string;
  label: string;
  placeholder: string;
  hint?: string;
  type?: string;
  required?: boolean;
}

function ApiKeyModal({
  title, subtitle, docsUrl, fields, initialValues, onSuccess, onClose,
}: {
  title: string;
  subtitle: string;
  docsUrl?: string;
  fields: ApiKeyFieldDef[];
  initialValues: Record<string, string>;
  onSuccess: (values: Record<string, string>) => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const required = fields.filter(f => f.required !== false);
    const missing = required.find(f => !values[f.key]?.trim());
    if (missing) { toast.error(`Le champ "${missing.label}" est requis`); return; }
    setSaving(true);
    await new Promise(r => setTimeout(r, 400));
    onSuccess(values);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-md shadow-xl">
        <div className="bg-blue-600 rounded-t-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-white">{title}</p>
              <p className="text-xs text-white/70 mt-0.5">{subtitle}</p>
            </div>
            <Key className="w-5 h-5 text-white/70" />
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {fields.map(f => (
            <TextField
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
              className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700">
              <ExternalLink className="w-3 h-3" /> Documentation officielle
            </a>
          )}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Annuler</Button>
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Microsoft modal ──────────────────────────────────────────────────────────

function MicrosoftModal({
  onSuccess, onClose,
}: {
  onSuccess: (email: string, appPassword: string, name: string) => void;
  onClose: () => void;
}) {
  const [email, setEmail] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { toast.error('Email requis'); return; }
    if (!appPassword.trim()) { toast.error("Mot de passe d'application requis"); return; }
    setSaving(true);
    await new Promise(r => setTimeout(r, 400));
    onSuccess(email.trim(), appPassword.trim(), name || email.split('@')[0]);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-md shadow-xl">
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
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-700 space-y-1">
              <p>Connectez votre boîte Microsoft 365 / Exchange pour envoyer tous les emails depuis cette adresse.</p>
              <a href="https://support.microsoft.com/account-billing/using-app-passwords-with-apps-that-don-t-support-two-step-verification-5896ed9b-4263-e681-128a-a6f2979a7944"
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700">
                <ExternalLink className="w-3 h-3" /> Créer un mot de passe d'application Microsoft
              </a>
            </div>
          </div>
          <TextField label="Email Microsoft 365 / Exchange *" value={email} onChange={setEmail}
            placeholder="prenom.nom@votre-cabinet.fr" type="email" />
          <TextField label="Mot de passe d'application *" value={appPassword} onChange={setAppPassword}
            placeholder="Mot de passe généré dans Compte Microsoft → Sécurité" type="password"
            hint="Généré dans Compte Microsoft → Sécurité → Options de sécurité avancées" />
          <TextField label="Nom affiché (optionnel)" value={name} onChange={setName}
            placeholder="Cabinet Martin Expert-Comptable" />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Annuler</Button>
            <Button type="submit" disabled={saving} className="flex-1 bg-[#0078d4] hover:bg-[#006cbf] border-0">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
              {saving ? 'Connexion…' : 'Connecter Outlook'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Google Gmail modal ───────────────────────────────────────────────────────

function GoogleModal({
  onSuccess, onClose,
}: {
  onSuccess: (email: string, appPassword: string, name: string) => void;
  onClose: () => void;
}) {
  const [email, setEmail] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { toast.error('Adresse Gmail requise'); return; }
    if (!appPassword.trim()) { toast.error("Mot de passe d'application requis"); return; }
    if (appPassword.replace(/\s/g, '').length !== 16) {
      toast.error("Le mot de passe d'application doit comporter 16 caractères");
      return;
    }
    setSaving(true);
    await new Promise(r => setTimeout(r, 400));
    onSuccess(email.trim(), appPassword.replace(/\s/g, ''), name || email.split('@')[0]);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-md shadow-xl">
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
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-700 space-y-1">
              <p>Utilisez un <strong>mot de passe d'application</strong> Google (pas votre mot de passe habituel).</p>
              <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-amber-600 hover:text-amber-700">
                <ExternalLink className="w-3 h-3" /> myaccount.google.com/apppasswords
              </a>
            </div>
          </div>
          <TextField label="Adresse Gmail *" value={email} onChange={setEmail}
            placeholder="votre-cabinet@gmail.com" type="email" />
          <TextField label="Mot de passe d'application * (16 caractères)" value={appPassword}
            onChange={setAppPassword} placeholder="xxxx xxxx xxxx xxxx" type="password"
            hint="Généré dans Compte Google → Sécurité → Mots de passe d'application" />
          <TextField label="Nom affiché (optionnel)" value={name} onChange={setName}
            placeholder="Cabinet Martin Expert-Comptable" />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Annuler</Button>
            <Button type="submit" disabled={saving}
              className="flex-1 bg-gradient-to-r from-red-600 to-orange-500 hover:opacity-90 border-0">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
              {saving ? 'Vérification…' : 'Connecter Gmail'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Google Drive modal ───────────────────────────────────────────────────────

function GoogleDriveModal({
  onSuccess, onClose,
}: {
  onSuccess: (email: string, folderId: string, name: string) => void;
  onClose: () => void;
}) {
  const [email, setEmail] = useState('');
  const [folderId, setFolderId] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { toast.error('Adresse Google requise'); return; }
    setSaving(true);
    await new Promise(r => setTimeout(r, 400));
    onSuccess(email.trim(), folderId.trim(), name || email.split('@')[0]);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-md shadow-xl">
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
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-700 space-y-1">
              <p>Connectez votre Google Drive pour stocker et partager les documents clients (GED).</p>
              <a href="https://drive.google.com" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700">
                <ExternalLink className="w-3 h-3" /> Ouvrir Google Drive
              </a>
            </div>
          </div>
          <TextField label="Adresse Google *" value={email} onChange={setEmail}
            placeholder="votre-cabinet@gmail.com" type="email" />
          <TextField label="ID du dossier Drive (optionnel)" value={folderId} onChange={setFolderId}
            placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs"
            hint="Trouvez l'ID dans l'URL : drive.google.com/drive/folders/[ID]" />
          <TextField label="Nom affiché (optionnel)" value={name} onChange={setName}
            placeholder="Drive Cabinet Martin" />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Annuler</Button>
            <Button type="submit" disabled={saving}
              className="flex-1 bg-gradient-to-r from-blue-600 to-green-500 hover:opacity-90 border-0">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
              {saving ? 'Connexion…' : 'Connecter Google Drive'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}


// ─── Page component ───────────────────────────────────────────────────────────

export function SettingsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showPerplexityKey, setShowPerplexityKey] = useState(false);
  const [supabaseReport, setSupabaseReport] = useState<SupabaseConnectionReport | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [checkingKvBridge, setCheckingKvBridge] = useState(false);
  const [kvBridgeResult, setKvBridgeResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Auth context — avoids a getUser() network call on every save
  const { user } = useAuth();

  // Cabinet context — updateCabinet propagates changes app-wide without page refresh
  const { updateCabinet } = useCabinet();

  // Services context — connections, updateService used in Tabs 2 & 3
  const { connections, updateService, loading: servicesLoading } = useServices();
  const [modal, setModal] = useState<keyof ServiceConnections | null>(null);

  // ── SIREN autocomplete state ───────────────────────────────────────────────
  const [sirenSuggestions, setSirenSuggestions] = useState<CompanySuggestion[]>([]);
  const [sirenSearching, setSirenSearching] = useState(false);
  const [sirenLookupLoading, setSirenLookupLoading] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const sirenAppliedRef = useRef(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<SettingsFormValues>({
    defaultValues: {
      cabinet_name: '',
      expert_name: '',
      logo_url: '',
      ai_provider: 'claude',
      ai_api_key: '',
      perplexity_api_key: '',
      siren: '',
      siret: '',
      adresse: '',
      code_postal: '',
      ville: '',
      forme_juridique: '',
      code_naf: '',
      capital_social: '',
    },
  });

  const aiProvider = watch('ai_provider');
  const logoUrl = watch('logo_url');
  const cabinetNameValue = watch('cabinet_name');
  const sirenFieldValue = watch('siren');

  // ── Close suggestions on click outside ──────────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setSirenSuggestions([]);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Debounced autocomplete on cabinet_name ──────────────────────────────────
  useEffect(() => {
    // Skip one cycle right after we auto-filled from SIREN to avoid re-searching
    if (sirenAppliedRef.current) {
      sirenAppliedRef.current = false;
      return;
    }
    const name = (cabinetNameValue ?? '').trim();
    if (name.length < 3) { setSirenSuggestions([]); return; }
    const timer = setTimeout(async () => {
      setSirenSearching(true);
      try {
        const results = await searchCompaniesByName(name);
        setSirenSuggestions(results);
      } finally {
        setSirenSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [cabinetNameValue]);

  // ── Apply SIREN/suggestion data to all form fields ─────────────────────────
  const applySirenData = useCallback((data: CompanySuggestion | SirenData) => {
    sirenAppliedRef.current = true;
    setValue('cabinet_name', data.nomComplet, { shouldDirty: true });
    setValue('adresse', data.adresse ?? '', { shouldDirty: true });
    setValue('code_postal', data.codePostal ?? '', { shouldDirty: true });
    setValue('ville', data.ville ?? '', { shouldDirty: true });
    setValue('forme_juridique', data.formeJuridique ?? '', { shouldDirty: true });
    setValue('code_naf', data.codeNAF ?? '', { shouldDirty: true });
    if ('capitalSocial' in data && data.capitalSocial) {
      setValue('capital_social', data.capitalSocial, { shouldDirty: true });
    }
    if (data.siren) setValue('siren', data.siren, { shouldDirty: true });
    if ('siret' in data && data.siret) setValue('siret', data.siret, { shouldDirty: true });
    // Always overwrite expert_name with official dirigeant data when available.
    if ('nomDirigeant' in data && data.nomDirigeant) {
      const full = [data.prenomDirigeant, data.nomDirigeant].filter(Boolean).join(' ');
      setValue('expert_name', full, { shouldDirty: true });
    }
    setSirenSuggestions([]);
  }, [setValue]);

  // ── Normalise a raw SIREN string to 9 digits (strips spaces) ───────────────
  const normaliseSiren = (raw: string) => (raw ?? '').replace(/\s/g, '');

  // ── Direct SIREN lookup (9-digit button) ────────────────────────────────────
  const handleSirenLookup = async () => {
    const siren = normaliseSiren(sirenFieldValue);
    if (siren.length !== 9) return;
    setSirenLookupLoading(true);
    try {
      const result = await fetchBySIREN(siren);
      if (result.success) {
        applySirenData(result.data);
        toast.success(`✓ Données chargées : ${result.data.nomComplet}`);
      } else {
        toast.error(result.error);
      }
    } finally {
      setSirenLookupLoading(false);
    }
  };

  // ── Load existing settings on mount ───────────────────────────────────────
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const currentUser = user;
    let cancelled = false;

    async function loadSettings() {
      try {
        const { data, error } = await supabase
          .from('cabinet_settings')
          .select('cabinet_name,expert_name,logo_url,ai_provider,ai_api_key,perplexity_api_key,siren,siret,adresse,code_postal,ville,forme_juridique,code_naf,capital_social')
          .eq('user_id', currentUser.id)
          .maybeSingle();

        if (error) {
          console.warn('[SettingsPage] Load error:', error.message);
        }

        if (!cancelled && data) {
          // Decrypt the stored key (returns '' if not yet encrypted or if decryption fails)
          const decryptedKey = data.ai_api_key
            ? await decryptApiKey(data.ai_api_key, currentUser.id)
            : '';

          // Warn user if a key was stored but could not be decrypted locally
          if (data.ai_api_key && !decryptedKey) {
            toast.warning('Impossible de déchiffrer votre clé IA. Veuillez la renseigner à nouveau.');
          }

          // Decrypt the Perplexity key
          const decryptedPerplexityKey = data.perplexity_api_key
            ? await decryptApiKey(data.perplexity_api_key, currentUser.id)
            : '';

          // Normalise ai_provider: DB default was 'anthropic', UI uses 'claude'/'openai'/'perplexity'
          const provider: 'claude' | 'openai' | 'perplexity' =
            data.ai_provider === 'openai' ? 'openai'
            : data.ai_provider === 'perplexity' ? 'perplexity'
            : 'claude';

          // Use reset() so react-hook-form treats loaded values as the new baseline.
          reset({
            cabinet_name: data.cabinet_name ?? '',
            expert_name: data.expert_name ?? '',
            logo_url: data.logo_url ?? '',
            ai_provider: provider,
            ai_api_key: decryptedKey,
            perplexity_api_key: decryptedPerplexityKey,
            siren: data.siren ?? '',
            siret: data.siret ?? '',
            adresse: data.adresse ?? '',
            code_postal: data.code_postal ?? '',
            ville: data.ville ?? '',
            forme_juridique: data.forme_juridique ?? '',
            code_naf: data.code_naf ?? '',
            capital_social: data.capital_social ?? '',
          });
        }
      } catch (err) {
        console.error('[SettingsPage] Unexpected error loading settings:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSettings();
    return () => { cancelled = true; };
  }, [user, reset]);

  // ── Supabase connection check ──────────────────────────────────────────────
  const handleCheckConnection = async () => {
    setCheckingConnection(true);
    try {
      const report = await checkSupabaseConnection();
      setSupabaseReport(report);
    } finally {
      setCheckingConnection(false);
    }
  };

  // ── Secure KV bridge check (client -> /api/supabase-kv -> service role) ───
  const handleCheckKvBridge = async () => {
    if (!user) {
      toast.error('Vous devez etre connecte pour tester le pont KV.');
      return;
    }

    setCheckingKvBridge(true);
    setKvBridgeResult(null);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        throw new Error('Session invalide. Reconnectez-vous puis reessayez.');
      }

      const token = session.access_token;
      const key = `smoke:${user.id}:${Date.now()}`;
      const value = {
        ok: true,
        at: new Date().toISOString(),
        source: 'settings-kv-bridge-test',
      };

      const callKv = async (body: Record<string, unknown>) => {
        const response = await fetch('/api/supabase-kv', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });

        const payload = await response.json().catch(() => ({})) as { error?: string; value?: unknown };
        if (!response.ok) {
          throw new Error(payload.error ?? `Erreur API (${response.status})`);
        }
        return payload;
      };

      await callKv({ op: 'set', key, value, userId: user.id });
      const getPayload = await callKv({ op: 'get', key, userId: user.id });
      const returned = getPayload.value as { ok?: boolean; source?: string } | null;

      if (!returned?.ok || returned.source !== 'settings-kv-bridge-test') {
        throw new Error('Lecture KV incoherente apres ecriture.');
      }

      const message = 'Pont KV securise operationnel (SET + GET OK).';
      setKvBridgeResult({ ok: true, message });
      toast.success(message);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue KV';
      setKvBridgeResult({ ok: false, message });
      toast.error(`Test KV echoue: ${message}`);
    } finally {
      setCheckingKvBridge(false);
    }
  };

  // ── Logo file upload ──────────────────────────────────────────────────────
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate MIME type
    const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp', 'image/gif'];
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      toast.error('Format non supporté. Utilisez PNG, JPG, SVG, WEBP ou GIF.');
      return;
    }

    // Validate file size (max 2 MB)
    const MAX_SIZE_BYTES = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      toast.error('Le fichier est trop volumineux (max 2 Mo).');
      return;
    }

    // Derive a safe extension from the MIME type (no user-controlled path segments)
    const MIME_TO_EXT: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/svg+xml': 'svg',
      'image/webp': 'webp',
      'image/gif': 'gif',
    };
    const fileExt = MIME_TO_EXT[file.type] ?? 'png';
    const fileName = `logos/${user.id}-${Date.now()}.${fileExt}`;

    setUploadingLogo(true);
    try {
      const { error: uploadError } = await supabase.storage
        .from('assets')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('assets').getPublicUrl(fileName);

      setValue('logo_url', data.publicUrl, { shouldDirty: true });
      toast.success('Logo importé avec succès');
    } catch (error: unknown) {
      console.error('Erreur upload logo:', error);
      toast.error("Erreur lors de l'importation du logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  // ── Submit handler (upsert) ────────────────────────────────────────────────
  const onSubmit = async (values: SettingsFormValues) => {
    if (!user) {
      toast.error('Vous devez être connecté pour sauvegarder les paramètres.');
      return;
    }
    setSaving(true);
    try {
      // Encrypt the API key before persisting — never store plaintext.
      // crypto.subtle is only available in secure contexts (HTTPS / localhost).
      let encryptedKey: string | null = null;
      const trimmedKey = (values.ai_api_key ?? '').trim();
      if (trimmedKey) {
        if (!crypto?.subtle) {
          throw new Error(
            "Le chiffrement n'est pas disponible. Assurez-vous d'utiliser une connexion HTTPS."
          );
        }
        encryptedKey = await encryptApiKey(trimmedKey, user.id);
        if (!encryptedKey) {
          throw new Error('Le chiffrement de la clé API a échoué. Réessayez ou vérifiez votre navigateur.');
        }
      }

      // Encrypt the Perplexity API key before persisting.
      let encryptedPerplexityKey: string | null = null;
      const trimmedPerplexityKey = (values.perplexity_api_key ?? '').trim();
      if (trimmedPerplexityKey) {
        if (!crypto?.subtle) {
          throw new Error(
            "Le chiffrement n'est pas disponible. Assurez-vous d'utiliser une connexion HTTPS."
          );
        }
        encryptedPerplexityKey = await encryptApiKey(trimmedPerplexityKey, user.id);
        if (!encryptedPerplexityKey) {
          throw new Error('Le chiffrement de la clé Perplexity a échoué. Réessayez ou vérifiez votre navigateur.');
        }
      }

      // Columns must match exactly: public.cabinet_settings schema
      const normalizedProvider: 'claude' | 'openai' | 'perplexity' =
        values.ai_provider === 'openai' ? 'openai'
        : values.ai_provider === 'perplexity' ? 'perplexity'
        : 'claude';

      const { error } = await supabase
        .from('cabinet_settings')
        .upsert(
          {
            user_id: user.id,
            cabinet_name: (values.cabinet_name ?? '').trim(),
            expert_name: (values.expert_name ?? '').trim(),
            logo_url: (values.logo_url ?? '').trim() || null,
            ai_provider: normalizedProvider,
            ai_api_key: encryptedKey,
            perplexity_api_key: encryptedPerplexityKey ?? '',
            siren: (values.siren ?? '').trim() || null,
            siret: (values.siret ?? '').trim() || null,
            adresse: (values.adresse ?? '').trim() || null,
            code_postal: (values.code_postal ?? '').trim() || null,
            ville: (values.ville ?? '').trim() || null,
            forme_juridique: (values.forme_juridique ?? '').trim() || null,
            code_naf: (values.code_naf ?? '').trim() || null,
            capital_social: (values.capital_social ?? '').trim() || null,
          },
          { onConflict: 'user_id' },
        );

      if (error) {
        console.error('[SettingsPage] Upsert error:', error);
        toast.error(`Erreur lors de la sauvegarde : ${error.message}`);
        return;
      }

      // Reset form baseline so isDirty becomes false again — this keeps
      // all filled values in place (form doesn't clear after save).
      reset(values);
      updateCabinet({
        nom: (values.cabinet_name ?? '').trim(),
        expertNom: (values.expert_name ?? '').trim(),
        cabinetLogoUrl: (values.logo_url ?? '').trim() || undefined,
        aiProvider: normalizedProvider,
        aiApiKey: encryptedKey ?? undefined,
        perplexityApiKey: encryptedPerplexityKey ?? undefined,
        siren: (values.siren ?? '').trim(),
        adresse: (values.adresse ?? '').trim(),
        codePostal: (values.code_postal ?? '').trim(),
        ville: (values.ville ?? '').trim(),
        capitalSocial: (values.capital_social ?? '').trim(),
      });
      toast.success('Paramètres sauvegardés avec succès !');
    } catch (err) {
      console.error('[SettingsPage] Save error:', err);
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // ─── Service connection helpers ─────────────────────────────────────────────

  const handleConnect = async (
    service: keyof ServiceConnections,
    data: Partial<typeof connections.microsoft>,
  ) => {
    await updateService(service, { ...data, connected: true, connectedAt: new Date().toISOString() });
    setModal(null);

    // Persist credentials to Supabase (encrypted)
    // The credentials object is serialized as JSON before encryption.
    // Property order is not significant as the entire blob is decrypted
    // as-is and then JSON.parsed back to the original object.
    if (user && crypto?.subtle) {
      try {
        const encrypted = await encryptApiKey(JSON.stringify(data), user.id);
        await supabase.from('user_integrations').upsert(
          { user_id: user.id, service_name: service, is_connected: true, encrypted_credentials: encrypted },
          { onConflict: 'user_id,service_name' },
        );
      } catch (err) {
        console.error('[SettingsPage] Failed to save integration to Supabase:', err);
      }
    }

    const labels: Record<keyof ServiceConnections, string> = {
      microsoft: 'Microsoft 365', google: 'Google Gmail', googleDrive: 'Google Drive',
      jesignexpert: 'JeSignExpert', airtable: 'Airtable', pennylane: 'Pennylane',
      sendgrid: 'SendGrid', yousign: 'Yousign', pappers: 'Pappers',
      hubspot: 'HubSpot', pipedrive: 'Pipedrive', impotsgouv: 'Impôts.gouv (DGFIP)',
    };
    toast.success(`${labels[service]} configuré avec succès`);
  };

  const handleDisconnect = async (service: keyof ServiceConnections) => {
    await updateService(service, {
      connected: false, apiKey: undefined, displayName: undefined,
      appPassword: undefined, email: undefined,
    });

    // Update Supabase: mark as disconnected and clear credentials
    if (user) {
      try {
        await supabase.from('user_integrations').upsert(
          { user_id: user.id, service_name: service, is_connected: false, encrypted_credentials: '' },
          { onConflict: 'user_id,service_name' },
        );
      } catch (err) {
        console.error('[SettingsPage] Failed to update integration in Supabase:', err);
      }
    }

    toast.info('Service retiré');
  };

  const getInitialValues = (service: keyof ServiceConnections): Record<string, string> => {
    const c = connections[service];
    return {
      apiKey: c.apiKey ?? '',
      baseId: (c as { baseId?: string }).baseId ?? '',
      fromEmail: (c as { fromEmail?: string }).fromEmail ?? '',
      fromName: (c as { fromName?: string }).fromName ?? '',
      email: c.email ?? '',
      webhookUrl: (c as { webhookUrl?: string }).webhookUrl ?? '',
    };
  };

  const handleInvalidSubmit = (errors: FieldErrors<SettingsFormValues>) => {
    if (import.meta.env.DEV) {
      console.log('Erreurs de validation :', errors);
    }

    const fieldLabels: Partial<Record<keyof SettingsFormValues, string>> = {
      cabinet_name: 'Nom du cabinet',
      expert_name: "Nom de l'expert",
      logo_url: 'URL du logo',
      ai_provider: 'IA par défaut',
      ai_api_key: 'Clé API Anthropic / OpenAI',
      perplexity_api_key: 'Clé API Perplexity',
      siren: 'SIREN',
      siret: 'SIRET',
      adresse: 'Adresse',
      code_postal: 'Code postal',
      ville: 'Ville',
      forme_juridique: 'Forme juridique',
      code_naf: 'Code NAF',
      capital_social: 'Capital social',
    };

    const missing = Object.entries(errors)
      .map(([key, err]) => {
        const label = fieldLabels[key as keyof SettingsFormValues] ?? key;
        const msg = (err as FieldError)?.message;
        return msg ? `${label} (${msg})` : label;
      })
      .join(', ');

    toast.error(
      missing
        ? `Champs obligatoires manquants : ${missing}`
        : 'Veuillez remplir les champs obligatoires.',
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  //
  // IMPORTANT: We intentionally do NOT early-return while loading.
  // Returning early would unmount the form so react-hook-form inputs are never
  // registered before reset() fires.  When inputs register *after* reset(), RHF
  // re-initialises _formValues from the empty defaultValues, silently clobbering
  // the fetched values — which is why cabinet_name appeared filled visually but
  // the required validator saw '' and triggered handleInvalidSubmit.
  //
  // Instead we keep the form in the DOM at all times (inputs register on first
  // render) and show a fixed full-screen overlay while the data is loading.

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      {/* Loading overlay — sits above the form while Supabase data is fetched.
          The form remains mounted so reset() properly propagates values into
          already-registered inputs. */}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-50">
          <div className="flex items-center gap-3 text-gray-500">
            <Settings className="w-5 h-5 animate-spin" />
            <span className="text-sm">Chargement des paramètres…</span>
          </div>
        </div>
      )}
      <div className="max-w-3xl mx-auto">
        {/* Back navigation */}
        <div className="mb-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au tableau de bord
          </button>
        </div>

        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <Settings className="w-6 h-6 text-gray-700" />
            <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
          </div>
          <p className="text-sm text-gray-500 ml-9">
            Configurez votre cabinet, vos connexions email, votre stockage et vos intégrations tierces.
          </p>
        </div>

        <Tabs defaultValue="cabinet-ai">
          <TabsList className="mb-6 w-full flex">
            <TabsTrigger value="cabinet-ai" className="flex-1">🏢 Cabinet &amp; IA</TabsTrigger>
            <TabsTrigger value="emails-storage" className="flex-1 gap-1">
              📧 Emails &amp; Stockage
              {servicesLoading && <Loader2 className="w-3 h-3 animate-spin" />}
            </TabsTrigger>
            <TabsTrigger value="integrations" className="flex-1">🔌 Intégrations</TabsTrigger>
          </TabsList>

          {/* ── TAB 1: Cabinet & IA ─────────────────────────────────────── */}
          <TabsContent value="cabinet-ai">
            <form onSubmit={handleSubmit(onSubmit, handleInvalidSubmit)} className="space-y-8">

              {/* Section 1: Cabinet info */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <SectionHeader
                  icon={Building2}
                  title="Informations du Cabinet"
                  description="Ces informations apparaîtront dans vos documents et emails. Pré-remplissez automatiquement via le SIREN."
                />
                <div className="space-y-5">

                  {/* ── SIREN lookup ─────────────────────────────────────── */}
                  <Field label="Numéro SIREN" hint="Entrez le SIREN (9 chiffres) pour pré-remplir automatiquement toutes les informations du cabinet">
                    <div className="flex gap-2">
                      <Input
                        {...register('siren')}
                        placeholder="123456789"
                        className="font-mono flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleSirenLookup}
                        disabled={sirenLookupLoading || normaliseSiren(sirenFieldValue).length !== 9}
                        className="flex-shrink-0 flex items-center gap-1.5"
                      >
                        {sirenLookupLoading
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Search className="w-3.5 h-3.5" />
                        }
                        {sirenLookupLoading ? 'Recherche…' : 'Rechercher'}
                      </Button>
                    </div>
                  </Field>

                  {/* ── Cabinet name + autocomplete dropdown ─────────────── */}
                  <Field label="Nom du cabinet *" hint="Tapez au moins 3 caractères pour voir les suggestions de l'API SIREN">
                    <div className="relative" ref={suggestionsRef}>
                      <div className="flex items-center gap-2">
                        <Input
                          {...register('cabinet_name', { required: 'Le nom du cabinet est requis' })}
                          placeholder="Cabinet Expert-Comptable"
                          autoComplete="off"
                          className="flex-1"
                        />
                        {sirenSearching && <Loader2 className="w-4 h-4 animate-spin text-gray-400 flex-shrink-0" />}
                      </div>
                      {sirenSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-60 overflow-y-auto">
                          {sirenSuggestions.map(s => (
                            <button
                              key={s.siren}
                              type="button"
                              className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                              onClick={() => applySirenData(s)}
                            >
                              <p className="text-sm font-medium text-gray-900">{s.nomComplet}</p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                SIREN {s.siren} — {s.ville}{s.codePostal ? ` (${s.codePostal})` : ''}
                                {s.formeJuridique ? ` — ${s.formeJuridique}` : ''}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {errors.cabinet_name && (
                      <p className="text-xs text-red-600 mt-1">{errors.cabinet_name.message}</p>
                    )}
                  </Field>

                  {/* ── Expert name ──────────────────────────────────────── */}
                  <Field label="Nom de l'expert" hint="Prénom et nom de l'expert-comptable signataire (auto-rempli depuis le dirigeant SIREN)">
                    <Input
                      {...register('expert_name')}
                      placeholder="Jean Dupont"
                      autoComplete="name"
                    />
                  </Field>

                  {/* ── Address ──────────────────────────────────────────── */}
                  <Field label="Adresse" hint="Adresse du siège social (pré-remplie depuis l'API SIREN)">
                    <Input
                      {...register('adresse')}
                      placeholder="12 rue de la Paix"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Code postal">
                      <Input
                        {...register('code_postal')}
                        placeholder="75001"
                        maxLength={10}
                      />
                    </Field>
                    <Field label="Ville">
                      <Input
                        {...register('ville')}
                        placeholder="Paris"
                      />
                    </Field>
                  </div>

                  {/* ── Forme juridique (readonly from SIREN) ─────────────── */}
                  <Field label="Forme juridique" hint="Remplie automatiquement depuis le SIREN">
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <Input
                        {...register('forme_juridique')}
                        placeholder="SAS, SARL, SCP…"
                        className="pl-8"
                      />
                    </div>
                  </Field>

                  {/* ── Code NAF & Capital social ────── */}
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Code NAF / APE" hint="Rempli via SIREN, modifiable manuellement">
                      <Input
                        {...register('code_naf')}
                        placeholder="6920Z"
                        className="font-mono"
                      />
                    </Field>
                    <Field label="Capital social" hint="Rempli via SIREN, modifiable manuellement">
                      <Input
                        {...register('capital_social')}
                        placeholder="10 000 €"
                      />
                    </Field>
                  </div>

                  {/* ── Logo URL ─────────────────────────────────────────── */}
                  <Field
                    label="Logo du cabinet"
                    hint="Importez un fichier depuis votre ordinateur (PNG ou SVG recommandé, fond transparent)"
                  >
                    <div className="flex gap-3 items-start">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        disabled={uploadingLogo}
                        className="flex-1 cursor-pointer"
                      />
                      {/* Hidden field keeps the Supabase public URL in the form */}
                      <input type="hidden" {...register('logo_url')} />
                      {uploadingLogo ? (
                        <div className="w-16 h-10 rounded border border-gray-200 bg-gray-50 flex items-center justify-center flex-shrink-0">
                          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                        </div>
                      ) : logoUrl ? (
                        <div className="w-16 h-10 rounded border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                          <img
                            key={logoUrl} // Force React à recréer l'image à chaque modification du lien
                            src={logoUrl}
                            alt="Aperçu logo"
                            className="max-h-full max-w-full object-contain"
                            onError={e => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-10 rounded border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center flex-shrink-0">
                          <ImageIcon className="w-4 h-4 text-gray-300" />
                        </div>
                      )}
                    </div>
                  </Field>
                </div>
              </div>

              {/* Section 2: AI settings */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <SectionHeader
                  icon={Bot}
                  title="Configuration de l'IA"
                  description="Configurez vos clés API et choisissez l'IA par défaut pour l'ensemble du cabinet."
                />
                <div className="space-y-5">
                  <Field label="IA par défaut du cabinet">
                    <Select
                      value={aiProvider}
                      onValueChange={val => setValue('ai_provider', val as 'claude' | 'openai' | 'perplexity', { shouldDirty: true })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Sélectionner l'IA par défaut" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="claude">
                          <span className="flex items-center gap-2">
                            <span className="text-base">🤖</span>
                            Claude (Anthropic) — Recommandé
                          </span>
                        </SelectItem>
                        <SelectItem value="openai">
                          <span className="flex items-center gap-2">
                            <span className="text-base">✨</span>
                            GPT (OpenAI)
                          </span>
                        </SelectItem>
                        <SelectItem value="perplexity">
                          <span className="flex items-center gap-2">
                            <span className="text-base">🔍</span>
                            Perplexity AI
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-400 mt-1.5">
                      {aiProvider === 'claude'
                        ? 'Utilise claude-3-5-sonnet-20241022 par défaut.'
                        : aiProvider === 'openai'
                        ? 'Utilise gpt-4o-mini par défaut.'
                        : 'Utilise sonar-pro par défaut (recherche web en temps réel).'}
                    </p>
                  </Field>
                  <Field
                    label="Clé API Anthropic (Claude) / OpenAI"
                    hint={
                      aiProvider === 'openai'
                        ? 'Disponible sur platform.openai.com → API Keys'
                        : 'Disponible sur console.anthropic.com → API Keys'
                    }
                  >
                    <div className="relative">
                      <Input
                        {...register('ai_api_key')}
                        type={showApiKey ? 'text' : 'password'}
                        placeholder={aiProvider === 'openai' ? 'sk-proj-…' : 'sk-ant-api03-…'}
                        className="pr-10 font-mono text-sm"
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(v => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
                        tabIndex={-1}
                        aria-label={showApiKey ? 'Masquer la clé' : 'Afficher la clé'}
                      >
                        {showApiKey
                          ? <EyeOff className="w-4 h-4" />
                          : <Eye className="w-4 h-4" />
                        }
                      </button>
                    </div>
                  </Field>
                  <Field
                    label="Clé API Perplexity"
                    hint="Disponible sur www.perplexity.ai → Settings → API → Generate"
                  >
                    <div className="relative">
                      <Input
                        {...register('perplexity_api_key')}
                        type={showPerplexityKey ? 'text' : 'password'}
                        placeholder="pplx-…"
                        className="pr-10 font-mono text-sm"
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPerplexityKey(v => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
                        tabIndex={-1}
                        aria-label={showPerplexityKey ? 'Masquer la clé' : 'Afficher la clé'}
                      >
                        {showPerplexityKey
                          ? <EyeOff className="w-4 h-4" />
                          : <Eye className="w-4 h-4" />
                        }
                      </button>
                    </div>
                  </Field>
                  <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                    <ShieldCheck className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-green-700 leading-relaxed">
                      Vos clés API sont <strong>chiffrées (AES-256-GCM)</strong> avant d'être stockées.
                      Aucune clé en clair n'est conservée dans la base de données.
                      Les clés sont déchiffrées uniquement en mémoire, lors de la génération de réponses.
                    </p>
                  </div>
                </div>
              </div>

              {/* Section 3: Supabase connection */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <SectionHeader
                  icon={Database}
                  title="Connexion Supabase"
                  description="Vérifiez que la base de données est correctement connectée et accessible."
                />
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCheckConnection}
                      disabled={checkingConnection}
                      className="flex items-center gap-2"
                    >
                      {checkingConnection ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      {checkingConnection ? 'Verification…' : 'Verifier la connexion'}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCheckKvBridge}
                      disabled={checkingKvBridge}
                      className="flex items-center gap-2"
                    >
                      {checkingKvBridge ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-4 h-4" />
                      )}
                      {checkingKvBridge ? 'Test KV…' : 'Tester le pont KV securise'}
                    </Button>
                  </div>

                  {kvBridgeResult && (
                    <div className={`rounded-lg border px-4 py-3 ${kvBridgeResult.ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                      <p className={`text-xs font-medium ${kvBridgeResult.ok ? 'text-green-700' : 'text-red-700'}`}>
                        {kvBridgeResult.ok ? 'KV securise: OK' : 'KV securise: ECHEC'}
                      </p>
                      <p className={`text-xs mt-1 ${kvBridgeResult.ok ? 'text-green-700' : 'text-red-700'}`}>
                        {kvBridgeResult.message}
                      </p>
                    </div>
                  )}

                  {supabaseReport && (
                    <div className="rounded-lg border border-gray-200 overflow-hidden">
                      {[
                        { label: 'Configuration (URL / Clé)', ok: supabaseReport.configured },
                        { label: 'Session authentifiée', ok: supabaseReport.authenticated },
                      ].map(({ label, ok }) => (
                        <div key={label} className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 last:border-b-0">
                          <span className="text-sm text-gray-700">{label}</span>
                          {ok ? (
                            <span className="flex items-center gap-1.5 text-xs font-medium text-green-700">
                              <CheckCircle2 className="w-4 h-4 text-green-500" /> Connecté
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-xs font-medium text-red-700">
                              <XCircle className="w-4 h-4 text-red-500" /> Erreur
                            </span>
                          )}
                        </div>
                      ))}

                      {supabaseReport.authenticated && (
                        <>
                          {(
                            [
                              ['clients', 'Table clients'],
                              ['quotes', 'Table quotes (devis)'],
                              ['prospects', 'Table prospects (CRM)'],
                              ['cabinet_settings', 'Table cabinet_settings'],
                              ['user_integrations', 'Table user_integrations (clés API)'],
                            ] as const
                          ).map(([key, label]) => {
                            const ok = supabaseReport.tables[key];
                            return (
                              <div key={key} className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 last:border-b-0">
                                <span className="text-sm text-gray-700">{label}</span>
                                {ok === null ? (
                                  <span className="text-xs text-gray-400">—</span>
                                ) : ok ? (
                                  <span className="flex items-center gap-1.5 text-xs font-medium text-green-700">
                                    <CheckCircle2 className="w-4 h-4 text-green-500" /> Accessible
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1.5 text-xs font-medium text-red-700">
                                    <XCircle className="w-4 h-4 text-red-500" /> Inaccessible
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </>
                      )}

                      {supabaseReport.error && (
                        <div className="px-4 py-3 bg-red-50 border-t border-red-100">
                          <p className="text-xs text-red-700 font-medium">Erreur : {supabaseReport.error}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Submit */}
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6"
                >
                  {saving ? (
                    <><Settings className="w-4 h-4 animate-spin" />Sauvegarde…</>
                  ) : (
                    <><Save className="w-4 h-4" />Sauvegarder les paramètres</>
                  )}
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* ── TAB 2: Emails & Stockage ────────────────────────────────── */}
          <TabsContent value="emails-storage">
            <div className="space-y-6">
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">
                  Configurez vos services d'envoi d'emails et de stockage de documents. Microsoft Outlook est
                  prioritaire sur Google Gmail, qui est prioritaire sur SendGrid.
                </p>
              </div>

              {/* Microsoft 365 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <svg viewBox="0 0 23 23" className="w-4 h-4" fill="none">
                    <rect x="1" y="1" width="10" height="10" fill="#f25022"/>
                    <rect x="12" y="1" width="10" height="10" fill="#7fba00"/>
                    <rect x="1" y="12" width="10" height="10" fill="#00a4ef"/>
                    <rect x="12" y="12" width="10" height="10" fill="#ffb900"/>
                  </svg>
                  <h3 className="text-sm font-semibold text-gray-900">Microsoft 365 / Outlook</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">Priorité 1</span>
                </div>
                <ServiceCard
                  title="Microsoft Outlook / Exchange"
                  subtitle="Envoi d'emails + SharePoint GED — SMTP app password"
                  icon={
                    <svg viewBox="0 0 23 23" className="w-6 h-6" fill="none">
                      <rect x="1" y="1" width="10" height="10" fill="#f25022"/>
                      <rect x="12" y="1" width="10" height="10" fill="#7fba00"/>
                      <rect x="1" y="12" width="10" height="10" fill="#00a4ef"/>
                      <rect x="12" y="12" width="10" height="10" fill="#ffb900"/>
                    </svg>
                  }
                  connected={connections.microsoft.connected}
                  displayName={connections.microsoft.email ? `Depuis : ${connections.microsoft.email}` : undefined}
                  onConnect={() => setModal('microsoft')}
                  onDisconnect={() => handleDisconnect('microsoft')}
                />
                {connections.microsoft.connected && connections.microsoft.appPassword && (
                  <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4">
                    <p className="text-xs text-green-700 mb-2">✅ <strong>Outlook configuré</strong> — Les emails seront envoyés depuis votre adresse Microsoft.</p>
                    <div className="space-y-1 text-xs text-green-600">
                      <p>• Compte : {connections.microsoft.email ?? '–'}</p>
                      <p>• Nom affiché : {connections.microsoft.displayName ?? '–'}</p>
                      <p>• Mot de passe app : ••••••••••••••••</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Google Gmail */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <svg viewBox="0 0 48 48" className="w-4 h-4" fill="none">
                    <path d="M43.6 20.5H42V20H24v8h11.3C33.6 33 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" fill="#FFC107"/>
                    <path d="M6.3 14.7 13 19.6C14.8 15.1 19 12 24 12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.6 4 24 4 16.3 4 9.7 8.4 6.3 14.7z" fill="#FF3D00"/>
                    <path d="M24 44c5.5 0 10.5-2.1 14.3-5.5L32.2 33C30.3 34.3 27.9 35 24 35c-5.2 0-9.6-3-11.3-7.2l-6.6 5.1C9.5 39.5 16.2 44 24 44z" fill="#4CAF50"/>
                    <path d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.4 5.5l.1.1 6 4.9c-.4.4 6.5-4.7 6.5-14.5 0-1.2-.1-2.3-.4-3.5z" fill="#1976D2"/>
                  </svg>
                  <h3 className="text-sm font-semibold text-gray-900">Google Gmail</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">Priorité 2</span>
                </div>
                <ServiceCard
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
                  connected={connections.google.connected}
                  displayName={connections.google.email ? `Depuis : ${connections.google.email}` : undefined}
                  onConnect={() => setModal('google')}
                  onDisconnect={() => handleDisconnect('google')}
                />
                {connections.google.connected && (
                  <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4">
                    <p className="text-xs text-green-700 mb-2">✅ <strong>Gmail configuré</strong></p>
                    <div className="space-y-1 text-xs text-green-600">
                      <p>• Compte : {connections.google.email ?? '–'}</p>
                      <p>• Nom affiché : {connections.google.displayName ?? '–'}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Google Drive */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <svg viewBox="0 0 87.3 78" className="w-4 h-4" fill="none">
                    <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                    <path d="M43.65 25L29.9 1.2C28.55.4 27 0 25.45 0c-1.55 0-3.1.4-4.45 1.2L3.85 31.5H31.3z" fill="#00ac47"/>
                    <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75L85.1 57.5c.8-1.4 1.2-2.95 1.2-4.5H58.5l5.85 12.65z" fill="#ea4335"/>
                    <path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.95 0H34.35c-1.55 0-3.1.4-4.45 1.2z" fill="#00832d"/>
                    <path d="M58.5 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.45 1.2h50.6c1.55 0 3.1-.4 4.45-1.2z" fill="#2684fc"/>
                    <path d="M73.4 26.5L59.65 2.7c-1.35-.8-2.9-1.2-4.45-1.2h-11.4l12.7 22.2 12.75 22.1 12.85-22.1h-.7z" fill="#ffba00"/>
                  </svg>
                  <h3 className="text-sm font-semibold text-gray-900">Google Drive</h3>
                </div>
                <ServiceCard
                  title="Google Drive"
                  subtitle="GED & stockage documents clients dans votre Drive partagé"
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
                  connected={connections.googleDrive.connected}
                  displayName={connections.googleDrive.email}
                  onConnect={() => setModal('googleDrive')}
                  onDisconnect={() => handleDisconnect('googleDrive')}
                />
              </div>

              {/* SendGrid */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Send className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-semibold text-gray-900">SendGrid</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">Priorité 3</span>
                </div>
                <ServiceCard
                  title="SendGrid (Email)"
                  subtitle="Envoi réel des emails clients, confrères, bienvenue — API Mail Send"
                  icon={<Send className="w-5 h-5 text-blue-600" />}
                  connected={connections.sendgrid.connected}
                  displayName={(() => {
                    const sg = connections.sendgrid as { fromEmail?: string; displayName?: string };
                    return sg.fromEmail ? `Depuis : ${sg.fromEmail}` : sg.displayName;
                  })()}
                  onConnect={() => setModal('sendgrid')}
                  onDisconnect={() => handleDisconnect('sendgrid')}
                />
              </div>

              {!connections.microsoft.appPassword && !connections.google.connected && !connections.sendgrid.connected && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    ⚠️ <strong>Mode démo actif</strong> — Aucun service d'envoi configuré. Les emails sont simulés dans la console.
                    Configurez Microsoft Outlook, Google Gmail ou SendGrid pour activer l'envoi réel.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── TAB 3: Intégrations ─────────────────────────────────────── */}
          <TabsContent value="integrations">
            <div className="space-y-6">
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">
                  Connectez vos outils métier tiers. Vos clés API sont <strong>chiffrées (AES-256-GCM)</strong> avant
                  d'être stockées dans la table <code className="font-mono text-xs">user_integrations</code>.
                </p>
              </div>

              {/* Signature électronique */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <SectionHeader
                  icon={ShieldCheck}
                  title="Signature Électronique"
                  description="Signez vos Lettres de Mission et autres documents contractuels en ligne."
                />
                <div className="space-y-3">
                  <ServiceCard title="Yousign" subtitle="Signature électronique des Lettres de Mission — API v3"
                    icon={<span className="text-base">✍️</span>}
                    connected={connections.yousign.connected} displayName={connections.yousign.displayName}
                    onConnect={() => setModal('yousign')} onDisconnect={() => handleDisconnect('yousign')} />
                  <ServiceCard title="JeSignExpert" subtitle="Signature électronique des documents — API Universign"
                    icon={<span className="text-base">✒️</span>}
                    connected={connections.jesignexpert.connected} displayName={connections.jesignexpert.displayName}
                    onConnect={() => setModal('jesignexpert')} onDisconnect={() => handleDisconnect('jesignexpert')} />
                </div>
              </div>

              {/* Comptabilité & CRM */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <SectionHeader
                  icon={Building2}
                  title="Comptabilité & CRM"
                  description="Synchronisez vos données clients et de facturation avec vos outils métier."
                />
                <div className="space-y-3">
                  <ServiceCard title="Pennylane" subtitle="Provisionnement comptable, mandat SEPA, fiches clients — API REST"
                    icon={<span className="text-base">💚</span>}
                    connected={connections.pennylane.connected} displayName={connections.pennylane.displayName}
                    onConnect={() => setModal('pennylane')} onDisconnect={() => handleDisconnect('pennylane')} />
                  <ServiceCard title="Airtable" subtitle="CRM clients — Base de données des dossiers — Webhook automatique"
                    icon={<span className="text-base">🟠</span>}
                    connected={connections.airtable.connected} displayName={connections.airtable.displayName}
                    onConnect={() => setModal('airtable')} onDisconnect={() => handleDisconnect('airtable')} />
                  <ServiceCard title="HubSpot" subtitle="CRM & marketing — Synchronisation contacts et leads"
                    icon={<span className="text-base">🟧</span>}
                    connected={connections.hubspot.connected} displayName={connections.hubspot.displayName}
                    onConnect={() => setModal('hubspot')} onDisconnect={() => handleDisconnect('hubspot')} />
                  <ServiceCard title="Pipedrive" subtitle="CRM pipeline de vente — Gestion des opportunités"
                    icon={<span className="text-base">🔵</span>}
                    connected={connections.pipedrive.connected} displayName={connections.pipedrive.displayName}
                    onConnect={() => setModal('pipedrive')} onDisconnect={() => handleDisconnect('pipedrive')} />
                </div>
              </div>

              {/* Données entreprises */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <SectionHeader
                  icon={Database}
                  title="Données Entreprises"
                  description="Enrichissez vos dossiers avec les données légales et financières des entreprises."
                />
                <ServiceCard title="Pappers" subtitle="Données légales et financières des entreprises françaises — API"
                  icon={<span className="text-base">📋</span>}
                  connected={connections.pappers.connected} displayName={connections.pappers.displayName}
                  onConnect={() => setModal('pappers')} onDisconnect={() => handleDisconnect('pappers')} />
              </div>

              {/* Conformité Fiscale — DGFIP */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <SectionHeader
                  icon={Landmark}
                  title="Conformité Fiscale — DGFIP (API Entreprise)"
                  description="Attestations de régularité fiscale via l'API Entreprise de l'État. Les échéances fiscales (TVA, IS, CFE) sont récupérées directement depuis Pennylane."
                />

                {/* API Entreprise token info */}
                <div className="mt-4 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                  <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-700 space-y-1">
                    <p>
                      Les attestations fiscales sont obtenues directement via l'API Entreprise v4
                      (entreprise.api.gouv.fr). Renseignez la variable d'environnement{' '}
                      <span className="font-mono font-semibold">VITE_API_ENTREPRISE_TOKEN</span>{' '}
                      dans votre fichier <span className="font-mono">.env</span> pour activer les
                      appels réels.
                    </p>
                    <p>
                      En l'absence de token, l'application fonctionne en mode démonstration avec des
                      URL statiques.
                    </p>
                    <a
                      href="https://entreprise.api.gouv.fr/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                    >
                      <ExternalLink className="w-3 h-3" /> entreprise.api.gouv.fr
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
      {modal === 'microsoft' && (
        <MicrosoftModal
          onSuccess={(email, appPassword, name) => handleConnect('microsoft', { email, appPassword, displayName: name })}
          onClose={() => setModal(null)} />
      )}
      {modal === 'google' && (
        <GoogleModal
          onSuccess={(email, appPassword, name) => handleConnect('google', { email, appPassword, displayName: name })}
          onClose={() => setModal(null)} />
      )}
      {modal === 'googleDrive' && (
        <GoogleDriveModal
          onSuccess={(email, folderId, name) => handleConnect('googleDrive', { email, folderId, displayName: name })}
          onClose={() => setModal(null)} />
      )}
      {modal === 'yousign' && (
        <ApiKeyModal title="Configurer Yousign" subtitle="Clé API disponible dans Yousign → Paramètres → API"
          docsUrl="https://developers.yousign.com/docs" initialValues={getInitialValues('yousign')}
          fields={[{ key: 'apiKey', label: 'Clé API Yousign', placeholder: 'ys_live_…',
            hint: 'Clé sandbox (ys_sandbox_...) pour les tests, clé live (ys_live_...) pour la production' }]}
          onSuccess={v => handleConnect('yousign', { apiKey: v.apiKey, displayName: `API •••${v.apiKey.slice(-4)}` })}
          onClose={() => setModal(null)} />
      )}
      {modal === 'jesignexpert' && (
        <ApiKeyModal title="Configurer JeSignExpert" subtitle="Clé API disponible dans votre espace JeSignExpert / Universign"
          docsUrl="https://apps.universign.com/docs" initialValues={getInitialValues('jesignexpert')}
          fields={[{ key: 'apiKey', label: 'Clé API JeSignExpert (Universign)', placeholder: 'votre_cle_api_universign',
            hint: "Clé sandbox pour les tests, clé production pour l'envoi réel" }]}
          onSuccess={v => handleConnect('jesignexpert', { apiKey: v.apiKey, displayName: `API •••${v.apiKey.slice(-4)}` })}
          onClose={() => setModal(null)} />
      )}
      {modal === 'pennylane' && (
        <ApiKeyModal title="Configurer Pennylane" subtitle="Clé API disponible dans Pennylane → Paramètres → Intégrations → API"
          docsUrl="https://pennylane.readme.io/docs" initialValues={getInitialValues('pennylane')}
          fields={[{ key: 'apiKey', label: 'Clé API Pennylane', placeholder: 'pnl_live_…',
            hint: 'Clé de production commençant par pnl_live_' }]}
          onSuccess={v => handleConnect('pennylane', { apiKey: v.apiKey, displayName: `API •••${v.apiKey.slice(-4)}` })}
          onClose={() => setModal(null)} />
      )}
      {modal === 'airtable' && (
        <ApiKeyModal title="Configurer Airtable" subtitle="Token disponible dans Airtable → Compte → Personal access tokens"
          docsUrl="https://airtable.com/create/tokens" initialValues={getInitialValues('airtable')}
          fields={[
            { key: 'apiKey', label: 'Personal Access Token (PAT)', placeholder: 'patXXX…',
              hint: 'Commençant par "pat" — à créer dans les paramètres de votre compte' },
            { key: 'baseId', label: 'ID de la base Airtable', placeholder: 'appXXXXXXXXXXXXXX',
              hint: "Visible dans l'URL : airtable.com/appXXXX/..." },
          ]}
          onSuccess={v => handleConnect('airtable', { apiKey: v.apiKey, baseId: v.baseId, displayName: `Base ${v.baseId.slice(0, 8)}...` })}
          onClose={() => setModal(null)} />
      )}
      {modal === 'hubspot' && (
        <ApiKeyModal title="Configurer HubSpot" subtitle="Clé API disponible dans HubSpot → Paramètres → Intégrations → Clés API"
          docsUrl="https://developers.hubspot.com/docs/api/private-apps" initialValues={getInitialValues('hubspot')}
          fields={[{ key: 'apiKey', label: "Clé d'accès privé HubSpot", placeholder: 'pat-eu1-…',
            hint: 'Private App Access Token — créez une Private App dans les paramètres HubSpot' }]}
          onSuccess={v => handleConnect('hubspot', { apiKey: v.apiKey, displayName: `API •••${v.apiKey.slice(-4)}` })}
          onClose={() => setModal(null)} />
      )}
      {modal === 'pipedrive' && (
        <ApiKeyModal title="Configurer Pipedrive" subtitle="Clé API disponible dans Pipedrive → Paramètres → Clé API"
          docsUrl="https://pipedrive.readme.io/docs/how-to-find-the-api-token" initialValues={getInitialValues('pipedrive')}
          fields={[{ key: 'apiKey', label: 'Clé API Pipedrive', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
            hint: "Disponible dans Pipedrive → Paramètres de l'utilisateur → Clé API" }]}
          onSuccess={v => handleConnect('pipedrive', { apiKey: v.apiKey, displayName: `API •••${v.apiKey.slice(-4)}` })}
          onClose={() => setModal(null)} />
      )}
      {modal === 'pappers' && (
        <ApiKeyModal title="Configurer Pappers" subtitle="Clé API disponible sur pappers.fr → Mon compte → API"
          docsUrl="https://www.pappers.fr/api/documentation" initialValues={getInitialValues('pappers')}
          fields={[{ key: 'apiKey', label: 'Clé API Pappers', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
            hint: 'Disponible dans votre espace Pappers → Mon compte → API' }]}
          onSuccess={v => handleConnect('pappers', { apiKey: v.apiKey, displayName: `API •••${v.apiKey.slice(-4)}` })}
          onClose={() => setModal(null)} />
      )}
      {modal === 'sendgrid' && (
        <ApiKeyModal title="Configurer SendGrid" subtitle="Créez votre clé dans SendGrid → Settings → API Keys"
          docsUrl="https://app.sendgrid.com/settings/api_keys" initialValues={getInitialValues('sendgrid')}
          fields={[
            { key: 'apiKey', label: 'Clé API SendGrid', placeholder: 'SG.…',
              hint: 'Commençant par "SG." — permissions "Mail Send" suffisantes' },
            { key: 'fromEmail', label: 'Email expéditeur vérifié', placeholder: 'onboarding@votre-cabinet.fr',
              hint: 'Doit être un expéditeur vérifié dans votre compte SendGrid', type: 'email' },
            { key: 'fromName', label: 'Nom affiché (optionnel)', placeholder: 'Cabinet Martin Expert-Comptable',
              required: false },
          ]}
          onSuccess={v => handleConnect('sendgrid', {
            apiKey: v.apiKey, fromEmail: v.fromEmail,
            fromName: v.fromName || undefined, displayName: v.fromEmail,
          })}
          onClose={() => setModal(null)} />
      )}
    </div>
  );
}
