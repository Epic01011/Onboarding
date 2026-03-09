/**
 * Générateur PDF — jsPDF (lettres confraternelles + LDM)
 * Utilisé pour : Lettre confraternelle, Lettre de Mission
 */

import { jsPDF } from 'jspdf';
import { OPTION_PRICES } from '../utils/pricingLogic';

// ─────────────────────────────────────────────────────────────────────────────
// ClientData (subset used by generateLDMPdf)
// ─────────────────────────────────────────────────────────────────────────────

export interface LDMClientData {
  raisonSociale: string;
  nom: string;
  siren: string;
  adresse: string;
  codePostal: string;
  ville: string;
  email: string;
  formeJuridique: string;
  missionsSelectionnees: string[];
  prixAnnuel: string;
  // Optional detailed pricing breakdown from PricingEngine validated quote
  monthlyAccountingPrice?: number;
  monthlyClosurePrice?: number;
  monthlySocialPrice?: number;
  monthlyOptionsPrice?: number;
  setupFees?: number;
  taxRegime?: string;
  bulletinsPerMonth?: number;
  options?: {
    ticketsSupport5an?: boolean;
    whatsappDedie?: boolean;
    appelsPrioritaires?: boolean;
    assembleGenerale?: boolean;
  };
}

export interface LDMCabinetData {
  nom: string;
  adresse: string;
  codePostal: string;
  ville: string;
  siren: string;
  telephone: string;
  expertNom: string;
  expertEmail: string;
  numeroOrdre: string;
}

/**
 * Génère la Lettre de Mission en PDF via jsPDF.
 * Retourne le document jsPDF (utilisez doc.output('bloburl') pour un aperçu dans un nouvel onglet).
 */
