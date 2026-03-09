/// <reference types="node" />
/**
 * Vercel Serverless Function — /api/generate-pdf
 *
 * Génère le HTML institutionnel de la Lettre de Mission en utilisant
 * le même template que DocumentPreview.tsx (Task 10).
 * En production, ce handler peut être couplé à Puppeteer / Chromium
 * (via @sparticuz/chromium + puppeteer-core) pour retourner un vrai PDF.
 *
 * Retourne actuellement le HTML prêt à l'impression (Content-Type: text/html)
 * afin que le navigateur / Puppeteer puisse appeler window.print().
 *
 * Les sauts de page (page-break-before: always) sont inclus avant les CGV
 * et les annexes pour un rendu professionnel multi-pages.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

interface CabinetInfo {
  nom?: string;
  adresse?: string;
  codePostal?: string;
  ville?: string;
  siren?: string;
  expertNom?: string;
  telephone?: string;
  email?: string;
}

interface LdmConfigState {
  modeleType: string;
  annexesCGV: boolean;
  annexesRGPD: boolean;
  annexesPennylane: boolean;
}

interface GeneratePdfPayload {
  clientGenre?: string;
  clientPrenom?: string;
  clientNom?: string;
  clientRaisonSociale?: string;
  clientSiren?: string;
  clientEmail?: string;
  clientAdresse?: string;
  clientFormeJuridique?: string;
  clientActivite?: string;
  clientStatutDirigeant?: string;
  prixAnnuel?: string;
  missionsSelectionnees?: string[];
  dateEffet?: string;
  dateRapprochement?: string;
  dateRevisionAnnuelle?: string;
  delaiPreavisRevision?: string;
  indiceBaseTrimestre?: string;
  indiceBaseAnnee?: string;
  indiceBaseValeur?: string;
  ldmConfig?: LdmConfigState;
  cabinet?: CabinetInfo;
}

// ─── HTML escaping ────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── HTML builder ─────────────────────────────────────────────────────────────

function buildPdfHtml(d: GeneratePdfPayload): string {
  const cabinet = d.cabinet ?? {};
  const cabinetNom = escapeHtml(cabinet.nom ?? 'HAYOT EXPERTISE');
  const cabinetAdresse = escapeHtml([cabinet.adresse, cabinet.codePostal, cabinet.ville].filter(Boolean).join(', '));
  const cabinetSiren = escapeHtml(cabinet.siren ?? '942 525 098');
  const cabinetExpert = escapeHtml(cabinet.expertNom ?? 'Samuel Hayot');
  const cabinetTel = escapeHtml(cabinet.telephone ?? '06 09 28 93 99');
  const cabinetEmail = escapeHtml(cabinet.email ?? 'contact@hayot-expertise.fr');

  const ldm = d.ldmConfig ?? { modeleType: '—', annexesCGV: false, annexesRGPD: false, annexesPennylane: false };

  const prixAnnuel = parseFloat((d.prixAnnuel ?? '').replace(/\s/g, '').replace(',', '.')) || 0;
  const prixMensuel = prixAnnuel > 0 ? Math.round(prixAnnuel / 12) : 0;

  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const clientDisplay = escapeHtml(`${d.clientGenre ?? ''} ${d.clientPrenom ?? ''} ${d.clientNom ?? ''}`.trim());
  const societeDisplay = escapeHtml(d.clientRaisonSociale || `${d.clientGenre ?? ''} ${d.clientPrenom ?? ''} ${d.clientNom ?? ''}`.trim() || '—');

  const missionsList = (d.missionsSelectionnees ?? [])
    .map(m => `<li style="margin-bottom:4px;">${escapeHtml(m)}</li>`)
    .join('');

  // Build annexes with page-break-before
  const annexeItems: string[] = [];
  if (ldm.annexesCGV) annexeItems.push('Conditions Générales de Vente et de Prestation du Cabinet');
  if (ldm.annexesRGPD) annexeItems.push('Politique de traitement des données personnelles (RGPD — Règlement UE 2016/679)');
  if (ldm.annexesPennylane) annexeItems.push('Conditions spécifiques d\'utilisation du logiciel Pennylane');

  const annexesHtml = annexeItems.length > 0 ? `
    <div style="page-break-before:always;margin-top:0;padding-top:48px;">
      <h2 style="font-family:'Playfair Display',Georgia,serif;color:#1e3a5f;font-size:18px;font-weight:700;
                 border-bottom:3px solid #c9a84c;padding-bottom:10px;margin-bottom:20px;">
        Annexes et Conditions Générales
      </h2>
      <p style="font-size:13px;color:#374151;margin-bottom:14px;">
        Les documents suivants sont annexés à la présente lettre de mission et en font partie intégrante :
      </p>
      <ul style="padding-left:22px;font-size:13px;color:#374151;line-height:2.0;">
        ${annexeItems.map((a, i) => `<li><strong>Annexe ${i + 1}</strong> — ${a}</li>`).join('')}
      </ul>
      <p style="font-size:11px;color:#94a3b8;margin-top:20px;font-style:italic;">
        En signant la présente lettre de mission, le client reconnaît avoir pris connaissance de l'intégralité de ces annexes.
      </p>
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Lettre de Mission — ${societeDisplay}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin:0; padding:0; }
    body {
      font-family:'Inter',Arial,sans-serif;
      font-size:13px;
      color:#1e293b;
      background:#ffffff;
      line-height:1.65;
      padding:40px 48px;
      max-width:800px;
      margin:0 auto;
    }
    h1 { font-family:'Playfair Display',Georgia,serif; font-size:22px; font-weight:700; color:#1e3a5f; }
    h2 { font-family:'Playfair Display',Georgia,serif; font-size:16px; font-weight:700; color:#1e3a5f; margin:22px 0 10px; }
    h3 { font-family:'Playfair Display',Georgia,serif; font-size:14px; font-weight:600; color:#374151; margin:14px 0 8px; }
    p { margin-bottom:10px; color:#374151; }
    ul { padding-left:20px; margin-bottom:12px; }
    li { margin-bottom:3px; color:#374151; }
    table { width:100%; border-collapse:collapse; font-size:12px; margin-bottom:16px; }
    th { background:#1e3a5f; color:#fff; padding:7px 12px; text-align:left; font-weight:600; letter-spacing:0.3px; }
    td { padding:6px 12px; border-bottom:1px solid #f1f5f9; vertical-align:top; }
    tr:nth-child(even) td { background:#f8fafc; }
    .no-print { display:block; }
    @media print {
      .no-print { display:none !important; }
      body { padding:10mm 12mm; max-width:none; }
      @page { size:A4; margin:15mm; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:24px;display:flex;gap:8px;">
    <button onclick="window.print()" style="background:#1e3a5f;color:#fff;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;font-size:13px;">
      🖨️ Imprimer / Exporter PDF
    </button>
  </div>

  <!-- Letterhead -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1e3a5f;padding-bottom:18px;margin-bottom:24px;">
    <div>
      <div style="font-family:'Playfair Display',Georgia,serif;font-size:24px;font-weight:700;color:#1e3a5f;letter-spacing:-0.5px;">
        ${cabinetNom}
      </div>
      <div style="font-size:11px;color:#64748b;margin-top:4px;">Expert-Comptable · SIREN : ${cabinetSiren}</div>
      ${cabinetAdresse ? `<div style="font-size:11px;color:#64748b;">${cabinetAdresse}</div>` : ''}
      <div style="font-size:11px;color:#64748b;">Tél : ${cabinetTel} · ${cabinetEmail}</div>
    </div>
    <div style="text-align:right;">
      <div style="background:#1e3a5f;color:#c9a84c;border-radius:6px;padding:8px 16px;font-size:11px;font-weight:700;letter-spacing:1px;">
        LETTRE DE MISSION
      </div>
      <div style="font-size:11px;color:#94a3b8;margin-top:6px;">Modèle : <strong style="color:#1e3a5f;">${ldm.modeleType}</strong></div>
      <div style="font-size:11px;color:#94a3b8;margin-top:2px;">Le ${today}</div>
    </div>
  </div>

  <!-- Recipient -->
  <div style="margin-bottom:28px;">
    <div style="font-size:12px;color:#6b7280;font-style:italic;margin-bottom:6px;">À l'attention de</div>
    <div style="font-family:'Playfair Display',Georgia,serif;font-size:16px;font-weight:600;color:#1e293b;">${clientDisplay || societeDisplay}</div>
    ${societeDisplay !== clientDisplay ? `<div style="font-size:13px;color:#374151;margin-top:2px;">${societeDisplay}</div>` : ''}
    ${d.clientAdresse ? `<div style="font-size:12px;color:#6b7280;margin-top:3px;">${escapeHtml(d.clientAdresse)}</div>` : ''}
    ${d.clientEmail ? `<div style="font-size:12px;color:#6b7280;margin-top:1px;">${escapeHtml(d.clientEmail)}</div>` : ''}
  </div>

  <!-- Object -->
  <div style="background:#f8f5e6;border-left:4px solid #c9a84c;padding:12px 16px;margin-bottom:24px;border-radius:0 6px 6px 0;">
    <div style="font-size:11px;font-weight:700;color:#c9a84c;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Objet</div>
    <div style="font-size:13px;color:#1e293b;font-weight:500;">
      Lettre de mission — Mission d'expertise comptable
      ${d.clientFormeJuridique ? '· ' + escapeHtml(d.clientFormeJuridique) : ''}
      ${d.clientActivite ? '· ' + escapeHtml(d.clientActivite) : ''}
    </div>
  </div>

  ${(d.clientFormeJuridique || d.clientSiren || d.clientActivite) ? `
  <h2>Profil du Client</h2>
  <table>
    <tbody>
      ${d.clientFormeJuridique ? `<tr><td style="font-weight:500;width:200px;">Forme juridique</td><td>${escapeHtml(d.clientFormeJuridique)}</td></tr>` : ''}
      ${d.clientSiren ? `<tr><td style="font-weight:500;">SIREN</td><td>${escapeHtml(d.clientSiren)}</td></tr>` : ''}
      ${d.clientStatutDirigeant ? `<tr><td style="font-weight:500;">Qualité du dirigeant</td><td>${escapeHtml(d.clientStatutDirigeant)}</td></tr>` : ''}
      ${d.clientActivite ? `<tr><td style="font-weight:500;">Activité</td><td>${escapeHtml(d.clientActivite)}</td></tr>` : ''}
    </tbody>
  </table>
  ` : ''}

  ${missionsList ? `
  <h2 style="border-bottom:2px solid #e2e8f0;padding-bottom:8px;">Périmètre de la Mission</h2>
  <p>Dans le cadre de la présente lettre de mission, ${cabinetNom} s'engage à réaliser les prestations suivantes pour le compte de ${societeDisplay} :</p>
  <ul style="line-height:1.8;">${missionsList}</ul>
  ` : ''}

  ${prixAnnuel > 0 ? `
  <h2 style="border-bottom:2px solid #e2e8f0;padding-bottom:8px;margin-top:24px;">Honoraires</h2>
  <table>
    <thead><tr><th>Nature</th><th>Montant HT</th><th>Fréquence</th></tr></thead>
    <tbody>
      <tr>
        <td>Forfait de tenue comptable et missions associées</td>
        <td style="font-weight:600;">${prixAnnuel.toLocaleString('fr-FR')} €</td>
        <td>Annuel</td>
      </tr>
      <tr>
        <td>Versement mensuel (acompte)</td>
        <td style="font-weight:600;">${prixMensuel.toLocaleString('fr-FR')} €</td>
        <td>Mensuel</td>
      </tr>
    </tbody>
  </table>
  <p style="font-size:11px;color:#6b7280;font-style:italic;">
    Les honoraires sont révisables chaque année au ${escapeHtml(d.dateRevisionAnnuelle ?? '1er janvier')}, avec un préavis de ${escapeHtml(d.delaiPreavisRevision ?? '30')} jours.
  </p>
  ` : ''}

  ${(d.dateEffet || d.dateRapprochement) ? `
  <h2 style="border-bottom:2px solid #e2e8f0;padding-bottom:8px;margin-top:24px;">Entrée en vigueur</h2>
  <table>
    <tbody>
      ${d.dateEffet ? `<tr><td style="font-weight:500;width:220px;">Date d'effet</td><td>${escapeHtml(d.dateEffet)}</td></tr>` : ''}
      ${d.dateRapprochement ? `<tr><td style="font-weight:500;">Rapprochement bancaire dès</td><td>${escapeHtml(d.dateRapprochement)}</td></tr>` : ''}
    </tbody>
  </table>
  ` : ''}

  <!-- Signature block -->
  <div style="margin-top:48px;border-top:2px solid #e2e8f0;padding-top:32px;">
    <div style="display:flex;gap:40px;justify-content:space-between;">
      <div style="flex:1;min-width:0;">
        <div style="font-size:11px;font-weight:700;color:#c9a84c;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">Le Client</div>
        <div style="font-size:13px;font-weight:600;color:#1e293b;margin-bottom:2px;">${societeDisplay}</div>
        <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">${clientDisplay}</div>
        <div style="height:80px;border-bottom:1px solid #94a3b8;margin-top:16px;margin-bottom:6px;"></div>
        <div style="font-size:11px;color:#94a3b8;text-align:center;">Signature précédée de la mention « Lu et approuvé »</div>
      </div>
      <div style="width:1px;background:#e2e8f0;flex-shrink:0;margin-top:30px;"></div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:11px;font-weight:700;color:#1e3a5f;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">Le Cabinet</div>
        <div style="font-size:13px;font-weight:700;color:#1e3a5f;margin-bottom:2px;">${cabinetNom}</div>
        <div style="font-size:12px;color:#6b7280;margin-bottom:1px;">Signature du représentant légal</div>
        <div style="font-size:12px;font-weight:600;color:#374151;margin-bottom:1px;">${cabinetExpert}</div>
        <div style="font-size:11px;color:#6b7280;font-style:italic;">Expert-comptable</div>
        <div style="height:80px;border-bottom:1px solid #94a3b8;margin-top:16px;margin-bottom:6px;"></div>
        <div style="font-size:11px;color:#94a3b8;text-align:center;">Cachet et signature du cabinet</div>
      </div>
    </div>
  </div>

  ${annexesHtml}

</body>
</html>`;
}

// ─── Vercel handler ───────────────────────────────────────────────────────────

export default function handler(
  req: { method: string; body: GeneratePdfPayload },
  res: {
    setHeader: (key: string, value: string) => void;
    status: (code: number) => { json: (body: unknown) => void; send: (body: string) => void };
  }
) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const payload: GeneratePdfPayload = req.body ?? {};
  const html = buildPdfHtml(payload);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
}
