/**
 * Service d'envoi d'emails — Microsoft Outlook/Exchange, Google Gmail, SendGrid
 *
 * CONFIGURATION (dans /setup → Envoi d'emails) :
 *   Option 1 — Microsoft Outlook / Exchange (priorité 1) :
 *     - Adresse email Microsoft 365 / Exchange
 *     - Mot de passe d'application (App Password)
 *   Option 2 — Google Gmail :
 *     - Adresse Gmail
 *     - Mot de passe d'application Google (App Password)
 *   Option 3 — SendGrid :
 *     - Clé API SendGrid (sg.xxxxxxxxxx)
 *     - Email expéditeur vérifié
 *     - Nom expéditeur
 *
 * Ou via variables d'environnement (SendGrid fallback) :
 *   VITE_SENDGRID_API_KEY, VITE_FROM_EMAIL, VITE_FROM_NAME
 *
 * Les emails sont envoyés via /api/send-email (Vercel serverless).
 */

import { getEmailConfig, getCabinetInfo } from '../utils/servicesStorage';
import { delay } from '../utils/delay';
import { logSentEmail } from '../utils/supabaseSync';

/** Escape HTML special characters to prevent injection in email templates */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface EmailPayload {
  to: string;
  toName?: string;
  subject: string;
  htmlContent: string;
  /** Optional tag identifying the email type (e.g. 'proposal', 'ldm', 'welcome'). */
  emailType?: string;
  attachments?: { filename: string; content: string; type: string }[];
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  demo?: boolean;
}

export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  await delay(800);

  const config = getEmailConfig();

  if (config.isDemo) {
    console.log(`[EMAIL DEMO] Sujet: "${payload.subject}" → ${payload.to}`);
    const demoId = `demo_${Date.now()}`;
    // Log demo send so the Email Engine shows it in the dashboard
    logSentEmail({
      recipientEmail: payload.to,
      recipientName: payload.toName,
      subject: payload.subject,
      htmlContent: payload.htmlContent,
      emailType: payload.emailType,
      demo: true,
      messageId: demoId,
    }).catch(() => { /* non-blocking */ });
    return {
      success: true,
      messageId: demoId,
      demo: true,
    };
  }

  try {
    if (config.provider === 'microsoft' || config.provider === 'google') {
      // ── Microsoft Outlook / Exchange  OR  Google Gmail via /api/send-email ──
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: payload.to,
          toName: payload.toName,
          subject: payload.subject,
          htmlContent: payload.htmlContent,
          provider: config.provider,
          credentials: {
            email: config.fromEmail,
            appPassword: config.appPassword,
            fromName: config.fromName,
          },
          attachments: payload.attachments,
        }),
      });

      let data: { success?: boolean; messageId?: string; error?: string };
      try {
        data = await res.json() as { success?: boolean; messageId?: string; error?: string };
      } catch {
        // Server returned a non-JSON body (e.g. an HTML error page from Vercel)
        return { success: false, error: `Erreur serveur (HTTP ${res.status}) — vérifiez les logs de déploiement` };
      }

      if (data.success) {
        const label = config.provider === 'microsoft' ? 'Outlook' : 'Gmail';
        console.log(`[EMAIL SENT via ${label}] ${payload.subject} → ${payload.to}`);
        logSentEmail({
          recipientEmail: payload.to,
          recipientName: payload.toName,
          subject: payload.subject,
          htmlContent: payload.htmlContent,
          emailType: payload.emailType,
          demo: false,
          messageId: data.messageId,
        }).catch(() => { /* non-blocking */ });
        return { success: true, messageId: data.messageId };
      }
      const label = config.provider === 'microsoft' ? 'Outlook' : 'Gmail';
      return { success: false, error: data.error ?? `Erreur ${label} (code ${res.status})` };

    } else {
      // ── SendGrid via /api/send-email serverless relay ───────────────────
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: payload.to,
          toName: payload.toName,
          subject: payload.subject,
          htmlContent: payload.htmlContent,
          provider: 'sendgrid',
          credentials: {
            apiKey: config.apiKey,
            fromEmail: config.fromEmail,
            fromName: config.fromName,
          },
          attachments: payload.attachments,
        }),
      });

      let data: { success?: boolean; messageId?: string; error?: string };
      try {
        data = await res.json() as { success?: boolean; messageId?: string; error?: string };
      } catch {
        // Server returned a non-JSON body (e.g. an HTML error page from Vercel)
        return { success: false, error: `Erreur serveur (HTTP ${res.status}) — vérifiez les logs de déploiement` };
      }

      if (data.success) {
        console.log(`[EMAIL SENT via SendGrid] ${payload.subject} → ${payload.to}`);
        logSentEmail({
          recipientEmail: payload.to,
          recipientName: payload.toName,
          subject: payload.subject,
          htmlContent: payload.htmlContent,
          emailType: payload.emailType,
          demo: false,
          messageId: data.messageId,
        }).catch(() => { /* non-blocking */ });
        return { success: true, messageId: data.messageId };
      }
      return { success: false, error: data.error ?? `Erreur SendGrid (code ${res.status})` };
    }
  } catch (err: unknown) {
    console.error('[EMAIL ERROR]', err);
    const msg = err instanceof TypeError
      ? 'Impossible de joindre /api/send-email — vérifiez que le serveur est démarré'
      : (err instanceof Error ? err.message : 'Erreur inconnue lors de l\'envoi');
    return { success: false, error: msg };
  }
}