export async function generateLDMPdf(
  clientData: LDMClientData,
  cabinetData: LDMCabinetData,
  prixMensuel: number,
): Promise<jsPDF> {
  const today = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const prixAnnuelNum = parseFloat(clientData.prixAnnuel) || 0;
  const prixMensuelCalc = prixMensuel > 0 ? prixMensuel : prixAnnuelNum / 12;
  // Use toFixed(2) to avoid floating-point rounding errors
  const prixAnnuelStr = prixAnnuelNum.toFixed(2).replace('.', ',');
  const prixMensuelStr = prixMensuelCalc.toFixed(2).replace('.', ',');
  const _prixAnnuelTTC = (prixAnnuelNum * 1.2).toFixed(2).replace('.', ',');
  const prixMensuelTTC = (prixMensuelCalc * 1.2).toFixed(2).replace('.', ',');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const PAGE_W = 210;
  const PAGE_H = 297;
  const MARGIN_L = 18;
  const MARGIN_R = 18;
  const TEXT_W = PAGE_W - MARGIN_L - MARGIN_R;
  let y = 0;

  // ── Helpers ────────────────────────────────────────────────────────────────
  const setColor = (r: number, g: number, b: number) => doc.setTextColor(r, g, b);

  const skip = (mm = 4) => { y += mm; };

  const hRule = (color: [number, number, number] = [30, 58, 95], weight = 0.5) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(weight);
    doc.line(MARGIN_L, y, PAGE_W - MARGIN_R, y);
    skip(3);
  };

  const sectionTitle = (title: string) => {
    skip(3);
    doc.setFillColor(30, 58, 95);
    doc.rect(MARGIN_L, y - 1, TEXT_W, 7, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(title, MARGIN_L + 3, y + 4);
    y += 9;
  };

  // ── Page 1 ─────────────────────────────────────────────────────────────────

  // Header background
  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, PAGE_W, 32, 'F');

  // Cabinet name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(cabinetData.nom || 'Cabinet Expert-Comptable', MARGIN_L, 13);

  // Cabinet details
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `SIREN : ${cabinetData.siren} — ${cabinetData.adresse}, ${cabinetData.codePostal} ${cabinetData.ville}`,
    MARGIN_L,
    20,
  );
  doc.text(
    `Tél : ${cabinetData.telephone}  |  ${cabinetData.expertEmail}`,
    MARGIN_L,
    25,
  );

  // Ordre badge
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(PAGE_W - 60, 5, 43, 22, 2, 2, 'F');
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text("Membre de l'Ordre des", PAGE_W - 38.5, 13, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.text('Experts-Comptables', PAGE_W - 38.5, 18, { align: 'center' });
  if (cabinetData.numeroOrdre) {
    doc.setFont('helvetica', 'normal');
    doc.text(`N° ${cabinetData.numeroOrdre}`, PAGE_W - 38.5, 23, { align: 'center' });
  }

  y = 40;

  // Title block
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  setColor(30, 58, 95);
  doc.text('LETTRE DE MISSION', PAGE_W / 2, y, { align: 'center' });
  skip(5);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  setColor(100, 116, 139);
  doc.text(
    "Conformément à l'article 151 du Code de déontologie intégré au décret du 30 mars 2012",
    PAGE_W / 2,
    y,
    { align: 'center' },
  );
  skip(3);
  hRule([30, 58, 95], 0.8);

  // Date + lieu
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  setColor(100, 116, 139);
  doc.text(`${cabinetData.ville || 'Paris'}, le ${today}`, PAGE_W - MARGIN_R, y, { align: 'right' });
  skip(8);

  // ── Parties ────────────────────────────────────────────────────────────────
  sectionTitle('PARTIES AU CONTRAT');

  // Two-column layout for parties
  const colW = (TEXT_W - 4) / 2;
  const colR = MARGIN_L + colW + 4;
  const partyY = y;

  // Left: Cabinet
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(MARGIN_L, partyY, colW, 32, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN_L, partyY, colW, 32, 2, 2, 'S');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  setColor(30, 58, 95);
  doc.text('Le Cabinet (Prestataire)', MARGIN_L + 3, partyY + 5);
  doc.setFont('helvetica', 'normal');
  setColor(50, 50, 50);
  doc.text(cabinetData.nom || '—', MARGIN_L + 3, partyY + 11);
  doc.text(`SIREN : ${cabinetData.siren || '—'}`, MARGIN_L + 3, partyY + 16);
  doc.text(`${cabinetData.adresse}`, MARGIN_L + 3, partyY + 21);
  doc.text(`${cabinetData.codePostal} ${cabinetData.ville}`, MARGIN_L + 3, partyY + 26);

  // Right: Client
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(colR, partyY, colW, 32, 2, 2, 'F');
  doc.setDrawColor(191, 219, 254);
  doc.roundedRect(colR, partyY, colW, 32, 2, 2, 'S');
  doc.setFont('helvetica', 'bold');
  setColor(30, 64, 175);
  doc.text('Le Client', colR + 3, partyY + 5);
  doc.setFont('helvetica', 'normal');
  setColor(50, 50, 50);
  doc.text(clientData.raisonSociale || clientData.nom || '—', colR + 3, partyY + 11);
  doc.text(
    `SIREN : ${clientData.siren || '—'}${clientData.formeJuridique ? '  |  Forme : ' + clientData.formeJuridique : ''}${clientData.taxRegime ? '  |  ' + clientData.taxRegime : ''}`,
    colR + 3, partyY + 16,
  );
  doc.text(`${clientData.adresse}`, colR + 3, partyY + 21);
  doc.text(`${clientData.codePostal} ${clientData.ville}`, colR + 3, partyY + 26);

  y = partyY + 36;

  // ── Missions sélectionnées ─────────────────────────────────────────────────
  sectionTitle('PÉRIMÈTRE DES MISSIONS CONFIÉES');

  if (clientData.missionsSelectionnees.length > 0) {
    clientData.missionsSelectionnees.forEach((mission) => {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      setColor(30, 30, 30);
      const lines = doc.splitTextToSize(`•  ${mission}`, TEXT_W - 6);
      doc.text(lines, MARGIN_L + 4, y);
      y += lines.length * 4.5;
    });
  } else {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    setColor(100, 116, 139);
    doc.text('Aucune mission spécifiée', MARGIN_L + 4, y);
    y += 5;
  }

  // ── Tableau des honoraires ─────────────────────────────────────────────────
  sectionTitle('TABLEAU RÉCAPITULATIF DES HONORAIRES');

  const hasBreakdown = (
    (clientData.monthlyAccountingPrice ?? 0) > 0 ||
    (clientData.monthlyClosurePrice ?? 0) > 0 ||
    (clientData.monthlySocialPrice ?? 0) > 0 ||
    (clientData.monthlyOptionsPrice ?? 0) > 0
  );

  const colWidths = [70, 32, 30, 42];
  const tableX = MARGIN_L;
  const rowH = 7;
  let tx = tableX;

  const tableHeaders = ['Prestation', 'Mensuel HT', 'Annuel HT', 'Mensuel TTC (20%)'];

  // Header row
  doc.setFillColor(30, 58, 95);
  doc.rect(tableX, y, TEXT_W, rowH, 'F');
  tx = tableX;
  tableHeaders.forEach((h, i) => {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(h, tx + 2, y + 4.8);
    tx += colWidths[i];
  });
  y += rowH;

  if (hasBreakdown) {
    // Helper to render a single fee row
    const renderRow = (label: string, monthly: number, ri: number, sub = false) => {
      const annual = monthly * 12;
      const monthlyTTCVal = monthly * 1.2;
      doc.setFillColor(ri % 2 === 0 ? 248 : 255, ri % 2 === 0 ? 250 : 255, ri % 2 === 0 ? 252 : 255);
      doc.rect(tableX, y, TEXT_W, rowH, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.rect(tableX, y, TEXT_W, rowH, 'S');
      tx = tableX;
      const cells = [
        sub ? `  ${label}` : label,
        `${monthly.toFixed(2).replace('.', ',')} €`,
        `${annual.toFixed(2).replace('.', ',')} €`,
        `${monthlyTTCVal.toFixed(2).replace('.', ',')} €`,
      ];
      cells.forEach((cell, ci) => {
        doc.setFontSize(sub ? 7.5 : 8.5);
        doc.setFont('helvetica', (ci === 0 || sub) ? 'normal' : 'bold');
        doc.setTextColor(
          sub ? 100 : (ci >= 1 ? 30 : 50),
          sub ? 116 : (ci >= 1 ? 64 : 50),
          sub ? 139 : (ci >= 1 ? 175 : 50),
        );
        doc.text(cell, tx + 2, y + 4.8);
        tx += colWidths[ci];
      });
      y += rowH;
    };

    // Detailed breakdown rows
    let ri = 0;
    if ((clientData.monthlyAccountingPrice ?? 0) > 0) {
      renderRow('Tenue comptable & saisie', clientData.monthlyAccountingPrice!, ri++);
    }
    if ((clientData.monthlyClosurePrice ?? 0) > 0) {
      renderRow('Révision, clôture, bilan & liasse fiscale', clientData.monthlyClosurePrice!, ri++);
    }
    if ((clientData.monthlySocialPrice ?? 0) > 0) {
      const socialLabel = (clientData.bulletinsPerMonth ?? 0) > 0
        ? `Gestion sociale & paie (${clientData.bulletinsPerMonth} bulletin${clientData.bulletinsPerMonth! > 1 ? 's' : ''})`
        : 'Gestion sociale & paie';
      renderRow(socialLabel, clientData.monthlySocialPrice!, ri++);
    }
    if ((clientData.monthlyOptionsPrice ?? 0) > 0) {
      const opts = clientData.options;
      const hasOptDetail = opts && (opts.ticketsSupport5an || opts.whatsappDedie || opts.appelsPrioritaires || opts.assembleGenerale);
      // Options header row
      const optMonthly = clientData.monthlyOptionsPrice!;
      renderRow('Options & services complémentaires', optMonthly, ri++);
      if (hasOptDetail) {
        // Individual option sub-rows (prices from shared OPTION_PRICES constants)
        if (opts!.ticketsSupport5an) renderRow('Support client (5 tickets/an)', OPTION_PRICES.ticketsSupport5an, ri++, true);
        if (opts!.whatsappDedie) renderRow('Ligne WhatsApp dédiée', OPTION_PRICES.whatsappDedie, ri++, true);
        if (opts!.appelsPrioritaires) renderRow('Appels prioritaires', OPTION_PRICES.appelsPrioritaires, ri++, true);
        if (opts!.assembleGenerale) renderRow('AG & dépôt des comptes', OPTION_PRICES.assembleGenerale, ri++, true);
      }
    }

    // Total row
    const totalMonthly = prixMensuelCalc;
    const totalAnnual = prixAnnuelNum;
    const totalTTC = totalMonthly * 1.2;
    doc.setFillColor(30, 58, 95);
    doc.rect(tableX, y, TEXT_W, rowH, 'F');
    tx = tableX;
    [
      'TOTAL MENSUEL HT',
      `${totalMonthly.toFixed(2).replace('.', ',')} €`,
      `${totalAnnual.toFixed(2).replace('.', ',')} €`,
      `${totalTTC.toFixed(2).replace('.', ',')} €`,
    ].forEach((cell, ci) => {
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(cell, tx + 2, y + 4.8);
      tx += colWidths[ci];
    });
    y += rowH;

    // Setup fees note
    const setupFeesAmt = (clientData.setupFees ?? 0);
    if (setupFeesAmt > 0) {
      skip(2);
      doc.setFillColor(255, 251, 235);
      doc.rect(tableX, y - 1, TEXT_W, 8, 'F');
      doc.setDrawColor(253, 230, 138);
      doc.setLineWidth(0.3);
      doc.rect(tableX, y - 1, TEXT_W, 8, 'S');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(146, 64, 14);
      doc.text(
        `Frais d'intégration initiaux (une seule fois) : ${setupFeesAmt.toFixed(2).replace('.', ',')} € HT`,
        tableX + 3,
        y + 4,
      );
      y += 9;
    }
  } else {
    // Simple single-row fallback when no breakdown available
    const fallbackRow = ['Forfait comptable & fiscal', `${prixMensuelStr} €`, `${prixAnnuelStr} €`, `${prixMensuelTTC} €`];
    doc.setFillColor(248, 250, 252);
    doc.rect(tableX, y, TEXT_W, rowH, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.rect(tableX, y, TEXT_W, rowH, 'S');
    tx = tableX;
    fallbackRow.forEach((cell, ci) => {
      doc.setFontSize(8.5);
      doc.setFont('helvetica', ci === 0 ? 'normal' : 'bold');
      doc.setTextColor(ci >= 1 ? 30 : 50, ci >= 1 ? 64 : 50, ci >= 1 ? 175 : 50);
      doc.text(cell, tx + 2, y + 4.8);
      tx += colWidths[ci];
    });
    y += rowH;
  }
  skip(3);

  // ── Modalités de paiement ──────────────────────────────────────────────────
  sectionTitle('MODALITÉS DE FACTURATION ET DE PAIEMENT');

  const paymentText = [
    "Les honoraires sont facturés en début de mois et payables par prélèvement automatique mensuel. "
    + "Aucun escompte ne sera accordé.",
    "En cas de retard de paiement, des pénalités sont exigibles dès le lendemain de l'échéance, "
    + "au taux de trois (3) fois le taux d'intérêt légal en vigueur, ainsi qu'une indemnité "
    + "forfaitaire de 40 € pour frais de recouvrement.",
  ];
  paymentText.forEach((para) => {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    setColor(50, 50, 50);
    const lines = doc.splitTextToSize(para, TEXT_W);
    doc.text(lines, MARGIN_L, y);
    y += lines.length * 4 + 2;
  });

  // ── Durée ──────────────────────────────────────────────────────────────────
  sectionTitle('DURÉE ET RENOUVELLEMENT');

  const dureeText = "La mission est conclue pour une durée d'un (1) an à compter de la date de signature. "
    + "Elle est renouvelable par tacite reconduction, sauf dénonciation par lettre recommandée "
    + "avec accusé de réception trois (3) mois avant échéance.";
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  setColor(50, 50, 50);
  const dureeLines = doc.splitTextToSize(dureeText, TEXT_W);
  doc.text(dureeLines, MARGIN_L, y);
  y += dureeLines.length * 4 + 2;

  // ── Signatures ─────────────────────────────────────────────────────────────
  skip(5);
  hRule([226, 232, 240], 0.3);
  skip(2);

  const sigColW = (TEXT_W - 10) / 2;
  const sigY = y;

  // Cabinet signature block
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  setColor(30, 58, 95);
  doc.text('Pour le Cabinet (Expert-Comptable) :', MARGIN_L, sigY);
  doc.setFont('helvetica', 'normal');
  setColor(80, 80, 80);
  doc.text(cabinetData.nom || '—', MARGIN_L, sigY + 7);
  if (cabinetData.expertNom) {
    doc.text(cabinetData.expertNom, MARGIN_L, sigY + 12);
  }
  doc.text(`Date : ${today}`, MARGIN_L, sigY + 17);
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.4);
  doc.line(MARGIN_L, sigY + 30, MARGIN_L + sigColW, sigY + 30);

  // Client signature block
  const sigR = MARGIN_L + sigColW + 10;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  setColor(30, 58, 95);
  doc.text('Pour le Client (Lu et approuvé) :', sigR, sigY);
  doc.setFont('helvetica', 'normal');
  setColor(80, 80, 80);
  doc.text(clientData.raisonSociale || clientData.nom || '—', sigR, sigY + 7);
  doc.text('Date : ______________________', sigR, sigY + 17);
  doc.setLineWidth(0.4);
  doc.line(sigR, sigY + 30, sigR + sigColW, sigY + 30);

  y = sigY + 35;

  // ── Page 2: Conditions Générales ───────────────────────────────────────────
  doc.addPage();
  y = 20;

  // CGV Header
  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, PAGE_W, 14, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('CONDITIONS GÉNÉRALES DE VENTE — ANNEXE À LA LETTRE DE MISSION', PAGE_W / 2, 9, { align: 'center' });

  y = 22;

  const cgvArticles: Array<{ title: string; content: string }> = [
    {
      title: 'Art. 1 — Objet',
      content: "Les présentes conditions générales régissent les relations entre le Cabinet et le Client dans le cadre "
        + "de la lettre de mission signée entre les parties. Elles complètent les dispositions particulières de ladite "
        + "lettre de mission.",
    },
    {
      title: 'Art. 2 — Obligations du Cabinet',
      content: "Le Cabinet s'engage à fournir les prestations définies dans la lettre de mission avec diligence et "
        + "conformément aux normes professionnelles de l'Ordre des Experts-Comptables. Le Cabinet est soumis au "
        + "secret professionnel (art. 226-13 Code pénal). La mission est une obligation de moyens.",
    },
    {
      title: 'Art. 3 — Obligations du Client',
      content: "Le Client s'engage à remettre tous documents nécessaires dans les délais convenus (au plus tard le 10 "
        + "du mois suivant chaque opération), à donner les délégations d'accès aux plateformes fiscales et sociales, "
        + "à régler les honoraires aux échéances prévues et à transmettre les documents d'identification requis au "
        + "titre de la lutte contre le blanchiment de capitaux.",
    },
    {
      title: 'Art. 4 — Responsabilité',
      content: "La responsabilité civile professionnelle du Cabinet est assurée auprès de Verspieren (France). En "
        + "application de l'article 2254 du Code civil, la responsabilité ne peut être mise en jeu que dans le "
        + "délai contractuellement défini à un (1) an à compter de la connaissance du préjudice par le Client.",
    },
    {
      title: 'Art. 5 — Confidentialité & RGPD',
      content: "Les données personnelles transmises sont traitées conformément au RGPD (Règlement UE 2016/679) et à "
        + "la loi n°78-17 du 6 janvier 1978. Le Client est responsable de traitement au sens de la législation "
        + "applicable. Les données ne sont pas transmises à des tiers sans accord exprès du Client.",
    },
    {
      title: "Art. 6 — Résiliation",
      content: "Chaque partie peut résilier la mission par lettre recommandée avec accusé de réception moyennant un "
        + "préavis de trois (3) mois. En cas de manquement grave, la résiliation peut être immédiate après mise en "
        + "demeure restée infructueuse sous quinze (15) jours.",
    },
    {
      title: 'Art. 7 — Droit applicable et litiges',
      content: "Le présent contrat est soumis au droit français. Tout litige sera soumis à la compétence exclusive "
        + "des tribunaux de Paris, après tentative obligatoire de conciliation amiable de trente (30) jours.",
    },
  ];

  cgvArticles.forEach((article) => {
    // Check if we need a new page
    if (y > PAGE_H - 30) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    setColor(30, 58, 95);
    doc.text(article.title, MARGIN_L, y);
    y += 4.5;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    setColor(60, 60, 60);
    const lines = doc.splitTextToSize(article.content, TEXT_W);
    doc.text(lines, MARGIN_L, y);
    y += lines.length * 3.5 + 3;
  });

  // ── Footer on all pages ────────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(MARGIN_L, PAGE_H - 12, PAGE_W - MARGIN_R, PAGE_H - 12);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Lettre de Mission — ${clientData.raisonSociale || clientData.nom} | ${cabinetData.nom} | SIREN : ${cabinetData.siren} | Page ${p}/${totalPages}`,
      PAGE_W / 2,
      PAGE_H - 7,
      { align: 'center' },
    );
  }

  return doc;
}

