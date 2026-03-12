/**
 * LettreReprise — Moteur de Lettre de Reprise Confraternelle.
 *
 * Architecture :
 *  1. Récupération du template HTML depuis Supabase (slug = 'lettre-reprise-confraternelle')
 *  2. Pré-remplissage depuis CabinetContext (cabinet repreneur) et DossiersContext (client)
 *  3. Formulaire react-hook-form pour les informations du confrère sortant
 *  4. Prévisualisation en temps réel (mergeTemplate) dans un rendu A4 scrollable
 *  5. Génération PDF (window.print) + envoi email avec pièce jointe après préview mail
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import DOMPurify from 'dompurify';
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Mail,
  Send,
  AlertCircle,
  Building2,
  User,
  Printer,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { useCabinet } from '../context/CabinetContext';
import { useDossiersContext } from '../context/DossiersContext';
import { fetchDocumentBySlug } from '../utils/ldmTemplateEngine';
import { buildPrintHtml } from '../components/DocumentPreview';
import { sendEmail } from '../services/emailService';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { ScrollArea } from '../components/ui/scroll-area';
import { Skeleton } from '../components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConfrereFormValues {
  cabinetConfrereNom: string;
  expertConfrereNom: string;
  emailConfrere: string;
  dateDernierExercice: string;
}

// ─── Template merge utility ───────────────────────────────────────────────────

/**
 * Replaces all `{{variable}}` placeholders in `html` with the corresponding
 * values from `data`. Unresolved placeholders are left unchanged.
 */