// ─── Templates HTML des emails ──────────────────────────────────────────────

function emailHeader(cabinet: ReturnType<typeof getCabinetInfo>): string {
  return `
    <div style="background: linear-gradient(135deg, #1e3a5f 0%, #0f2441 100%); padding: 28px 32px; border-radius: 12px 12px 0 0;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0">
        <tr>
          <td>
            <div style="font-size: 22px; font-weight: 700; color: white; letter-spacing: -0.5px;">⚡ ${escapeHtml(cabinet.nom)}</div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-top: 4px;">${escapeHtml(cabinet.adresse)} — ${escapeHtml(cabinet.codePostal)} ${escapeHtml(cabinet.ville)} | N° Ordre : ${escapeHtml(cabinet.numeroOrdre)}</div>
          </td>
          <td style="text-align: right; vertical-align: top;">
            <div style="background: rgba(255,255,255,0.1); border-radius: 8px; padding: 8px 14px; display: inline-block;">
              <div style="font-size: 11px; color: rgba(255,255,255,0.7);">Membre de l'Ordre des</div>
              <div style="font-size: 11px; color: white; font-weight: 600;">Experts-Comptables</div>
            </div>
          </td>
        </tr>
      </table>
    </div>
  `;
}

function emailFooter(cabinet: ReturnType<typeof getCabinetInfo>): string {
  return `
    <div style="background: #f1f5f9; padding: 16px 32px; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
      <div style="font-size: 11px; color: #94a3b8; text-align: center;">
        ${escapeHtml(cabinet.nom)} — ${escapeHtml(cabinet.adresse)}, ${escapeHtml(cabinet.codePostal)} ${escapeHtml(cabinet.ville)} — Tél : ${escapeHtml(cabinet.telephone)}<br/>
        SIREN : ${escapeHtml(cabinet.siren)} | N° Ordre OEC : ${escapeHtml(cabinet.numeroOrdre)}
      </div>
    </div>
  `;
}