// ─────────────────────────────────────────────────────────────────────────────
// Types & params
// ─────────────────────────────────────────────────────────────────────────────

export interface LettreConfraternelleParams {
  // Cabinet (expéditeur)
  cabinetNom: string;
  cabinetAdresse: string;
  cabinetCodePostal: string;
  cabinetVille: string;
  cabinetTelephone: string;
  cabinetExpertEmail: string;
  cabinetSiren: string;
  cabinetOrdreNum: string;
  cabinetExpertNom: string;
  // Client (concerné par la reprise)
  clientNom: string;
  clientRaisonSociale: string;
  clientSiren: string;
  // Destinataire (confrère)
  confrereEmail: string;
  // Optionnel
  dateLettre?: string;
}

export interface PdfResult {
  /** Raw PDF Blob — use with URL.createObjectURL for preview */
  blob: Blob;
  /** base64-encoded content (no data: prefix) — for SendGrid attachment */
  base64: string;
  /** Suggested filename */
  filename: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main generator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère la lettre confraternelle en PDF via jsPDF.
 * Retourne un Blob (pour preview/download) et une string base64 (pour email).
 */
export function generateLettrePdfBlob(params: LettreConfraternelleParams): PdfResult {
  const today = params.dateLettre ?? new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const deadlineDate = new Date();
  deadlineDate.setDate(deadlineDate.getDate() + 15);
  const deadline = deadlineDate.toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const PAGE_W = 210;
  const MARGIN_L = 20;
  const MARGIN_R = 20;
  const TEXT_W = PAGE_W - MARGIN_L - MARGIN_R;
  let y = 20;

  // ── Helpers ────────────────────────────────────────────────────────────────
  const line = (text: string, size = 10, style: 'normal' | 'bold' = 'normal', color: [number, number, number] = [30, 30, 30]) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', style);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, TEXT_W);
    doc.text(lines, MARGIN_L, y);
    y += lines.length * (size * 0.45);
  };