function mergeTemplate(html: string, data: Record<string, string>): string {
  return html.replace(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g, (_match, key: string) => {
    return key in data ? data[key] : `{{${key}}}`;
  });
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── InfoRow — read-only field with filled/empty indicator ───────────────────

interface InfoRowProps {
  label: string;
  value?: string | null;
  bold?: boolean;
}

function InfoRow({ label, value, bold = false }: InfoRowProps) {
  const filled = Boolean(value);
  return (
    <p className="flex items-center gap-1">
      <span
        aria-hidden="true"
        className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
          filled ? 'bg-emerald-400' : 'bg-amber-400'
        }`}
      />
      <span className="sr-only">{filled ? 'Rempli' : 'Manquant'} :</span>
      <span className="text-slate-500">{label} :</span>{' '}
      {bold ? (
        <strong className={filled ? '' : 'text-amber-600'}>{value || '—'}</strong>
      ) : (
        <span className={filled ? '' : 'text-amber-600'}>{value || '—'}</span>
      )}
    </p>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

const SLUG = 'lettre-reprise-confraternelle';

export function LettreReprise() {
  const navigate = useNavigate();
  const { cabinet } = useCabinet();
  const { dossiers, getDossier, saveDossier } = useDossiersContext();

  // ── Template state ──────────────────────────────────────────────────────────
  const [rawTemplate, setRawTemplate] = useState<string | null>(null);
  const [templateLoading, setTemplateLoading] = useState(true);
  const [templateNotFound, setTemplateNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setTemplateLoading(true);
    setTemplateNotFound(false);
    fetchDocumentBySlug(SLUG).then(content => {
      if (cancelled) return;
      if (!content) {
        setTemplateNotFound(true);
      } else {
        setRawTemplate(content);
      }
      setTemplateLoading(false);
    }).catch(() => {
      if (!cancelled) {
        setTemplateNotFound(true);
        setTemplateLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // ── Dossier selector ────────────────────────────────────────────────────────
  const [selectedDossierId, setSelectedDossierId] = useState<string>('');

  const selectedDossier = useMemo(
    () => dossiers.find(d => d.id === selectedDossierId) ?? null,
    [dossiers, selectedDossierId],
  );

  const clientData = selectedDossier?.clientData ?? null;

  // Auto-select first dossier when list loads
  useEffect(() => {
    if (!selectedDossierId && dossiers.length > 0) {
      setSelectedDossierId(dossiers[0].id);
    }
  }, [dossiers, selectedDossierId]);

  // ── Confrère form ───────────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<ConfrereFormValues>({
    defaultValues: {
      cabinetConfrereNom: '',
      expertConfrereNom: '',
      emailConfrere: '',
      dateDernierExercice: '',
    },
    mode: 'onChange',
  });

  // Track whether emailConfrere was auto-filled from dossier data
  const [emailAutoFilled, setEmailAutoFilled] = useState(false);

  // Pre-fill confrère email when a dossier with a known email is selected
  useEffect(() => {
    if (clientData?.confrereEmail) {
      reset(prev => ({ ...prev, emailConfrere: clientData.confrereEmail }));
      setEmailAutoFilled(true);
    } else {
      setEmailAutoFilled(false);
    }
  }, [clientData?.confrereEmail, reset]);

  const formValues = watch();

  // ── Variable map (real-time merge) ──────────────────────────────────────────
  const today = useMemo(
    () => new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
    [],
  );

  const variableMap = useMemo((): Record<string, string> => ({
    // Cabinet (repreneur)
    cabinet_nom:       cabinet.nom       || '',
    cabinet_adresse:   cabinet.adresse   || '',
    cabinet_ville:     cabinet.ville     || '',
    cabinet_siren:     cabinet.siren     || '',
    cabinet_expert:    cabinet.expertNom || '',
    cabinet_telephone: cabinet.telephone || '',
    cabinet_email:     cabinet.expertEmail || '',
    // Client / Dossier
    nom_client:        clientData?.raisonSociale || clientData?.nom || '',
    client_nom:        clientData?.raisonSociale || clientData?.nom || '',
    client_raison_sociale: clientData?.raisonSociale || '',
    client_siren:      clientData?.siren || '',
    client_adresse:    [clientData?.adresse, clientData?.codePostal, clientData?.ville]
                         .filter(Boolean).join(', '),
    date_debut_mission: clientData?.dateCreation || '',
    date_du_jour:       today,
    // Confrère sortant
    cabinet_confrere_nom:  formValues.cabinetConfrereNom,
    nom_confrere:          formValues.expertConfrereNom,
    expert_confrere_nom:   formValues.expertConfrereNom,
    email_confrere:        formValues.emailConfrere,
    date_dernier_exercice: formValues.dateDernierExercice,
  }), [cabinet, clientData, formValues, today]);

  // ── Merged HTML preview ─────────────────────────────────────────────────────
  const mergedHtml = useMemo(() => {
    if (!rawTemplate) return '';
    const merged = mergeTemplate(rawTemplate, variableMap);
    return DOMPurify.sanitize(merged, { FORCE_BODY: false });
  }, [rawTemplate, variableMap]);

  // ── Email preview modal ─────────────────────────────────────────────────────
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [sending, setSending] = useState(false);

  const emailBodyHtml = useMemo(() => {
    const clientName = escapeHtml(variableMap.nom_client || 'votre client commun');
    const expertConfrere = escapeHtml(formValues.expertConfrereNom || 'Cher Confrère');
    const cabinetRepreneur = escapeHtml(cabinet.nom || 'notre cabinet');
    const expertRepreneur = escapeHtml(cabinet.expertNom || '');
    return `
<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:680px;margin:0 auto;color:#1e293b;">
  <div style="background:#1e3a5f;padding:24px 32px;border-radius:8px 8px 0 0;">
    <h1 style="margin:0;color:#fff;font-size:18px;font-weight:600;">Lettre de Reprise Confraternelle</h1>
    <p style="margin:4px 0 0;color:#93c5fd;font-size:13px;">${cabinetRepreneur}</p>
  </div>
  <div style="background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
    <p style="margin:0 0 16px;">Cher Confrère ${expertConfrere},</p>
    <p style="margin:0 0 16px;line-height:1.7;color:#374151;">
      Conformément aux dispositions du Code de déontologie de la profession d'expert-comptable
      (article 33) et aux règles de l'Ordre des Experts-Comptables, veuillez trouver ci-joint
      la lettre de reprise confraternelle concernant le dossier
      <strong>${clientName}</strong>.
    </p>
    <p style="margin:0 0 16px;line-height:1.7;color:#374151;">
      Nous vous remercions de votre collaboration et restons disponibles pour toute question.
    </p>
    <p style="margin:0;color:#374151;">
      Cordialement,<br />
      <strong>${expertRepreneur}</strong><br />
      ${cabinetRepreneur}
    </p>
  </div>
</div>`.trim();
  }, [variableMap, formValues, cabinet]);

  const handlePrintPreview = useCallback(() => {
    if (!mergedHtml) return;
    const title = `Lettre de Reprise Confraternelle — ${variableMap.nom_client || 'client'}`;
    const html = buildPrintHtml(mergedHtml, title);
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    const triggerPrint = () => { try { win.print(); } catch (err) { console.warn('[LettreReprise] print error:', err); } };
    if (win.document.fonts?.ready) {
      win.document.fonts.ready.then(triggerPrint);
    } else {
      setTimeout(triggerPrint, 1500);
    }
  }, [mergedHtml, variableMap]);

  const onSubmit = useCallback((_data: ConfrereFormValues) => {
    setShowEmailPreview(true);
  }, []);

  const handleSendEmail = useCallback(async () => {
    setSending(true);
    try {
      // Build PDF-ready HTML blob for attachment
      const title = `Lettre de Reprise Confraternelle — ${variableMap.nom_client || 'client'}`;
      const printHtml = buildPrintHtml(mergedHtml, title);
      const htmlBlob = new Blob([printHtml], { type: 'text/html' });
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1] ?? '');
        };
        reader.onerror = reject;
        reader.readAsDataURL(htmlBlob);
      });

      const clientSlug = (variableMap.nom_client || 'client').replace(/\s+/g, '_');
      const filename = `Lettre_Reprise_Confraternelle_${clientSlug}.pdf`;

      const result = await sendEmail({
        to: formValues.emailConfrere,
        toName: formValues.expertConfrereNom || undefined,
        subject: `Lettre de Reprise Confraternelle — ${variableMap.nom_client || 'dossier'} — ${cabinet.nom}`,
        htmlContent: emailBodyHtml,
        emailType: 'lettre-reprise',
        attachments: [{ filename, content: base64, type: 'text/html' }],
      });

      if (result.success) {
        // Mark the confraternal letter as sent in the dossier (backend coherence)
        if (selectedDossierId) {
          const dossier = getDossier(selectedDossierId);
          if (dossier) {
            try {
              await saveDossier({
                ...dossier,
                clientData: { ...dossier.clientData, lettreConfrereEnvoyee: true },
              });
            } catch {
              toast.warning('Lettre envoyée, mais la mise à jour du dossier a échoué');
            }
          }
        }
        toast.success(
          result.demo
            ? 'Email simulé avec succès (mode démo)'
            : 'Lettre envoyée avec succès au confrère ✓',
        );
        setShowEmailPreview(false);
      } else {
        toast.error(result.error ?? "Erreur lors de l'envoi de l'email");
      }
    } catch {
      toast.error("Erreur lors de la préparation de l'envoi");
    } finally {
      setSending(false);
    }
  }, [formValues, mergedHtml, variableMap, cabinet, emailBodyHtml, selectedDossierId, getDossier, saveDossier]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Tableau de bord
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-slate-900">
            Moteur de Reprise Confraternelle
          </h1>
          <p className="text-xs text-slate-500">
            Générez et envoyez votre lettre de reprise confraternelle
          </p>
        </div>
      </div>

      {/* Template not found alert */}
      {templateNotFound && (
        <div className="mx-6 mt-4 flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-700">Template introuvable</p>
            <p className="text-xs text-red-600 mt-0.5">
              Aucun document avec le slug{' '}
              <code className="font-mono bg-red-100 px-1 rounded">
                {SLUG}
              </code>{' '}
              n'a été trouvé dans la base de données. Veuillez le configurer depuis le gestionnaire
              de templates.
            </p>
          </div>
        </div>
      )}

      {/* Split-screen body */}
      <div className="flex flex-col lg:flex-row gap-6 p-6">

        {/* ── Left column: form ── */}
        <div className="w-full lg:w-[420px] shrink-0 space-y-4">

          {/* Dossier selector */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-600" />
                Dossier client
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label htmlFor="dossier-select" className="text-xs text-slate-600">
                Sélectionnez un dossier
              </Label>
              <select
                id="dossier-select"
                value={selectedDossierId}
                onChange={e => setSelectedDossierId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white"
              >
                {dossiers.length === 0 ? (
                  <option value="">Aucun dossier disponible</option>
                ) : (
                  dossiers.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.clientData?.raisonSociale || d.clientData?.nom || d.id}
                    </option>
                  ))
                )}
              </select>
            </CardContent>
          </Card>

          {/* Client & cabinet info (read-only) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <User className="w-4 h-4 text-amber-600" />
                Informations Client &amp; Cabinet
                <span className="ml-auto text-[10px] font-normal text-slate-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  Auto-rempli
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-slate-700">
              <div className="space-y-1">
                <p className="font-medium text-slate-500 uppercase tracking-wide text-[10px]">
                  Client (repreneur)
                </p>
                <InfoRow label="Raison sociale" value={clientData?.raisonSociale || clientData?.nom} />
                <InfoRow label="SIREN" value={clientData?.siren} />
                <InfoRow
                  label="Adresse"
                  value={[clientData?.adresse, clientData?.codePostal, clientData?.ville]
                    .filter(Boolean)
                    .join(', ')}
                />
                <InfoRow label="Date de début" value={clientData?.dateCreation} />
              </div>
              <div className="border-t border-slate-100 pt-3 space-y-1">
                <p className="font-medium text-slate-500 uppercase tracking-wide text-[10px]">
                  Cabinet (repreneur)
                </p>
                <InfoRow label="Cabinet" value={cabinet.nom} bold />
                <InfoRow label="Expert" value={cabinet.expertNom} />
                <InfoRow label="Email" value={cabinet.expertEmail} />
                <InfoRow
                  label="Adresse"
                  value={[cabinet.adresse, cabinet.codePostal, cabinet.ville]
                    .filter(Boolean)
                    .join(', ')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Confrère form */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Mail className="w-4 h-4 text-amber-600" />
                Confrère sortant
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Cabinet du confrère */}
                <div className="space-y-1.5">
                  <Label htmlFor="cabinetConfrereNom" className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                    Nom du cabinet du confrère
                    <span className="text-[10px] font-normal text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                      À saisir
                    </span>
                  </Label>
                  <Input
                    id="cabinetConfrereNom"
                    placeholder="Cabinet Martin & Associés"
                    {...register('cabinetConfrereNom')}
                  />
                </div>

                {/* Expert sortant */}
                <div className="space-y-1.5">
                  <Label htmlFor="expertConfrereNom" className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                    Nom de l'expert-comptable sortant
                    <span className="text-[10px] font-normal text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                      À saisir
                    </span>
                  </Label>
                  <Input
                    id="expertConfrereNom"
                    placeholder="Maître Jean Martin"
                    {...register('expertConfrereNom')}
                  />
                </div>

                {/* Email du confrère */}
                <div className="space-y-1.5">
                  <Label htmlFor="emailConfrere" className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                    Email du confrère{' '}
                    <span className="text-red-500">*</span>
                    {emailAutoFilled ? (
                      <span className="text-[10px] font-normal text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Auto-rempli depuis le dossier
                      </span>
                    ) : (
                      <span className="text-[10px] font-normal text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                        À saisir
                      </span>
                    )}
                  </Label>
                  <Input
                    id="emailConfrere"
                    type="email"
                    placeholder="confrere@cabinet.fr"
                    {...register('emailConfrere', {
                      required: "L'email du confrère est requis pour l'envoi",
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message: 'Adresse email invalide',
                      },
                    })}
                    className={errors.emailConfrere ? 'border-red-400 focus:ring-red-400' : ''}
                  />
                  {errors.emailConfrere && (
                    <p className="text-xs text-red-500">{errors.emailConfrere.message}</p>
                  )}
                </div>

                {/* Date dernier exercice */}
                <div className="space-y-1.5">
                  <Label htmlFor="dateDernierExercice" className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                    Date du dernier exercice clôturé
                    <span className="text-[10px] font-normal text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                      À saisir
                    </span>
                  </Label>
                  <Input
                    id="dateDernierExercice"
                    type="date"
                    {...register('dateDernierExercice')}
                  />
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <Button
                    type="submit"
                    disabled={templateLoading || templateNotFound}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Générer et Envoyer par Email
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={templateLoading || templateNotFound || !mergedHtml}
                    onClick={handlePrintPreview}
                    className="w-full"
                  >
                    <Printer className="w-4 h-4 mr-2" />
                    Aperçu / Imprimer PDF
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* ── Right column: A4 preview ── */}
        <div className="flex-1 min-w-0">
          <div className="sticky top-6">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
              Prévisualisation du document
            </p>
            <ScrollArea className="h-[calc(100vh-160px)] rounded-xl border border-slate-200 bg-slate-100">
              <div className="p-8">
                {templateLoading ? (
                  /* Skeleton while fetching template */
                  <div className="max-w-[21cm] min-h-[29.7cm] bg-white rounded-lg shadow-lg mx-auto p-[3cm] space-y-4">
                    <Skeleton className="h-6 w-1/3" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-1/2" />
                    <div className="pt-4 space-y-2">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-4/5" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-3/4" />
                    </div>
                    <div className="pt-4 space-y-2">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </div>
                ) : templateNotFound ? (
                  <div className="max-w-[21cm] min-h-[29.7cm] bg-white rounded-lg shadow-lg mx-auto p-[3cm] flex items-center justify-center">
                    <div className="text-center text-slate-400">
                      <AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-300" />
                      <p className="text-sm font-medium text-red-500">Template non configuré</p>
                      <p className="text-xs mt-1">
                        Ajoutez le document avec le slug{' '}
                        <code className="font-mono bg-slate-100 px-1 rounded">{SLUG}</code>{' '}
                        dans la base de données.
                      </p>
                    </div>
                  </div>
                ) : (
                  /* A4 white page */
                  <div
                    className="max-w-[21cm] min-h-[29.7cm] bg-white rounded-lg shadow-lg mx-auto p-[2.5cm]"
                    style={{
                      fontFamily: "'Playfair Display', Georgia, serif",
                      fontSize: '11pt',
                      lineHeight: '1.7',
                      color: '#1e293b',
                    }}
                    dangerouslySetInnerHTML={{ __html: mergedHtml }}
                  />
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>

      {/* ── Email preview dialog ── */}
      <Dialog open={showEmailPreview} onOpenChange={setShowEmailPreview}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-amber-600" />
              Aperçu de l'email avant envoi
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-xs text-slate-600 space-y-1 bg-slate-50 rounded-lg p-3">
              <p>
                <span className="font-medium text-slate-700">À :</span>{' '}
                {formValues.emailConfrere || '—'}
              </p>
              <p>
                <span className="font-medium text-slate-700">Objet :</span>{' '}
                Lettre de Reprise Confraternelle — {variableMap.nom_client || 'dossier'} —{' '}
                {cabinet.nom}
              </p>
              <p>
                <span className="font-medium text-slate-700">Pièce jointe :</span>{' '}
                Lettre_Reprise_Confraternelle_{(variableMap.nom_client || 'client').replace(/\s+/g, '_')}.pdf
              </p>
            </div>

            <div
              className="rounded-lg border border-slate-200 overflow-hidden"
              dangerouslySetInnerHTML={{ __html: emailBodyHtml }}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowEmailPreview(false)}
              disabled={sending}
            >
              <X className="w-4 h-4 mr-1" />
              Annuler
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={sending}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Envoi en cours…
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Confirmer l'envoi
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