function emailWrapper(cabinet: ReturnType<typeof getCabinetInfo>, content: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width: 620px; margin: 0 auto; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
      ${emailHeader(cabinet)}
      <div style="background: #ffffff; padding: 32px;">
        ${content}
      </div>
      ${emailFooter(cabinet)}
    </div>
  `;
}

/** Template : Demande de documents au client */
export function buildDocumentRequestEmail(params: {
  clientName: string;
  cabinetName: string;
  uploadLink: string;
  documents: string[];
}): string {
  const cabinet = getCabinetInfo();
  const docList = params.documents
    .map(
      d => `<li style="padding: 6px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #374151;">${escapeHtml(d)}</li>`
    )
    .join('');

  const content = `
    <p style="color: #374151; margin-bottom: 8px;">Madame, Monsieur <strong>${escapeHtml(params.clientName)}</strong>,</p>
    <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
      Dans le cadre de l'ouverture de votre dossier chez <strong style="color: #1e3a5f;">${escapeHtml(params.cabinetName)}</strong>,
      nous vous remercions de bien vouloir nous faire parvenir les pièces suivantes :
    </p>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 20px; margin-bottom: 24px;">
      <ul style="list-style: none; margin: 0; padding: 0;">
        ${docList}
      </ul>
    </div>
    <p style="color: #6b7280; font-size: 14px; margin-bottom: 24px;">
      Vous pouvez déposer vos documents <strong>en toute sécurité</strong> via le lien ci-dessous (SharePoint) :
    </p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${escapeHtml(params.uploadLink)}"
        style="background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(37,99,235,0.3);">
        📁 Déposer mes documents
      </a>
    </div>
    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px;">
      <p style="color: #1d4ed8; font-size: 12px; margin: 0;">
        🔒 Vos documents seront classés automatiquement dans notre système de gestion documentaire sécurisé (SharePoint).
        Ce lien est valable 30 jours.
      </p>
    </div>
    <p style="color: #9ca3af; font-size: 13px;">
      En cas de difficulté, n'hésitez pas à nous contacter : <a href="mailto:${escapeHtml(cabinet.expertEmail)}" style="color: #2563eb;">${escapeHtml(cabinet.expertEmail)}</a> — ${escapeHtml(cabinet.telephone)}
    </p>
    <p style="color: #374151; margin-top: 24px;">Cordialement,<br/><strong style="color: #1e3a5f;">${escapeHtml(cabinet.expertNom)}</strong><br/><span style="color: #6b7280; font-size: 13px;">${escapeHtml(cabinet.nom)}</span></p>
  `;

  return emailWrapper(cabinet, content);
}

/** Template : Demande de délégations accès gouvernementaux */
export function buildDelegationRequestEmail(params: {
  clientName: string;
  cabinetName: string;
  cabinetSiren: string;
}): string {
  const cabinet = getCabinetInfo();

  const content = `
    <p style="color: #374151; margin-bottom: 8px;">Madame, Monsieur <strong>${escapeHtml(params.clientName)}</strong>,</p>
    <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
      Afin que notre cabinet puisse intervenir en votre nom auprès des administrations fiscales et sociales,
      nous vous remercions de bien vouloir nous accorder les délégations d'accès suivantes :
    </p>

    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; margin-bottom: 20px;">
      <div style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 20px;">🏛️</span>
          <div>
            <strong style="color: #1e3a5f; font-size: 14px;">Impots.gouv.fr — Espace Professionnel</strong><br/>
            <span style="font-size: 12px; color: #6b7280;">Espace Pro → Gérer mes accès → Ajouter un mandataire</span>
          </div>
        </div>
        <div style="background: #eff6ff; border-radius: 6px; padding: 8px 12px; margin-top: 10px;">
          <span style="font-size: 12px; color: #1d4ed8;">SIREN du cabinet à renseigner : <strong>${escapeHtml(params.cabinetSiren)}</strong></span>
        </div>
      </div>
      <div style="padding: 16px 20px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 20px;">🏢</span>
          <div>
            <strong style="color: #1e3a5f; font-size: 14px;">URSSAF.fr — Mon compte</strong><br/>
            <span style="font-size: 12px; color: #6b7280;">Mon compte → Gérer les accès → Délégation de gestion</span>
          </div>
        </div>
        <div style="background: #eff6ff; border-radius: 6px; padding: 8px 12px; margin-top: 10px;">
          <span style="font-size: 12px; color: #1d4ed8;">Saisissez notre identifiant cabinet (SIREN : <strong>${escapeHtml(params.cabinetSiren)}</strong>)</span>
        </div>
      </div>
    </div>

    <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
      <p style="color: #92400e; font-size: 12px; margin: 0;">
        ⚠️ Une fois les délégations effectuées, merci de nous transmettre vos identifiants de connexion
        en réponse à cet email afin que nous puissions vérifier l'accès et commencer nos interventions.
      </p>
    </div>

    <p style="color: #6b7280; font-size: 13px; line-height: 1.6;">
      Ces accès sont strictement nécessaires à l'exécution de notre mission. Ils sont traités de manière confidentielle,
      conservés de manière sécurisée et n'excèdent pas le périmètre de notre lettre de mission.
    </p>

    <p style="color: #374151; margin-top: 24px;">
      Restant à votre disposition pour toute question,<br/>
      <strong style="color: #1e3a5f;">${escapeHtml(cabinet.expertNom)}</strong><br/>
      <span style="color: #6b7280; font-size: 13px;">${escapeHtml(cabinet.nom)} — ${escapeHtml(cabinet.telephone)}</span>
    </p>
  `;

  return emailWrapper(cabinet, content);
}

/** Template : Email de bienvenue officiel */
export function buildWelcomeEmail(params: {
  clientName: string;
  raisonSociale: string;
  pennylaneId: string;
  clientEmail: string;
  expertEmail: string;
  expertName: string;
}): string {
  const cabinet = getCabinetInfo();

  const content = `
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="font-size: 48px; margin-bottom: 12px;">🎉</div>
      <h1 style="font-size: 22px; color: #1e3a5f; margin: 0 0 8px 0;">Bienvenue chez ${escapeHtml(cabinet.nom)} !</h1>
      <p style="color: #6b7280; font-size: 14px; margin: 0;">Votre dossier est désormais entièrement opérationnel.</p>
    </div>

    <p style="color: #374151; margin-bottom: 24px;">Madame, Monsieur <strong>${escapeHtml(params.clientName)}</strong>,</p>
    <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin-bottom: 28px;">
      Nous avons le plaisir de vous confirmer que votre dossier <strong>${escapeHtml(params.raisonSociale)}</strong> est
      désormais entièrement traité et que toutes les fonctionnalités de notre collaboration sont actives.
    </p>

    <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 10px; padding: 20px; margin-bottom: 20px;">
      <h3 style="font-size: 13px; font-weight: 600; color: #166534; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.5px;">✅ Ce qui est prêt</h3>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
        ${['Dossier SIREN vérifié', 'Documents KYC validés', 'Lettre de Mission signée', 'Espace SharePoint créé', 'Délégations fiscales actives', 'Compte Pennylane ouvert'].map(item =>
          `<div style="font-size: 12px; color: #166534;">✓ ${item}</div>`
        ).join('')}
      </div>
    </div>

    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 20px; margin-bottom: 20px;">
      <h3 style="font-size: 13px; font-weight: 600; color: #1e40af; margin: 0 0 12px 0;">🔐 Votre accès Pennylane</h3>
      <p style="font-size: 13px; color: #1d4ed8; margin: 0 0 8px 0;">
        Identifiant : <strong>${escapeHtml(params.pennylaneId)}</strong><br/>
        Plateforme : <a href="https://app.pennylane.com" style="color: #2563eb; font-weight: 600;">app.pennylane.com</a><br/>
        Email de connexion : <strong>${escapeHtml(params.clientEmail)}</strong>
      </p>
    </div>

    <div style="background: #faf5ff; border: 1px solid #d8b4fe; border-radius: 10px; padding: 20px; margin-bottom: 28px;">
      <h3 style="font-size: 13px; font-weight: 600; color: #6b21a8; margin: 0 0 8px 0;">👤 Votre gestionnaire dédié</h3>
      <p style="font-size: 13px; color: #7e22ce; margin: 0;">
        <strong>${escapeHtml(params.expertName)}</strong><br/>
        <a href="mailto:${escapeHtml(params.expertEmail)}" style="color: #7c3aed;">${escapeHtml(params.expertEmail)}</a>
      </p>
    </div>

    <p style="color: #6b7280; font-size: 13px; line-height: 1.6; margin-bottom: 24px;">
      N'hésitez pas à nous contacter pour toute question. Nous sommes à votre disposition du lundi au vendredi,
      de 9h à 18h.
    </p>

    <p style="color: #374151; margin-top: 24px;">
      Cordialement et avec plaisir de vous compter parmi nos clients,<br/>
      <strong style="color: #1e3a5f;">${escapeHtml(params.expertName)}</strong><br/>
      <span style="color: #6b7280; font-size: 13px;">${escapeHtml(cabinet.nom)} — ${escapeHtml(cabinet.telephone)}</span>
    </p>
  `;

  return emailWrapper(cabinet, content);
}

/** Template : Lettre confraternelle (corps de l'email) */
export function buildConfraternitEmailBody(params: {
  clientName: string;
  clientRaisonSociale: string;
  clientSiren: string;
  cabinetName: string;
  expertName: string;
}): string {
  const cabinet = getCabinetInfo();

  const content = `
    <p style="color: #374151;">Cher Confrère, Chère Consœur,</p>
    <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
      Nous avons l'honneur de vous informer que <strong>${escapeHtml(params.clientRaisonSociale)}</strong>
      (SIREN : <strong>${escapeHtml(params.clientSiren)}</strong>), représentée par M./Mme <strong>${escapeHtml(params.clientName)}</strong>,
      nous a confié la tenue de sa comptabilité et le suivi fiscal de son entreprise.
    </p>
    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin-bottom: 20px; border-radius: 0 8px 8px 0;">
      <p style="color: #92400e; font-size: 13px; margin: 0;">
        <strong>Délai réglementaire</strong> : Conformément à l'article 33 du Code de déontologie des experts-comptables,
        nous vous accordons 15 jours pour nous transmettre tout renseignement utile.
      </p>
    </div>
    <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
      Vous trouverez ci-joint notre lettre de reprise confraternelle complète au format PDF.
    </p>
    <p style="color: #374151; margin-top: 24px;">
      Dans l'attente de votre réponse, nous vous adressons nos cordiales salutations confraternelles.<br/><br/>
      <strong style="color: #1e3a5f;">${escapeHtml(params.expertName)}</strong><br/>
      <span style="color: #6b7280; font-size: 13px;">${escapeHtml(cabinet.nom)} | N° Ordre : ${escapeHtml(cabinet.numeroOrdre)}</span>
    </p>
  `;

  return emailWrapper(cabinet, content);
}

/** Template : Demande de documents spécifiques à la création d'entreprise */
export function buildCreationDocumentRequestEmail(params: {
  clientName: string;
  cabinetName: string;
  uploadLink: string;
  denomination: string;
  formeJuridique: string;
  documents: string[];
}): string {
  const cabinet = getCabinetInfo();
  const docList = params.documents
    .map(
      d => `<li style="padding: 6px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #374151;">${d}</li>`
    )
    .join('');

  const content = `
    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; text-align: center;">
      <span style="font-size: 32px;">🏗️</span>
      <h2 style="font-size: 16px; color: #1e40af; margin: 8px 0 4px 0;">Création d'entreprise</h2>
      <p style="font-size: 13px; color: #3b82f6; margin: 0;">${escapeHtml(params.denomination)} — ${escapeHtml(params.formeJuridique)}</p>
    </div>

    <p style="color: #374151; margin-bottom: 8px;">Madame, Monsieur <strong>${escapeHtml(params.clientName)}</strong>,</p>
    <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
      Dans le cadre de la <strong>création de votre entreprise</strong>, nous vous remercions de bien vouloir nous
      transmettre les pièces suivantes, nécessaires à la constitution de votre dossier et à l'accomplissement
      des formalités auprès du guichet unique (INPI) :
    </p>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 20px; margin-bottom: 24px;">
      <ul style="list-style: none; margin: 0; padding: 0;">
        ${docList}
      </ul>
    </div>

    <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
      <p style="color: #92400e; font-size: 12px; margin: 0;">
        ⚠️ <strong>Important</strong> : L'attestation de non-condamnation et de filiation doit être remplie et signée
        par chaque dirigeant/associé. Nous vous transmettrons le formulaire pré-rempli par email séparé.
      </p>
    </div>

    <p style="color: #6b7280; font-size: 14px; margin-bottom: 24px;">
      Vous pouvez déposer vos documents <strong>en toute sécurité</strong> via le lien ci-dessous :
    </p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${escapeHtml(params.uploadLink)}"
        style="background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(37,99,235,0.3);">
        📁 Déposer mes documents
      </a>
    </div>
    <p style="color: #9ca3af; font-size: 13px;">
      En cas de difficulté, n'hésitez pas à nous contacter : <a href="mailto:${escapeHtml(cabinet.expertEmail)}" style="color: #2563eb;">${escapeHtml(cabinet.expertEmail)}</a> — ${escapeHtml(cabinet.telephone)}
    </p>
    <p style="color: #374151; margin-top: 24px;">Cordialement,<br/><strong style="color: #1e3a5f;">${escapeHtml(cabinet.expertNom)}</strong><br/><span style="color: #6b7280; font-size: 13px;">${escapeHtml(cabinet.nom)}</span></p>
  `;

  return emailWrapper(cabinet, content);
}

/** Template : Envoi du mandat de création d'entreprise */
export function buildMandatCreationEmail(params: {
  clientName: string;
  cabinetName: string;
  denomination: string;
  formeJuridique: string;
}): string {
  const cabinet = getCabinetInfo();

  const content = `
    <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; text-align: center;">
      <span style="font-size: 32px;">📝</span>
      <h2 style="font-size: 16px; color: #166534; margin: 8px 0 4px 0;">Mandat de réalisation des formalités de création</h2>
      <p style="font-size: 13px; color: #16a34a; margin: 0;">${escapeHtml(params.denomination)} — ${escapeHtml(params.formeJuridique)}</p>
    </div>

    <p style="color: #374151; margin-bottom: 8px;">Madame, Monsieur <strong>${escapeHtml(params.clientName)}</strong>,</p>
    <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
      Afin de procéder à la <strong>création de votre entreprise</strong>, nous devons obtenir votre mandat
      nous autorisant à accomplir en votre nom les formalités d'immatriculation auprès du guichet unique (INPI).
    </p>

    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px 20px; margin-bottom: 20px;">
      <p style="font-size: 13px; font-weight: 600; color: #1e3a5f; margin: 0 0 12px 0;">Ce mandat nous autorise à :</p>
      <ul style="list-style: none; padding: 0; margin: 0; font-size: 13px; color: #374151;">
        <li style="padding: 4px 0;">✅ Rédiger et déposer les statuts constitutifs</li>
        <li style="padding: 4px 0;">✅ Effectuer l'immatriculation au RCS/RNE (guichet unique INPI)</li>
        <li style="padding: 4px 0;">✅ Accomplir les formalités fiscales (option TVA, régime IS/IR)</li>
        <li style="padding: 4px 0;">✅ Procéder aux déclarations sociales du dirigeant</li>
        <li style="padding: 4px 0;">✅ Publier l'annonce légale de constitution</li>
      </ul>
    </div>

    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
      <p style="color: #1d4ed8; font-size: 12px; margin: 0;">
        📋 Vous trouverez ci-joint le mandat pré-rempli à <strong>signer et nous retourner</strong>. 
        La signature électronique via Yousign vous sera proposée pour simplifier cette étape.
      </p>
    </div>

    <p style="color: #6b7280; font-size: 14px; margin-bottom: 20px;">
      Nous vous transmettrons également une <strong>attestation de non-condamnation et de filiation</strong> 
      à compléter et signer — ce document est obligatoire pour les formalités d'immatriculation.
    </p>

    <p style="color: #374151; margin-top: 24px;">
      Restant à votre disposition pour toute question,<br/>
      <strong style="color: #1e3a5f;">${escapeHtml(cabinet.expertNom)}</strong><br/>
      <span style="color: #6b7280; font-size: 13px;">${escapeHtml(cabinet.nom)} — ${escapeHtml(cabinet.telephone)}</span>
    </p>
  `;

  return emailWrapper(cabinet, content);
}

/** Template : Envoi de la Lettre de Mission au client */
export function buildLDMEmail(params: {
  clientGenre: string;
  clientPrenom: string;
  clientNom: string;
  clientRaisonSociale: string;
  missions: string[];
  prixAnnuel: string;
  prixMensuel: string;
  dateEffet: string;
  expertName?: string;
}): string {
  const cabinet = getCabinetInfo();
  const fullName = [params.clientPrenom, params.clientNom].filter(Boolean).join(' ').trim();
  const salutation = fullName
    ? `${escapeHtml(params.clientGenre)} <strong>${escapeHtml(fullName)}</strong>,`
    : 'Madame, Monsieur,';
  const missionItems = params.missions
    .map(m => `<li style="padding: 4px 0; font-size: 13px; color: #374151;">✓ ${escapeHtml(m)}</li>`)
    .join('');
  const prixAnnuelNum = parseFloat(params.prixAnnuel.replace(/\s/g, '').replace(',', '.')) || 0;
  const prixAnnuelStr = prixAnnuelNum > 0 ? prixAnnuelNum.toLocaleString('fr-FR') : '';
  const prixMensuelNum = parseFloat(params.prixMensuel.replace(/\s/g, '').replace(',', '.')) || 0;
  const prixMensuelStr = prixMensuelNum > 0 ? prixMensuelNum.toLocaleString('fr-FR') : '';

  const content = `
    <p style="color: #374151; margin-bottom: 8px;">${salutation}</p>
    <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
      Nous avons le plaisir de vous adresser ci-joint votre <strong>Lettre de Mission</strong> pour la société
      <strong style="color: #1e3a5f;">${escapeHtml(params.clientRaisonSociale || fullName || 'votre société')}</strong>. Nous vous
      prions de bien vouloir en prendre connaissance attentivement.
    </p>

    ${params.missions.length > 0 ? `
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin-bottom: 24px;">
      <h3 style="font-size: 13px; font-weight: 700; color: #1e3a5f; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.5px;">
        📋 Récapitulatif des missions
      </h3>
      <ul style="list-style: none; margin: 0; padding: 0;">${missionItems}</ul>
    </div>` : ''}

    ${prixAnnuelStr ? `
    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 16px 20px; margin-bottom: 24px;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0">
        <tr>
          <td>
            <p style="font-size: 12px; color: #6b7280; margin: 0 0 2px 0; text-transform: uppercase; letter-spacing: 0.5px;">Honoraires annuels HT</p>
            <p style="font-size: 20px; font-weight: 700; color: #1e3a5f; margin: 0;">${prixAnnuelStr}&nbsp;€</p>
          </td>
          ${prixMensuelStr ? `<td style="text-align: right;">
            <p style="font-size: 12px; color: #6b7280; margin: 0 0 2px 0; text-transform: uppercase; letter-spacing: 0.5px;">Soit par mois</p>
            <p style="font-size: 16px; font-weight: 600; color: #2563eb; margin: 0;">${prixMensuelStr}&nbsp;€ HT</p>
          </td>` : ''}
        </tr>
      </table>
      ${params.dateEffet ? `<p style="font-size: 12px; color: #4b5563; margin: 10px 0 0 0;">Date d'effet : <strong>${escapeHtml(params.dateEffet)}</strong></p>` : ''}
    </div>` : ''}

    <div style="background: #fef9ec; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px;">
      <p style="color: #92400e; font-size: 12px; margin: 0;">
        📄 <strong>Action requise</strong> : Nous vous remercions de bien vouloir nous retourner cette lettre de
        mission datée et signée pour confirmer votre accord avec les conditions définies.
      </p>
    </div>

    <p style="color: #6b7280; font-size: 13px; line-height: 1.6; margin-bottom: 16px;">
      Pour toute question concernant les termes de cette lettre de mission, n'hésitez pas à nous contacter :<br/>
      <a href="mailto:${escapeHtml(cabinet.expertEmail)}" style="color: #2563eb;">${escapeHtml(cabinet.expertEmail)}</a> — ${escapeHtml(cabinet.telephone)}
    </p>

    <p style="color: #374151; margin-top: 24px;">
      Dans l'attente de votre retour, nous vous adressons nos cordiales salutations,<br/>
      <strong style="color: #1e3a5f;">${escapeHtml(params.expertName ?? cabinet.expertNom)}</strong><br/>
      <span style="color: #6b7280; font-size: 13px;">${escapeHtml(cabinet.nom)} | N° Ordre : ${escapeHtml(cabinet.numeroOrdre)}</span>
    </p>
  `;

  return emailWrapper(cabinet, content);
}