  const skip = (mm = 4) => { y += mm; };

  const hRule = (color: [number, number, number] = [30, 58, 95]) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.6);
    doc.line(MARGIN_L, y, PAGE_W - MARGIN_R, y);
    skip(3);
  };

  // ── En-tête cabinet ────────────────────────────────────────────────────────
  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, PAGE_W, 30, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(params.cabinetNom, MARGIN_L, 12);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`SIREN : ${params.cabinetSiren} — ${params.cabinetAdresse}, ${params.cabinetCodePostal} ${params.cabinetVille}`, MARGIN_L, 18);
  doc.text(`Tél : ${params.cabinetTelephone}  |  ${params.cabinetExpertEmail}`, MARGIN_L, 23);

  // Ordre badge
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(PAGE_W - 58, 6, 40, 18, 2, 2, 'F');
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text("Membre de l'Ordre des", PAGE_W - 38, 13, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.text('Experts-Comptables', PAGE_W - 38, 18, { align: 'center' });
  if (params.cabinetOrdreNum) {
    doc.setFont('helvetica', 'normal');
    doc.text(`N° ${params.cabinetOrdreNum}`, PAGE_W - 38, 22, { align: 'center' });
  }

  y = 38;

  // ── Lieu et date ───────────────────────────────────────────────────────────
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 116, 139);
  doc.text(`${params.cabinetVille}, le ${today}`, PAGE_W - MARGIN_R, y, { align: 'right' });
  skip(8);

  // ── Destinataire ───────────────────────────────────────────────────────────
  line("À l'attention du Cabinet Confrère", 9, 'normal', [100, 116, 139]);
  skip(1);
  line(params.confrereEmail, 9, 'bold', [30, 30, 30]);
  skip(6);

  // ── Objet ──────────────────────────────────────────────────────────────────
  hRule();
  line(`Objet : Reprise de dossier — ${params.clientRaisonSociale} (SIREN : ${params.clientSiren})`, 10, 'bold', [30, 58, 95]);
  skip(2);
  line('Lettre confraternelle — Obligation déontologique (art. 33 Code de déontologie OEC)', 8, 'normal', [100, 116, 139]);
  skip(5);

  // ── Corps de la lettre ─────────────────────────────────────────────────────
  line('Madame, Monsieur,', 10, 'normal');
  skip(4);

  line(
    `Nous avons l'honneur de vous informer que M./Mme ${params.clientNom}, représentant(e) légal(e) de la société ${params.clientRaisonSociale} (SIREN : ${params.clientSiren}), nous a confié la mission de tenue de sa comptabilité ainsi que le suivi fiscal de son entreprise, à compter du prochain exercice comptable.`,
    10, 'normal'
  );
  skip(4);

  line(
    'Conformément aux dispositions du Code de déontologie de la profession d\'expert-comptable (article 33) et aux règles de l\'Ordre des Experts-Comptables, nous vous adressons la présente lettre de reprise confraternelle.',
    10, 'normal'
  );
  skip(4);

  line(
    `Nous vous serions reconnaissants de bien vouloir nous faire parvenir, dans un délai de 15 jours à compter de la réception de ce courrier (soit avant le ${deadline}), les éléments comptables, fiscaux et juridiques en votre possession relatifs à ce dossier, notamment :`,
    10, 'normal'
  );
  skip(3);

  const items = [
    'Les derniers bilans comptables et liasses fiscales',
    'Les grands livres et balances générales',
    'Les déclarations fiscales en cours (TVA, IS/IR)',
    'Les déclarations sociales et état de la paie',
    'Tout document utile à la continuité du dossier',
  ];
  items.forEach(item => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    doc.text(`•  ${item}`, MARGIN_L + 4, y);
    y += 5.5;
  });
  skip(3);

  line(
    'Nous nous engageons à reprendre ce dossier dans les meilleures conditions et à assurer la continuité du service auprès du client commun.',
    10, 'normal'
  );
  skip(4);

  line(
    "Dans l'attente de votre réponse, et en vous remerciant de votre collaboration confraternelle, nous vous adressons, Madame, Monsieur, nos cordiales salutations professionnelles.",
    10, 'normal'
  );
  skip(8);

  // ── Signature ──────────────────────────────────────────────────────────────
  line(params.cabinetNom, 10, 'bold');
  skip(1);
  if (params.cabinetExpertNom) {
    line(params.cabinetExpertNom, 10, 'normal');
    skip(1);
  }
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('Expert-Comptable diplômé', MARGIN_L, y);
  y += 9 * 0.45;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 30, 30);

  // ── Pied de page ───────────────────────────────────────────────────────────
  const PAGE_H = 297;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_L, PAGE_H - 16, PAGE_W - MARGIN_R, PAGE_H - 16);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Document confidentiel — Correspondance confraternelle | ${params.cabinetNom} | SIREN : ${params.cabinetSiren}`,
    PAGE_W / 2,
    PAGE_H - 10,
    { align: 'center' }
  );

  // ── Output ──────────────────────────────────────────────────────────────────
  const dataUri = doc.output('datauristring');
  const commaIdx = dataUri.indexOf(',');
  const base64 = commaIdx >= 0 ? dataUri.slice(commaIdx + 1) : doc.output('datauristring');
  const blob = doc.output('blob');
  const filename = `Lettre_Confraternelle_${params.clientRaisonSociale.replace(/[^A-Za-z0-9]/g, '_')}_${new Date().getFullYear()}.pdf`;

  return { blob, base64, filename };
}

export interface CabinetInfo {
  nom: string;
  adresse: string;
  codePostal: string;
  ville: string;
  telephone: string;
  email: string;
  siren: string;
  ordreNum: string;
  siteWeb: string;
}

export const CABINET_INFO: CabinetInfo = {
  nom: 'HAYOT EXPERTISE',
  adresse: '58 RUE DE MONCEAU',
  codePostal: '75008',
  ville: 'Paris',
  telephone: '06 09 28 93 99',
  email: 'contact@hayot-expertise.fr',
  siren: '942 525 098',
  ordreNum: 'OEC 75',
  siteWeb: 'hayot-expertise.fr',
};

function letterheadHtml(): string {
  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1e3a5f;padding-bottom:16px;margin-bottom:24px;">
      <div>
        <div style="font-size:22px;font-weight:700;color:#1e3a5f;letter-spacing:-0.5px;">⚡ ${CABINET_INFO.nom}</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px;">SASU — SIREN : ${CABINET_INFO.siren}</div>
        <div style="font-size:12px;color:#64748b;">${CABINET_INFO.adresse} — ${CABINET_INFO.codePostal} ${CABINET_INFO.ville}</div>
        <div style="font-size:12px;color:#64748b;">Tél : ${CABINET_INFO.telephone} | ${CABINET_INFO.email}</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:2px;">${CABINET_INFO.siteWeb}</div>
      </div>
      <div style="text-align:right;">
        <div style="background:#f1f5f9;border-radius:8px;padding:8px 16px;font-size:11px;color:#475569;">
          <div>Membre de l'Ordre des</div>
          <div style="font-weight:600;">Experts-Comptables</div>
        </div>
      </div>
    </div>
  `;
}

function printStyles(): string {
  return `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Inter', Arial, sans-serif; font-size: 13px; color: #1e293b; padding: 40px; max-width: 800px; margin: 0 auto; }
      @media print { body { padding: 20px; } .no-print { display: none !important; } @page { margin: 20mm; } }
      .btn-print { background: #1e3a5f; color: white; border: none; padding: 10px 24px; border-radius: 6px; cursor: pointer; font-size: 13px; margin-bottom: 24px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 16px; }
      th { background: #1e3a5f; color: white; padding: 6px 10px; text-align: left; }
      td { padding: 5px 10px; border-bottom: 1px solid #e2e8f0; }
      tr:nth-child(even) td { background: #f8fafc; }
    </style>
  `;
}

/** Génère et ouvre la lettre confraternelle dans un nouvel onglet (format PDF-ready) */
export function generateConfrereletter(params: {
  clientNom: string;
  clientRaisonSociale: string;
  clientSiren: string;
  confrereEmail: string;
  dateLettre: string;
}): void {
  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Lettre confraternelle — ${params.clientRaisonSociale}</title>${printStyles()}</head>
<body>
  <button class="btn-print no-print" onclick="window.print()">🖨️ Imprimer / Exporter PDF</button>
  ${letterheadHtml()}
  <div style="text-align:right;margin-bottom:24px;">
    <div style="font-size:13px;color:#475569;">${CABINET_INFO.ville}, le ${params.dateLettre}</div>
  </div>
  <div style="margin-bottom:24px;">
    <div style="font-size:13px;color:#475569;">À l'attention du Cabinet Confrère</div>
    <div style="font-size:13px;color:#475569;">${params.confrereEmail}</div>
  </div>
  <div style="margin-bottom:20px;">
    <div style="font-weight:600;color:#1e3a5f;margin-bottom:8px;">Objet : Reprise de dossier — ${params.clientRaisonSociale} (SIREN : ${params.clientSiren})</div>
  </div>
  <div style="line-height:1.8;space-y:12px;">
    <p style="margin-bottom:12px;">Madame, Monsieur,</p>
    <p style="margin-bottom:12px;">Nous avons l'honneur de vous informer que M./Mme <strong>${params.clientNom}</strong>, représentant(e) légal(e) de la société <strong>${params.clientRaisonSociale}</strong> (SIREN : <strong>${params.clientSiren}</strong>), nous a confié la mission de tenue de sa comptabilité ainsi que le suivi fiscal de son entreprise, à compter du prochain exercice comptable.</p>
    <p style="margin-bottom:12px;">Conformément aux dispositions du <strong>Code de déontologie de la profession d'expert-comptable</strong> (article 33) et aux règles déontologiques de l'Ordre des Experts-Comptables, nous vous adressons la présente lettre de reprise confraternelle.</p>
    <p style="margin-bottom:12px;">Nous vous serions reconnaissants de bien vouloir nous faire parvenir, dans un délai de <strong>15 jours</strong> à compter de la réception de ce courrier, les éléments comptables, fiscaux et juridiques en votre possession relatifs à ce dossier, notamment :</p>
    <ul style="margin-left:24px;margin-bottom:12px;line-height:1.8;">
      <li>Les derniers bilans comptables et liasses fiscales</li>
      <li>Les grands livres et balances générales</li>
      <li>Les déclarations fiscales en cours (TVA, IS, IR)</li>
      <li>Les déclarations sociales et état de la paie</li>
      <li>Tout document utile à la continuité du dossier</li>
    </ul>
    <p style="margin-bottom:24px;">Dans l'attente de votre réponse, et en vous remerciant de votre collaboration confraternelle, nous vous adressons, Madame, Monsieur, nos cordiales salutations.</p>
  </div>
  <div style="margin-top:40px;">
    <div style="font-weight:600;">${CABINET_INFO.nom}</div>
    <div style="color:#64748b;font-size:12px;margin-top:4px;">Expert-Comptable diplômé</div>
    <div style="margin-top:24px;border-top:1px solid #e2e8f0;padding-top:12px;font-size:11px;color:#94a3b8;">
      Document confidentiel — Correspondance confraternelle | ${CABINET_INFO.nom} | ${CABINET_INFO.adresse}, ${CABINET_INFO.codePostal} ${CABINET_INFO.ville}
    </div>
  </div>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

/** Génère et ouvre la Lettre de Mission dans un nouvel onglet */
export function generateLettreMission(params: {
  // Informations client
  clientNom: string;
  clientRaisonSociale: string;
  clientSiren: string;
  clientAdresse: string;
  clientEmail?: string;
  clientTelephone?: string;
  // Informations mission
  missions: string[];
  forfaitAnnuel: string;
  dateLettre: string;
  dateDebutMission: string;
  // Informations juridiques & fiscales
  formeJuridique?: string;
  regimeFiscal?: string;
  regimeTva?: string;
  statutSocialDirigeant?: string;
  dateCreation?: string;
  dateClotureExercice?: string;
  // Options
  logicielComptable?: string;
  nbSalaries?: string;
  // Missions hors forfait
  missionsSocial?: boolean;
  missionsJuridique?: boolean;
}): void {
  const forfaitMensuel = Math.round(parseFloat(params.forfaitAnnuel.replace(/\s/g, '').replace(',', '.')) / 12 || 0);
  const missionsList = params.missions.map(m => `<li style="margin-bottom:4px;">${m}</li>`).join('');
  const logiciel = params.logicielComptable || 'Pennylane';
  const forme = params.formeJuridique || '{{forme_juridique}}';
  const regime = params.regimeFiscal || '{{regime_fiscal}}';
  const tva = params.regimeTva || '{{regime_tva}}';
  const statut = params.statutSocialDirigeant || '{{statut_social_dirigeant}}';
  const dateClot = params.dateClotureExercice || '31/12';

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Lettre de Mission — ${params.clientRaisonSociale}</title>${printStyles()}</head>
<body>
  <button class="btn-print no-print" onclick="window.print()">🖨️ Imprimer / Exporter PDF</button>
  ${letterheadHtml()}

  <!-- TITRE -->
  <div style="text-align:center;margin-bottom:24px;">
    <h1 style="font-size:18px;font-weight:700;color:#1e3a5f;letter-spacing:-0.3px;">LETTRE DE MISSION</h1>
    <div style="font-size:12px;color:#64748b;margin-top:4px;">Conformément à l'article 151 du Code de déontologie intégré au décret du 30 mars 2012</div>
  </div>

  <!-- PARTIES -->
  <div style="background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:20px;border:1px solid #e2e8f0;">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12px;">
      <div><span style="color:#64748b;">Client :</span> <strong>${params.clientRaisonSociale}</strong></div>
      <div><span style="color:#64748b;">SIREN :</span> <strong>${params.clientSiren}</strong></div>
      <div><span style="color:#64748b;">Représentant légal :</span> <strong>${params.clientNom}</strong></div>
      <div><span style="color:#64748b;">Date de prise d'effet :</span> <strong>${params.dateDebutMission}</strong></div>
      <div><span style="color:#64748b;">Forme juridique :</span> <strong>${forme}</strong></div>
      <div><span style="color:#64748b;">Régime fiscal :</span> <strong>${regime}</strong></div>
      <div><span style="color:#64748b;">Régime TVA :</span> <strong>${tva}</strong></div>
      <div><span style="color:#64748b;">Clôture exercice :</span> <strong>${dateClot}</strong></div>
      <div style="grid-column:span 2;"><span style="color:#64748b;">Adresse :</span> <strong>${params.clientAdresse}</strong></div>
      ${params.clientEmail ? `<div><span style="color:#64748b;">Email :</span> <strong>${params.clientEmail}</strong></div>` : ''}
      ${params.clientTelephone ? `<div><span style="color:#64748b;">Téléphone :</span> <strong>${params.clientTelephone}</strong></div>` : ''}
    </div>
  </div>

  <!-- INTRODUCTION -->
  <div style="margin-bottom:20px;line-height:1.8;font-size:12px;">
    <p style="margin-bottom:12px;">Cher(e) ${params.clientNom},</p>
    <p style="margin-bottom:12px;">Vous avez bien voulu nous consulter en qualité d'expert-comptable pour vous assister dans la gestion de votre entreprise. Nous souhaitons tout particulièrement vous remercier de votre marque de confiance.</p>
    <p style="margin-bottom:12px;">Nous avons établi la présente lettre de mission pour définir, d'un commun accord, les conditions et l'étendue de nos interventions eu égard aux spécificités de votre activité.</p>
  </div>

  <!-- PRÉSENTATION DU CABINET -->
  <h2 style="font-size:14px;color:#1e3a5f;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #e2e8f0;">1. PRÉSENTATION DU CABINET</h2>
  <div style="line-height:1.8;margin-bottom:20px;font-size:12px;">
    <p style="margin-bottom:10px;"><strong>${CABINET_INFO.nom}</strong> est né de la volonté d'apporter un accompagnement humain, réactif et personnalisé à chaque entrepreneur. Le cabinet s'adresse aux créateurs, indépendants et dirigeants de TPE/PME qui souhaitent avancer en toute confiance dans la gestion de leur activité.</p>
    <p style="margin-bottom:10px;">Nous croyons qu'un conseil de qualité repose avant tout sur l'écoute, la transparence et la disponibilité. Notre mission est de sécuriser vos obligations comptables et fiscales, et de vous aider à prendre les meilleures décisions pour votre développement.</p>
    <p style="margin-bottom:10px;">Basé à Paris 8e, <strong>${CABINET_INFO.nom}</strong> s'appuie sur les outils digitaux les plus récents — notamment <strong>${logiciel}</strong> — pour vous offrir un service moderne, efficace et adapté à vos besoins d'aujourd'hui.</p>
    <p style="margin-bottom:6px;">Notre différence ? Une écoute active de vos besoins et des solutions concrètes pour :</p>
    <ul style="margin-left:20px;line-height:1.8;">
      <li>✓ Optimiser votre trésorerie</li>
      <li>✓ Sécuriser vos déclarations fiscales et sociales</li>
      <li>✓ Gagner du temps sur l'administratif</li>
      <li>✓ Anticiper les évolutions réglementaires</li>
    </ul>
    <p style="margin-top:10px;font-size:11px;color:#64748b;">La mission sera exécutée dans le respect des dispositions de la norme professionnelle du Conseil Supérieur de l'Ordre des Experts-Comptables et des textes légaux et réglementaires applicables. Le Cabinet contracte une obligation de moyens.</p>
  </div>

  <!-- PÉRIMÈTRE DES MISSIONS -->
  <h2 style="font-size:14px;color:#1e3a5f;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #e2e8f0;">2. PÉRIMÈTRE DES MISSIONS CONFIÉES</h2>
  <div style="margin-bottom:6px;font-size:12px;font-weight:600;color:#1e3a5f;">Comptabilité</div>
  <div style="font-size:12px;line-height:1.8;margin-bottom:10px;">
    Création et paramétrage du plan comptable, saisie chronologique des opérations, rapprochements bancaires mensuels, suivi des comptes de tiers, révision et contrôle des écritures, élaboration des comptes annuels (bilan, compte de résultat, annexe). Outil utilisé : <strong>${logiciel}</strong>.
  </div>
  <div style="margin-bottom:6px;font-size:12px;font-weight:600;color:#1e3a5f;">Fiscal</div>
  <div style="font-size:12px;line-height:1.8;margin-bottom:10px;">
    Établissement et dépôt des déclarations de TVA, préparation et transmission de la liasse fiscale, gestion des acomptes, déclarations CFE/CVAE, veille réglementaire et suivi des échéances. L'assistance lors de contrôles fiscaux fait l'objet d'une facturation séparée selon grille tarifaire.
  </div>
  <div style="margin-bottom:6px;font-size:12px;font-weight:600;color:#1e3a5f;">Conseil</div>
  <div style="font-size:12px;line-height:1.8;margin-bottom:10px;">
    Accompagnement stratégique, élaboration de budgets prévisionnels et business plans, conseil en gestion financière, optimisation fiscale et sociale dans le respect de la réglementation, veille réglementaire permanente.
  </div>
  <div style="margin-bottom:6px;font-size:12px;font-weight:600;color:#1e3a5f;">Suivi Client</div>
  <div style="font-size:12px;line-height:1.8;margin-bottom:10px;">
    Rendez-vous périodiques de suivi comptable, fiscal et social. Tableaux de bord personnalisés. Disponibilité permanente via messagerie professionnelle pour vos questions et décisions importantes.
  </div>
  ${params.missionsSocial ? `<div style="margin-bottom:6px;font-size:12px;font-weight:600;color:#1e3a5f;">Social</div>
  <div style="font-size:12px;line-height:1.8;margin-bottom:10px;">
    Établissement des bulletins de paie, gestion des DSN mensuelles et formalités d'embauche, suivi des cotisations sociales (URSSAF, caisses de retraite), conseil en droit du travail. Facturation à l'acte selon grille tarifaire.
  </div>` : ''}
  ${params.missionsJuridique ? `<div style="margin-bottom:6px;font-size:12px;font-weight:600;color:#1e3a5f;">Juridique</div>
  <div style="font-size:12px;line-height:1.8;margin-bottom:10px;">
    Préparation des assemblées générales et rédaction des procès-verbaux, dépôt des comptes, modifications statutaires, conseil en droit des sociétés. Facturation à la mission selon grille tarifaire.
  </div>` : ''}
  <div style="margin-bottom:12px;">
    <ul style="margin-left:20px;font-size:12px;line-height:1.8;">${missionsList}</ul>
  </div>

  <!-- GRILLE TARIFAIRE -->
  <h2 style="font-size:14px;color:#1e3a5f;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #e2e8f0;">3. GRILLE TARIFAIRE</h2>

  <div style="font-size:12px;font-weight:600;color:#1e3a5f;margin-bottom:4px;">Comptabilité</div>
  <table>
    <thead><tr><th>Prestation</th><th>Type</th><th>Unité</th><th>Prix HT</th></tr></thead>
    <tbody>
      <tr><td>Forfait comptable et fiscal</td><td>Forfaitaire</td><td>Année</td><td>${params.forfaitAnnuel} €</td></tr>
    </tbody>
  </table>

  <div style="font-size:12px;font-weight:600;color:#1e3a5f;margin-bottom:4px;">Conseil</div>
  <table>
    <thead><tr><th>Prestation</th><th>Type</th><th>Unité</th><th>Prix HT</th></tr></thead>
    <tbody>
      <tr><td>Prestation de conseil</td><td>À l'acte</td><td>Heure</td><td>125,00 €</td></tr>
    </tbody>
  </table>

  <div style="font-size:12px;font-weight:600;color:#1e3a5f;margin-bottom:4px;">Fiscal</div>
  <table>
    <thead><tr><th>Prestation</th><th>Type</th><th>Unité</th><th>Prix HT</th></tr></thead>
    <tbody>
      <tr><td>Assistance à contrôle fiscal</td><td>À l'acte</td><td>Heure</td><td>125,00 €</td></tr>
    </tbody>
  </table>

  <div style="font-size:12px;font-weight:600;color:#1e3a5f;margin-bottom:4px;">Juridique (facturation à la mission)</div>
  <table>
    <thead><tr><th>Prestation</th><th>Type</th><th>Unité</th><th>Prix HT</th></tr></thead>
    <tbody>
      <tr><td>Dissolution / liquidation / radiation / cessation</td><td>Forfaitaire</td><td>Unité</td><td>1 000,00 €</td></tr>
      <tr><td>Secrétariat juridique annuel courant</td><td>À l'acte</td><td>Heure</td><td>90,00 €</td></tr>
      <tr><td>Assemblée générale et dépôt des comptes</td><td>À l'acte</td><td>Unité</td><td>290,00 €</td></tr>
      <tr><td>Création / constitution / immatriculation</td><td>Forfaitaire</td><td>Unité</td><td>800,00 €</td></tr>
    </tbody>
  </table>

  <div style="font-size:12px;font-weight:600;color:#1e3a5f;margin-bottom:4px;">Social (facturation à la mission)</div>
  <table>
    <thead><tr><th>Prestation</th><th>Type</th><th>Unité</th><th>Prix HT</th></tr></thead>
    <tbody>
      <tr><td>Conseil RH</td><td>À l'acte</td><td>Heure</td><td>170,00 €</td></tr>
      <tr><td>Social — études, recherches</td><td>À l'acte</td><td>Heure</td><td>225,00 €</td></tr>
      <tr><td>Assistance à contrôle URSSAF</td><td>À l'acte</td><td>Heure</td><td>125,00 €</td></tr>
      <tr><td>Mise en place dossier mono-établissement</td><td>À l'acte</td><td>Unité</td><td>200,00 €</td></tr>
      <tr><td>Contrat de travail</td><td>À l'acte</td><td>Unité</td><td>85,00 €</td></tr>
      <tr><td>Attestation maladie / maternité / AT</td><td>À l'acte</td><td>Unité</td><td>25,00 €</td></tr>
      <tr><td>Bulletin de paie</td><td>À l'acte</td><td>Unité</td><td>26,00 €</td></tr>
      <tr><td>Départ d'un salarié</td><td>À l'acte</td><td>Unité</td><td>90,00 €</td></tr>
      <tr><td>Entrée d'un salarié</td><td>À l'acte</td><td>Unité</td><td>50,00 €</td></tr>
    </tbody>
  </table>

  <div style="font-size:12px;font-weight:600;color:#1e3a5f;margin-bottom:4px;">Suivi Client</div>
  <table>
    <thead><tr><th>Prestation</th><th>Type</th><th>Unité</th><th>Prix HT</th></tr></thead>
    <tbody>
      <tr><td>Suivi client</td><td>À l'acte</td><td>Heure</td><td>100,00 €</td></tr>
    </tbody>
  </table>

  <!-- FORFAIT ANNUEL -->
  <h2 style="font-size:14px;color:#1e3a5f;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #e2e8f0;">4. FORFAIT ANNUEL CONVENU</h2>
  <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin-bottom:14px;">
    <div style="font-size:20px;font-weight:700;color:#1e40af;">${params.forfaitAnnuel} € HT / an</div>
    <div style="font-size:13px;color:#3b82f6;margin-top:4px;font-weight:600;">Soit ${forfaitMensuel} € HT / mois — Prélèvement automatique mensuel</div>
  </div>
  <div style="font-size:12px;line-height:1.8;margin-bottom:6px;"><strong>Ce forfait comprend :</strong></div>
  <ul style="margin-left:20px;font-size:12px;line-height:1.8;margin-bottom:12px;">
    <li>Tenue et révision de la comptabilité</li>
    <li>Bilan comptable et liasse fiscale incluant la télétransmission</li>
    <li>Mise en place et suivi sur <strong>${logiciel}</strong> — plateforme en ligne et application mobile</li>
    <li>L'ensemble des déclarations fiscales périodiques (TVA, DES, DAS2, DECLOYER, taxes diverses)</li>
    <li>Les diligences et vérifications liées au statut <strong>${statut}</strong></li>
    <li>Une aide à la revue de la structure de charges pré-bilan afin d'optimiser la situation fiscale</li>
    <li>Échanges via messagerie professionnelle et rendez-vous de suivi comptable périodiques</li>
  </ul>
  <div style="font-size:12px;line-height:1.8;margin-bottom:6px;"><strong>Hors forfait — facturation à la mission :</strong></div>
  <ul style="margin-left:20px;font-size:12px;line-height:1.8;margin-bottom:16px;">
    <li>Social : bulletins de paie à l'acte — se référer à la grille tarifaire ci-dessus</li>
    <li>Juridique annuel : PV d'AG et dépôt des comptes au greffe — <strong>290,00 € HT</strong></li>
    <li>Déclaration d'IR : tarif déterminé au temps passé selon complexité du dossier</li>
  </ul>

  <!-- MODALITÉS DE FACTURATION -->
  <h2 style="font-size:14px;color:#1e3a5f;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #e2e8f0;">5. MODALITÉS DE FACTURATION ET DE PAIEMENT</h2>
  <div style="font-size:12px;line-height:1.8;margin-bottom:14px;">
    <p style="margin-bottom:10px;">Nos honoraires sont facturés en début de mois et payables par prélèvement. Aucun escompte ne sera accordé. Les prélèvements automatiques mensuels seront mis en place et la présente lettre de mission prendra effet à la validation du mandat de prélèvement.</p>
    <p style="margin-bottom:10px;">Le client s'engage à mettre en place la procédure de prélèvement dans les quinze (15) jours à compter de la signature du présent contrat et autorise l'établissement teneur de son compte à prélever tous les montants ordonnés par le Cabinet.</p>
    <p style="margin-bottom:10px;">En cas de litige sur un prélèvement, le client pourra en faire suspendre l'exécution par simple demande à son établissement bancaire.</p>
    <p style="margin-bottom:6px;"><strong>Pénalités de retard :</strong> en cas de retard de paiement, des pénalités sont exigibles dès le lendemain de la date d'échéance, au taux de <strong>trois (3) fois le taux d'intérêt légal</strong> en vigueur. Une <strong>indemnité forfaitaire pour frais de recouvrement de 40 €</strong> est également exigible de plein droit.</p>
    <p>Le non-paiement des honoraires pourra, après rappel par lettre recommandée avec accusé de réception, entraîner la suspension des travaux ou mettre fin à la mission.</p>
  </div>

  <!-- ASSURANCE -->
  <h2 style="font-size:14px;color:#1e3a5f;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #e2e8f0;">6. ASSURANCE ET RESPONSABILITÉ</h2>
  <div style="font-size:12px;line-height:1.8;margin-bottom:14px;">
    <p style="margin-bottom:10px;">Enfin, vous aurez la faculté de souscrire une assurance permettant de couvrir, en cas de contrôle fiscal ou social, nos honoraires d'assistance ainsi que, le cas échéant, les honoraires d'un avocat lors d'un contentieux.</p>
    <p style="margin-bottom:10px;">La responsabilité civile professionnelle du Cabinet est assurée auprès de <strong>Verspieren</strong>. La couverture géographique porte sur la France.</p>
    <p>En application de l'article 2254 modifié du Code civil, la responsabilité civile du Cabinet ne peut être mise en jeu que sur une période contractuellement définie à <strong>un (1) an</strong> à compter du moment où le préjudice est connu ou aurait dû être connu par le client.</p>
  </div>

  <!-- RÉVISION DES HONORAIRES -->
  <h2 style="font-size:14px;color:#1e3a5f;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #e2e8f0;">7. RÉVISION DES HONORAIRES</h2>
  <div style="font-size:12px;line-height:1.8;margin-bottom:14px;">
    <p>Les honoraires pourront être révisés en fonction de l'évolution de la mission, de la complexité des travaux ou de modifications légales et réglementaires. Le client sera informé par écrit de toute révision.</p>
  </div>

  <!-- OBLIGATIONS DES PARTIES -->
  <h2 style="font-size:14px;color:#1e3a5f;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #e2e8f0;">8. OBLIGATIONS DES PARTIES</h2>
  <div style="line-height:1.8;margin-bottom:14px;font-size:12px;">
    <p style="margin-bottom:8px;"><strong>Le Cabinet s'engage à :</strong> fournir les prestations listées dans les délais convenus, informer le client de toute difficulté rencontrée, respecter la confidentialité et le secret professionnel conformément à l'article 226-13 du Code pénal.</p>
    <p><strong>Le client s'engage à :</strong> remettre tous les documents nécessaires dans les délais convenus (et au plus tard le 10 du mois suivant la dépense), donner les délégations d'accès nécessaires aux plateformes fiscales et sociales, régler les honoraires aux échéances prévues, et transmettre les documents d'identification requis en matière de lutte contre le blanchiment de capitaux.</p>
  </div>

  <!-- DURÉE ET RENOUVELLEMENT -->
  <h2 style="font-size:14px;color:#1e3a5f;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #e2e8f0;">9. DURÉE ET RENOUVELLEMENT</h2>
  <div style="font-size:12px;line-height:1.8;margin-bottom:14px;">
    <p style="margin-bottom:8px;">La mission est conclue pour une durée d'une année correspondant à l'exercice comptable, à compter du <strong>${params.dateDebutMission}</strong>.</p>
    <p>Elle est renouvelable chaque année par tacite reconduction, sauf dénonciation par lettre recommandée avec accusé de réception trois (3) mois avant la date de clôture de l'exercice comptable.</p>
  </div>

  <!-- DONNÉES PERSONNELLES & LOGICIEL -->
  <h2 style="font-size:14px;color:#1e3a5f;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #e2e8f0;">10. DONNÉES PERSONNELLES ET OUTIL NUMÉRIQUE</h2>
  <div style="font-size:12px;line-height:1.8;margin-bottom:14px;">
    <p style="margin-bottom:8px;">Pour la réalisation de la mission, le Cabinet a recours au logiciel de comptabilité <strong>${logiciel}</strong>. Le client s'engage à conclure le contrat d'utilisation correspondant dans un délai de quinze (15) jours à compter de la signature des présentes.</p>
    <p>Les données personnelles transmises par le client seront traitées dans le respect du RGPD (Règlement UE 2016/679) et de la loi n°78-17 du 6 janvier 1978. Le client reste responsable de traitement au sens de la législation applicable.</p>
  </div>

  <!-- SIGNATURES -->
  <h2 style="font-size:14px;color:#1e3a5f;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #e2e8f0;">11. SIGNATURES</h2>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:20px;">
    <div>
      <div style="font-size:12px;color:#64748b;margin-bottom:8px;">Pour le Cabinet (Expert-Comptable) :</div>
      <div style="border-top:1px solid #94a3b8;padding-top:8px;margin-top:40px;font-size:12px;">
        <div style="font-weight:600;">${CABINET_INFO.nom}</div>
        <div style="color:#64748b;">SASU — SIREN : ${CABINET_INFO.siren}</div>
        <div style="color:#64748b;">Date : ${params.dateLettre}</div>
      </div>
    </div>
    <div>
      <div style="font-size:12px;color:#64748b;margin-bottom:8px;">Pour le Client (Lu et approuvé) :</div>
      <div style="border-top:1px solid #94a3b8;padding-top:8px;margin-top:40px;font-size:12px;">
        <div style="font-weight:600;">${params.clientNom} — ${params.clientRaisonSociale}</div>
        <div style="color:#64748b;">Date : ______________________</div>
      </div>
    </div>
  </div>
  <div style="margin-top:32px;border-top:1px solid #e2e8f0;padding-top:12px;font-size:11px;color:#94a3b8;text-align:center;">
    Document confidentiel | ${CABINET_INFO.nom} | SIREN : ${CABINET_INFO.siren} | ${CABINET_INFO.adresse}, ${CABINET_INFO.codePostal} ${CABINET_INFO.ville} | ${CABINET_INFO.siteWeb}
  </div>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
