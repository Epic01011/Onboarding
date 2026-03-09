export interface LetterTemplate {
  id: string;
  type: 'confraternal' | 'mission' | 'mandat_creation';
  name: string;
  content: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

const TEMPLATES_KEY = 'cabinetflow_templates';

const DEFAULT_CONFRATERNEL_CONTENT = `<div style="border-bottom:2px solid #1e3a5f;padding-bottom:12px;margin-bottom:24px;">
<p style="font-size:16px;font-weight:bold;color:#1e3a5f;margin:0 0 4px 0;">{{cabinet_nom}}</p>
<p style="font-size:11px;color:#555;margin:0 0 2px 0;">{{cabinet_adresse}}, {{cabinet_code_postal}} {{cabinet_ville}}{{#capital_social}} — Capital social : {{cabinet_capital_social}}{{/capital_social}}</p>
<p style="font-size:11px;color:#555;margin:0;">N° Ordre OEC : {{cabinet_numero_ordre}} | Tél. : {{cabinet_telephone}} | {{cabinet_expert}}, Expert-Comptable</p>
</div>


**LETTRE DE REPRISE DE DOSSIER**

Par LRAR et courriel :                                              {{cabinet_ville}}, le {{date_du_jour}}


Dossier :	{{client_raison_sociale}}   — {{client_siren}}
		{{client_adresse}}


Monsieur et Cher Confrère,

Par la présente, nous vous informons que nous avons été sollicités par {{client_raison_sociale}} pour la reprise de son dossier {{client_siren}}, pour assurer une mission sociale et une mission de présentation des comptes annuels de l'exercice ouvert à compter du {{date_effet}}.

Sachant que vous assumez ces fonctions jusqu'à présent et conformément à l'article 163 du décret du 30 mars 2012, nous vous serions reconnaissants de bien vouloir nous indiquer si rien ne s'oppose à la transmission de ce dossier et notamment si le montant des honoraires qui vous sont dus pour les travaux réalisés vous ont été normalement réglés.

Afin d'être en mesure d'apprécier la mission qui nous est proposée, nous vous remercions de nous faire part de tout commentaire que vous jugeriez utile.

Dans le cadre d'une réponse positive, nous vous serions reconnaissants de nous adresser les éléments sociaux, comptables et fiscaux nécessaires à la reprise des opérations relatives aux années antérieures à savoir :
	• Fichiers FEC des 3 derniers exercices comptables clos ;
	• Le tableau des immobilisations et des dotations aux amortissements ;
	• Le rapprochement bancaire au {{date_effet}}.

Dans cette attente de vous lire, nous vous prions d'agréer, Monsieur et Cher Confrère, nos salutations distinguées.

{{cabinet_expert}}
Expert-comptable`;

// ---------------------------------------------------------------------------
// LETTRE DE RÉPONSE CONFRATERNELLE

const HEADER_BLOCK = `<div style="border-bottom:2px solid #1e3a5f;padding-bottom:12px;margin-bottom:24px;">
<p style="font-size:16px;font-weight:bold;color:#1e3a5f;margin:0 0 4px 0;">{{cabinet_nom}}</p>
<p style="font-size:11px;color:#555;margin:0 0 2px 0;">{{cabinet_adresse}}, {{cabinet_code_postal}} {{cabinet_ville}}</p>
<p style="font-size:11px;color:#555;margin:0;">N° Ordre OEC : {{cabinet_numero_ordre}} | Tél. : {{cabinet_telephone}} | {{cabinet_expert}}, Expert-Comptable</p>
</div>

`;

// ---------------------------------------------------------------------------
const DEFAULT_REPONSE_CONFRATERNEL_CONTENT =
  HEADER_BLOCK +
  `**Par courriel** — {{cabinet_ville}}, le {{date_du_jour}}

---

**Cabinet {{confrere_societe}}**
À l'att. de M. {{confrere_nom}}
L'Expert-Comptable
{{confrere_adresse}}

**Dossier : {{client_raison_sociale}} — SIREN : {{client_siren}}**
{{client_adresse}}

Monsieur et Cher Confrère,

Nous accusons réception de votre courrier du {{date_courrier_confrere}}, concernant la reprise par vos soins du dossier de **{{client_raison_sociale}}**, à compter du {{date_effet}}.

Nous vous informons que cette société reste nous devoir la somme de **{{montant_honoraires_dus}} euros TTC**.

Son dossier sera tenu à votre disposition après réception du règlement intégral des honoraires dus.

Nous vous prions d'agréer, Monsieur et Cher Confrère, l'expression de nos salutations distinguées.

**{{cabinet_expert}}**
*Expert-Comptable*
{{cabinet_nom}}
`;

// ---------------------------------------------------------------------------
// LETTRE DE MISSION  —  modèle complet Hayot Expertise
// ---------------------------------------------------------------------------
const DEFAULT_MISSION_CONTENT =
  HEADER_BLOCK +
  `{{date_du_jour}}

*À l'attention de {{client_genre}} {{client_prenom}} {{client_nom}}*

**LETTRE DE MISSION**

---

{{client_genre}} {{client_prenom}},

Depuis la création de la société, vous avez bien voulu nous consulter en qualité d'expert-comptable pour vous assister dans la gestion de votre entreprise. Nous souhaitons tout particulièrement vous remercier de votre marque de confiance.

Nous avons établi la présente lettre de mission pour actualiser, d'un commun accord, les conditions et l'étendue de nos interventions eu égard aux spécificités de votre activité.

La présente lettre de mission est un contrat établi afin de se conformer aux dispositions de l'article 151 du code de déontologie intégré au décret du 30 mars 2012 relatif à l'exercice de l'activité d'expertise comptable.

---

## 1. VOTRE ENTREPRISE

Votre société **{{client_raison_sociale}}** (SIREN : {{client_siren}}) exerce des activités de {{client_activite}}. Vous exercez les fonctions {{client_statut_dirigeant}}.

---

## 2. NOTRE MISSION

La mission que vous envisagez de nous confier sera effectuée dans le respect des dispositions de la norme professionnelle du Conseil Supérieur de l'Ordre des Experts-Comptables applicable à la mission de présentation de comptes et des textes légaux et réglementaires applicables aux experts-comptables que nous sommes tenus de respecter.

Conformément à l'article L 123-14 du Code de commerce, les comptes annuels doivent être réguliers, sincères et donner une image fidèle du patrimoine, de la situation financière et du résultat de votre entité. Vous restez ainsi responsables à l'égard des tiers de l'exhaustivité, de la fiabilité et de l'exactitude des informations comptables et financières concourant à la présentation des comptes ainsi que des procédures de contrôle interne.

### 2.1. Durée de la mission

La mission est conclue pour une durée d'une année correspondant à l'exercice comptable.

Elle est renouvelable chaque année par tacite reconduction, sauf dénonciation par lettre recommandée avec accusé de réception trois mois avant la date de clôture de l'exercice comptable.

### 2.2. Nature et objectif de la mission

Vous souhaitez nous confier une mission de présentation des comptes annuels régie par les normes de l'Ordre des Experts Comptables.

Il s'agit d'une mission « d'assurance de niveau modéré aboutissant à une opinion exprimée sous une forme négative portant sur la cohérence et la vraisemblance des comptes de votre entité pris dans leur ensemble ; le niveau d'assurance est inférieur à celui d'un audit ou d'un examen limité ».

### 2.3. Nature et limites des travaux à mettre en œuvre

Nos travaux consisteront à vous assister pour la clôture des comptes et leur présentation d'ensemble ; ils comprennent notamment :

- Une prise de connaissance globale ;
- Une appréciation des procédures élémentaires d'organisation comptable ;
- Une appréciation de la régularité formelle de la comptabilité ;
- Une collecte des éléments concourant aux écritures d'inventaire de fin d'exercice ;
- Une justification des soldes et des contrôles de cohérence des principaux comptes ;
- Un examen critique des comptes pris dans leur ensemble ;
- Des entretiens avec la direction.

Ils ne comprennent pas le contrôle de la matérialité des opérations, les inventaires physiques des actifs de votre entité à la clôture (stocks, immobilisations, espèces en caisse), le recours à la procédure de confirmation de soldes auprès de tiers, ni l'appréciation des procédures de contrôle interne.

Nous vous précisons que nous sommes juridiquement redevables d'une simple obligation de moyens.

### 2.4. Exécution et déroulement de la mission

Notre mission sera exécutée sous la direction de **{{cabinet_expert}}**, expert-comptable associé, qui pourra se faire assister par d'autres membres du cabinet.

À l'issue de nos travaux, nous établirons une attestation sur les comptes annuels de votre entité à laquelle les comptes considérés seront annexés.

### 2.5. Missions complémentaires

En complément, et sous réserve de vos évolutions internes, nous assurerons les prestations suivantes :

{{missions_liste}}

Il est bien entendu que la mission pourra, sur votre demande, être complétée par d'autres interventions en matière fiscale, sociale, juridique, économique, financière ou de gestion.

### 2.6. Modalités relationnelles

Nos relations seront réglées sur le plan juridique tant par les termes de cette lettre que par les conditions générales établies par notre profession. Son exécution implique en ce qui nous concerne le respect des normes établies par le Conseil Supérieur de l'Ordre des Experts Comptables et, de votre part, un devoir d'information et de coopération.

### 2.7. Obligations d'identification (LCB-FT)

Dans le cadre des obligations qui nous incombent en application des dispositions du Code monétaire et financier relatives à la lutte contre le blanchiment de capitaux et le financement du terrorisme, vous devrez nous transmettre toutes les informations et les documents requis en matière d'identification des personnes physiques ou morales bénéficiaires effectifs de votre société. Leur obtention est une condition suspensive pour la mise en œuvre de la mission que vous souhaitez nous confier.

---

## 3. HONORAIRES, RÉVISION ET INDEXATION

Les honoraires relatifs aux travaux décrits aux articles précédents sont fixés sur la base d'un forfait annuel de **{{prix_annuel}} € HT** (soit **{{prix_mensuel}} € HT / mois**) et/ou des taux horaires suivants :

| Intervenant | Taux horaire HT | Vacation HT |
|---|---|---|
| Responsable de mission | {{taux_responsable}} € | — |
| Expert-comptable | 225 € | 1 800 € |
| Assistant confirmé | 125 € | 1 000 € |
| Collaborateur comptable | 90 € | 720 € |

Ces honoraires ont été déterminés en fonction de la nature des travaux confiés, du volume d'activité communiqué, du degré de complexité du dossier ainsi que des moyens humains et techniques nécessaires à leur réalisation.

Nos honoraires sont facturés en fin de mois et payables dans un délai de 30 jours. Aucun escompte ne sera accordé. Les prélèvements automatiques mensuels seront mis en place via GoCardless et la présente lettre de mission prendra effet à la validation du mandat.

Enfin, vous aurez la faculté de souscrire une assurance permettant de couvrir, en cas de contrôle fiscal ou social, nos honoraires d'assistance ainsi que, le cas échéant, les honoraires d'un avocat lors d'un contentieux (couverture AON – DAS).

### 3.1. Indexation annuelle automatique

Les honoraires ainsi définis seront révisés automatiquement chaque année à la date du **{{date_revision_annuelle}}** (ou à la date anniversaire de la présente lettre de mission), par application de la formule suivante :

*Honoraires année N = Honoraires année N−1 × (Indice INSEE « Indices des prix de production des services français aux entreprises (BtoB) – CPF 69.20 – Services comptables, d'audits et de conseil fiscal » — dernier indice publié à la date de révision / Indice INSEE de même série publié à la date de signature de la présente lettre de mission)*

L'indice de base retenu est celui du trimestre **{{indice_base_trimestre}}** de l'année **{{indice_base_annee}}**, soit une valeur de **{{indice_base_valeur}}**.

### 3.2. Révision en cas d'évolution de la mission

Indépendamment de cette indexation, les honoraires pourront être révisés d'un commun accord entre les parties en cas :

- d'augmentation significative du volume ou de la complexité des travaux ;
- de modification de la structure juridique, de l'activité ou des obligations légales de l'entreprise ;
- de demande de prestations complémentaires non prévues à la présente lettre de mission.

Toute révision fera l'objet :

- soit d'un avenant à la présente lettre de mission,
- soit, le cas échéant, d'une nouvelle lettre de mission,

communiqué(e) au client par écrit et soumis(e) à son acceptation préalable.

Le client sera informé par écrit de toute révision au moins **{{delai_preavis_revision}} jours** avant sa prise d'effet.

---

En espérant que cette lettre de mission réponde à votre attente, nous restons à votre disposition pour vous fournir toute information complémentaire.

Nous vous remercions de bien vouloir nous confirmer votre accord en nous retournant un exemplaire de la présente revêtu de votre signature.

En vous remerciant une nouvelle fois de la confiance que vous nous accordez, nous vous prions de croire, {{client_genre}} {{client_prenom}}, à l'expression de nos sentiments dévoués.

---

**Pour le Client :**                             **Pour le Cabinet {{cabinet_nom}} :**

_________________________                        _________________________

{{client_nom}}                                   **{{cabinet_expert}}**
*Signature du représentant légal*                *Expert-comptable*
`;

// ---------------------------------------------------------------------------
// MANDAT DE CRÉATION D'ENTREPRISE
// ---------------------------------------------------------------------------
const DEFAULT_MANDAT_CREATION_CONTENT =
  HEADER_BLOCK +
  `{{date_du_jour}}

*À l'attention de {{client_genre}} {{client_prenom}} {{client_nom}}*

**MANDAT DE RÉALISATION DES FORMALITÉS DE CRÉATION D'ENTREPRISE**

---

Entre les soussignés :

**Le Mandataire (Cabinet) :**
{{cabinet_nom}}, sis {{cabinet_adresse}}, {{cabinet_code_postal}} {{cabinet_ville}}
SIREN : {{cabinet_siren}} | N° Ordre OEC : {{cabinet_numero_ordre}}
Représenté par {{cabinet_expert}}, Expert-Comptable inscrit à l'Ordre des Experts-Comptables

**Le Mandant (Client) :**
{{client_genre}} {{client_prenom}} {{client_nom}}
Adresse : {{client_adresse}}
Email : {{client_email}}

---

## Article 1 — Objet du mandat

Par le présent mandat, le Mandant confie au Mandataire la mission d'accomplir en son nom et pour son compte l'ensemble des formalités nécessaires à la création de l'entreprise, et notamment :

- La rédaction des statuts constitutifs ;
- Le dépôt du dossier d'immatriculation auprès du guichet unique (INPI) ;
- La publication de l'annonce légale de constitution ;
- Les déclarations fiscales initiales (option TVA, régime fiscal) ;
- Les déclarations sociales du ou des dirigeant(s) ;
- Toute autre formalité administrative nécessaire à l'immatriculation.

## Article 2 — Obligations du Mandataire

Le Mandataire s'engage à accomplir les formalités avec diligence et conformément aux dispositions légales et réglementaires en vigueur. Il informera le Mandant de l'avancement des démarches.

## Article 3 — Obligations du Mandant

Le Mandant s'engage à fournir au Mandataire tous les documents, informations et pièces justificatives nécessaires à l'accomplissement des formalités, dans les délais convenus.

## Article 4 — Durée

Le présent mandat prend effet à compter de sa signature et prend fin à l'obtention de l'extrait KBIS de la société.

## Article 5 — Honoraires

Les honoraires relatifs à la réalisation des formalités de création sont inclus dans la lettre de mission du cabinet.

---

Fait en double exemplaire à {{cabinet_ville}}, le {{date_du_jour}}.

**Pour le Mandataire :**                  **Pour le Mandant :**

_________________________                 _________________________

{{cabinet_expert}}                        {{client_nom}}
*Expert-Comptable*
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getDefaultTemplates(): LetterTemplate[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'default_confraternel',
      type: 'confraternal',
      name: 'Lettre de reprise confraternelle — Hayot',
      content: DEFAULT_CONFRATERNEL_CONTENT,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'default_reponse_confraternel',
      type: 'confraternal',
      name: 'Réponse confraternelle (honoraires dus) — Hayot',
      content: DEFAULT_REPONSE_CONFRATERNEL_CONTENT,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'default_mission',
      type: 'mission',
      name: 'Lettre de Mission complète — Hayot',
      content: DEFAULT_MISSION_CONTENT,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'default_mandat_creation',
      type: 'mandat_creation',
      name: 'Mandat de création d\'entreprise',
      content: DEFAULT_MANDAT_CREATION_CONTENT,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function getAllTemplates(): LetterTemplate[] {
  try {
    const data = localStorage.getItem(TEMPLATES_KEY);
    if (!data) {
      const defaults = getDefaultTemplates();
      localStorage.setItem(TEMPLATES_KEY, JSON.stringify(defaults));
      return defaults;
    }
    return JSON.parse(data);
  } catch {
    return getDefaultTemplates();
  }
}

export function getTemplatesByType(type: 'confraternal' | 'mission' | 'mandat_creation'): LetterTemplate[] {
  return getAllTemplates().filter(t => t.type === type);
}

export function getTemplate(id: string): LetterTemplate | null {
  return getAllTemplates().find(t => t.id === id) || null;
}

export function saveTemplate(template: LetterTemplate): void {
  const templates = getAllTemplates();
  const index = templates.findIndex(t => t.id === template.id);
  const updated = { ...template, updatedAt: new Date().toISOString() };
  if (index >= 0) {
    templates[index] = updated;
  } else {
    templates.push({ ...updated, createdAt: new Date().toISOString() });
  }
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
}

export function deleteTemplate(id: string): void {
  const templates = getAllTemplates().filter(t => t.id !== id);
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
}

/**
 * Réinitialise les modèles par défaut.
 * Les modèles personnalisés (isDefault = false) sont conservés.
 */
export function resetDefaultTemplates(): void {
  const all = getAllTemplates();
  const custom = all.filter(t => !t.isDefault);
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify([...getDefaultTemplates(), ...custom]));
}

export function createNewTemplate(type: 'confraternal' | 'mission' | 'mandat_creation'): LetterTemplate {
  const now = new Date().toISOString();
  const defaultContent =
    type === 'confraternal'
      ? DEFAULT_CONFRATERNEL_CONTENT
      : type === 'mission'
      ? DEFAULT_MISSION_CONTENT
      : DEFAULT_MANDAT_CREATION_CONTENT;
  return {
    id: `tmpl_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    type,
    name:
      type === 'confraternal'
        ? 'Nouvelle lettre confraternelle'
        : type === 'mission'
        ? 'Nouvelle lettre de mission'
        : 'Nouveau mandat de création',
    content: defaultContent,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// Template variables
// ---------------------------------------------------------------------------
export interface TemplateVariables {
  // Cabinet
  cabinet_nom?: string;
  cabinet_adresse?: string;
  cabinet_code_postal?: string;
  cabinet_ville?: string;
  cabinet_siren?: string;
  cabinet_numero_ordre?: string;
  cabinet_expert?: string;
  cabinet_telephone?: string;
  cabinet_capital_social?: string;
  // Client
  client_genre?: string;
  client_prenom?: string;
  client_nom?: string;
  client_raison_sociale?: string;
  client_siren?: string;
  client_email?: string;
  client_adresse?: string;
  client_forme_juridique?: string;
  client_activite?: string;
  client_statut_dirigeant?: string;
  // Confraternelle
  confrere_email?: string;
  confrere_nom?: string;
  confrere_adresse?: string;
  confrere_societe?: string;
  date_courrier_confrere?: string;
  montant_honoraires_dus?: string;
  missions_liste?: string;
  prix_annuel?: string;
  prix_mensuel?: string;
  taux_responsable?: string;        // Taux horaire Responsable de mission
  // Mission — indexation (§ 3.1)
  date_revision_annuelle?: string;  // ex. "1er février"
  indice_base_trimestre?: string;   // ex. "T3"
  indice_base_annee?: string;       // ex. "2025"
  indice_base_valeur?: string;      // ex. "131,4"
  delai_preavis_revision?: string;  // ex. "30"
  // Dates
  date_du_jour?: string;
  date_effet?: string;
  date_rapprochement?: string;
  // Honoraires (variables Supabase-compatibles — alias dédiés Devis)
  honoraires_mensuels_ht?: string;  // = prix_mensuel (alias explicite)
  honoraires_annuels_ht?: string;   // = prix_annuel  (alias explicite)
  honoraires_mensuels_ttc?: string; // prix_mensuel × 1,20
  honoraires_annuels_ttc?: string;  // prix_annuel  × 1,20
  // Détail du devis par ligne
  honoraires_comptabilite_ht?: string;
  honoraires_bilan_ht?: string;
  honoraires_social_ht?: string;
  honoraires_options_ht?: string;
  frais_mise_en_place?: string;     // setup fees
  // Régime et volume
  regime_fiscal?: string;           // ex. "Réel normal"
  nb_bulletins?: string;            // nombre de bulletins de salaire/mois
}

export function substituteVariables(content: string, variables: TemplateVariables): string {
  let result = content;

  // Handle conditional blocks: {{#key}}...{{/key}}
  // Show block content only if the variable has a non-empty value.
  // The backreference \1 ensures opening and closing tags match the same key.
  result = result.replace(/\{\{#([^}]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, inner) => {
    const value = variables[key as keyof TemplateVariables];
    return value ? inner : '';
  });

  // Handle regular variable substitution
  for (const [key, value] of Object.entries(variables)) {
    if (value !== undefined) {
      result = result.split(`{{${key}}}`).join(value);
    }
  }
  return result;
}

/**
 * Convertit le contenu Markdown-like des templates en HTML pour l'aperçu.
 *
 * Syntaxes supportées :
 *  [img:URL]          → <img> pleine largeur (en-tête logo)
 *  **gras**           → <strong>
 *  *italique*         → <em>
 *  ---                → <hr>
 *  ## / ###           → <h2> / <h3>
 *  | col | (tableau)  → <table> zèbrée
 *  - item             → <li> groupés dans <ul>
 */
export function renderLetterHtml(content: string): string {
  // Split content into HTML blocks and text blocks so HTML is passed through
  // while plain-text sections still receive markdown-like processing.
  const parts = content.split(/(<[^>]+>[\s\S]*?<\/[^>]+>|<[^>]+\/>|<[^>]+>)/g);
  const processed = parts.map((part, i) => {
    // Odd indices are HTML tags/blocks — pass through as-is
    if (i % 2 === 1) return part;
    // Even indices are plain text — apply markdown-like transforms
    let result = part;

    // Tables: convert | col | syntax blocks to <table> (must run before \n → <br>)
    result = result.replace(/((?:^\|[^\n]+\n?)+)/gm, (block) => {
      const rows = block.trim().split('\n').filter(row => row.trim().startsWith('|'));
      if (rows.length < 1) return block;
      const isTableSeparator = (row: string) => /^\|[\s:|-]+\|/.test(row.trim().replace(/[^|:-]/g, '').padEnd(3, '-'));
      const parseRow = (row: string) => row.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
      const hasHeader = rows.length >= 2 && isTableSeparator(rows[1]);
      let html = '<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:12px;">';
      if (hasHeader) {
        html += '<thead><tr>' + parseRow(rows[0]).map(cell =>
          `<th style="background:#1e3a5f;color:#fff;padding:6px 10px;text-align:left;">${cell}</th>`
        ).join('') + '</tr></thead><tbody>';
        for (let rowIndex = 2; rowIndex < rows.length; rowIndex++) {
          if (rows[rowIndex].trim()) {
            html += '<tr>' + parseRow(rows[rowIndex]).map(cell =>
              `<td style="padding:5px 10px;border-bottom:1px solid #e2e8f0;">${cell}</td>`
            ).join('') + '</tr>';
          }
        }
      } else {
        html += '<tbody>';
        for (const row of rows) {
          if (row.trim()) {
            html += '<tr>' + parseRow(row).map(cell =>
              `<td style="padding:5px 10px;border-bottom:1px solid #e2e8f0;">${cell}</td>`
            ).join('') + '</tr>';
          }
        }
      }
      html += '</tbody></table>';
      return html;
    });

    // Bullet lists: lines starting with "- " or "• " (must run before \n → <br>)
    result = result.replace(/((?:[ \t]*[-•][ \t][^\n]+\n?)+)/g, (block) => {
      const items = block.trim().split('\n')
        .map(line => line.replace(/^[ \t]*[-•][ \t]/, '').trim())
        .filter(Boolean);
      if (items.length === 0) return block;
      return '<ul style="padding-left:20px;margin:8px 0;line-height:1.7;">' +
        items.map(item => `<li style="margin:2px 0;">${item}</li>`).join('') + '</ul>';
    });

    return result
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>')
      .replace(/---/g, '<hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;">')
      .replace(/^(#{1,3})\s+(.+)$/gm, (_, hashes, text) => `<h${hashes.length} style="margin:8px 0;">${text}</h${hashes.length}>`)
      .replace(/\n/g, '<br>');
  });
  return processed.join('');
}

export function buildLetterHtml(body: string, vars?: Partial<TemplateVariables>): string {
  const nom = vars?.cabinet_nom || '';
  const adresse = vars?.cabinet_adresse || '';
  const cp = vars?.cabinet_code_postal || '';
  const ville = vars?.cabinet_ville || '';
  const siren = vars?.cabinet_siren || '';
  const ordre = vars?.cabinet_numero_ordre || '';
  const capital = vars?.cabinet_capital_social || '';
  const tel = vars?.cabinet_telephone || '';
  const expert = vars?.cabinet_expert || '';

  const adresseLine = [adresse, `${cp} ${ville}`.trim()].filter(Boolean).join(' — ');

  // If the body already opens with an HTML block (e.g. HEADER_BLOCK from a template),
  // skip the auto-generated letterhead to avoid duplicate headers.
  const bodyHasHeader = /^\s*</.test(body);

  const header = bodyHasHeader ? '' : `<div style="border-bottom:2px solid #1e3a5f;padding-bottom:16px;margin-bottom:32px;">
    ${nom ? `<div style="font-size:20px;font-weight:700;color:#1e3a5f;letter-spacing:-0.3px;">${nom}</div>` : ''}
    ${adresseLine ? `<div style="font-size:12px;color:#475569;margin-top:4px;">${adresseLine}</div>` : ''}
    ${(tel || ordre || expert) ? `<div style="font-size:12px;color:#475569;margin-top:2px;">${[tel && `Tél. : ${tel}`, ordre && `N° Ordre OEC : ${ordre}`, expert && expert].filter(Boolean).join(' | ')}</div>` : ''}
    ${capital ? `<div style="font-size:12px;color:#475569;">Capital social : ${capital}</div>` : ''}
  </div>`;

  const footer = `<div style="border-top:1px solid #e2e8f0;margin-top:48px;padding-top:12px;font-size:11px;color:#94a3b8;display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px;">
    ${siren ? `<span>SIREN : ${siren}</span>` : '<span></span>'}
    ${ordre ? `<span>Inscrit à l'Ordre des Experts-Comptables — N° ${ordre}</span>` : ''}
  </div>`;

  return header + renderLetterHtml(body) + footer;
}

export const AVAILABLE_VARIABLES: { key: keyof TemplateVariables; label: string; category: string }[] = [
  { key: 'cabinet_nom', label: 'Nom du cabinet', category: 'Cabinet' },
  { key: 'cabinet_adresse', label: 'Adresse du cabinet', category: 'Cabinet' },
  { key: 'cabinet_code_postal', label: 'Code postal', category: 'Cabinet' },
  { key: 'cabinet_ville', label: 'Ville du cabinet', category: 'Cabinet' },
  { key: 'cabinet_siren', label: 'SIREN du cabinet', category: 'Cabinet' },
  { key: 'cabinet_numero_ordre', label: "N° d'Ordre OEC", category: 'Cabinet' },
  { key: 'cabinet_expert', label: 'Nom de l\'expert-comptable', category: 'Cabinet' },
  { key: 'cabinet_telephone', label: 'Téléphone', category: 'Cabinet' },
  { key: 'cabinet_capital_social', label: 'Capital social', category: 'Cabinet' },
  { key: 'client_genre', label: 'Civilité (M. / Mme)', category: 'Client' },
  { key: 'client_prenom', label: 'Prénom du dirigeant', category: 'Client' },
  { key: 'client_nom', label: 'Nom du dirigeant', category: 'Client' },
  { key: 'client_raison_sociale', label: 'Raison sociale', category: 'Client' },
  { key: 'client_siren', label: 'SIREN client', category: 'Client' },
  { key: 'client_email', label: 'Email client', category: 'Client' },
  { key: 'client_adresse', label: 'Adresse client', category: 'Client' },
  { key: 'client_forme_juridique', label: 'Forme juridique', category: 'Client' },
  { key: 'client_activite', label: "Activité de l'entreprise", category: 'Client' },
  { key: 'client_statut_dirigeant', label: 'Statut du dirigeant', category: 'Client' },
  { key: 'confrere_email', label: 'Email du confrère', category: 'Reprise' },
  { key: 'confrere_nom', label: 'Nom du confrère', category: 'Reprise' },
  { key: 'confrere_adresse', label: 'Adresse du confrère', category: 'Reprise' },
  { key: 'confrere_societe', label: 'Cabinet du confrère', category: 'Reprise' },
  { key: 'date_courrier_confrere', label: 'Date du courrier confrère', category: 'Reprise' },
  { key: 'montant_honoraires_dus', label: 'Montant honoraires dus (€)', category: 'Reprise' },
  { key: 'missions_liste', label: 'Liste des missions', category: 'Mission' },
  { key: 'prix_annuel', label: 'Honoraires annuels HT', category: 'Mission' },
  { key: 'prix_mensuel', label: 'Honoraires mensuels HT', category: 'Mission' },
  { key: 'taux_responsable', label: 'Taux horaire responsable (€/h)', category: 'Mission' },
  { key: 'honoraires_mensuels_ht', label: 'Honoraires mensuels HT (alias)', category: 'Honoraires' },
  { key: 'honoraires_annuels_ht', label: 'Honoraires annuels HT (alias)', category: 'Honoraires' },
  { key: 'honoraires_mensuels_ttc', label: 'Honoraires mensuels TTC', category: 'Honoraires' },
  { key: 'honoraires_annuels_ttc', label: 'Honoraires annuels TTC', category: 'Honoraires' },
  { key: 'honoraires_comptabilite_ht', label: 'Comptabilité — mensuel HT', category: 'Honoraires' },
  { key: 'honoraires_bilan_ht', label: 'Bilan/Révision — mensuel HT', category: 'Honoraires' },
  { key: 'honoraires_social_ht', label: 'Social/Paie — mensuel HT', category: 'Honoraires' },
  { key: 'honoraires_options_ht', label: 'Options — mensuel HT', category: 'Honoraires' },
  { key: 'frais_mise_en_place', label: 'Frais de mise en place HT', category: 'Honoraires' },
  { key: 'regime_fiscal', label: 'Régime fiscal', category: 'Honoraires' },
  { key: 'nb_bulletins', label: 'Nombre de bulletins/mois', category: 'Honoraires' },
  { key: 'date_du_jour', label: 'Date du jour', category: 'Dates' },
  { key: 'date_effet', label: "Date d'effet", category: 'Dates' },
  { key: 'date_rapprochement', label: 'Date rapprochement bancaire', category: 'Dates' },
  { key: 'date_revision_annuelle', label: 'Date de révision annuelle', category: 'Dates' },
  { key: 'indice_base_trimestre', label: 'Indice base — trimestre', category: 'Dates' },
  { key: 'indice_base_annee', label: 'Indice base — année', category: 'Dates' },
  { key: 'indice_base_valeur', label: 'Indice base — valeur', category: 'Dates' },
  { key: 'delai_preavis_revision', label: 'Délai préavis révision (jours)', category: 'Dates' },
];

/**
 * Moteur de variables — génère un document à partir d'un modèle et des données client.
 *
 * Remplace automatiquement les variables clés issues du contexte d'onboarding :
 *   {{raisonSociale}}, {{siren}}, {{dirigeant}}, {{honoraires}}
 * ainsi que toutes les variables de TemplateVariables ({{cabinet_nom}}, etc.)
 *
 * @param template - Contenu brut du modèle (Markdown ou texte)
 * @param clientData - Données du contexte d'onboarding
 * @param extraVars - Variables supplémentaires (optionnel)
 * @returns Contenu du document avec toutes les variables substituées
 */
export function generateDocumentFromTemplate(
  template: string,
  clientData: {
    raisonSociale?: string;
    siren?: string;
    nom?: string;
    email?: string;
    adresse?: string;
    codePostal?: string;
    ville?: string;
    formeJuridique?: string;
    prixAnnuel?: string;
    missionsSelectionnees?: string[];
  },
  extraVars?: Partial<TemplateVariables>
): string {
  // Short-form aliases commonly used in templates
  const shortVars: Record<string, string> = {
    raisonSociale: clientData.raisonSociale ?? '',
    siren: clientData.siren ?? '',
    dirigeant: clientData.nom ?? '',
    honoraires: (() => {
    const val = parseFloat(clientData.prixAnnuel ?? '');
    return !isNaN(val) && val > 0 ? `${val.toLocaleString('fr-FR')} € HT/an` : '';
  })(),
    email: clientData.email ?? '',
    adresse: [clientData.adresse, clientData.codePostal, clientData.ville].filter(Boolean).join(' '),
    formeJuridique: clientData.formeJuridique ?? '',
    missionsList: clientData.missionsSelectionnees?.map(m => `• ${m}`).join('\n') ?? '',
  };

  // Canonical TemplateVariables form
  const prixAnnuel = parseFloat(clientData.prixAnnuel ?? '0') || 0;
  const canonicalVars: TemplateVariables = {
    client_raison_sociale: clientData.raisonSociale,
    client_siren: clientData.siren,
    client_nom: clientData.nom,
    client_email: clientData.email,
    client_adresse: [clientData.adresse, clientData.codePostal, clientData.ville].filter(Boolean).join(', '),
    client_forme_juridique: clientData.formeJuridique,
    missions_liste: clientData.missionsSelectionnees?.map(m => `• ${m}`).join('\n'),
    prix_annuel: prixAnnuel ? prixAnnuel.toLocaleString('fr-FR') : undefined,
    prix_mensuel: prixAnnuel ? Math.round(prixAnnuel / 12).toLocaleString('fr-FR') : undefined,
    date_du_jour: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
    ...extraVars,
  };

  // Apply short-form variables first
  let result = template;
  for (const [key, value] of Object.entries(shortVars)) {
    result = result.split(`{{${key}}}`).join(value);
  }

  // Apply canonical TemplateVariables
  result = substituteVariables(result, canonicalVars);

  return result;
}

// ---------------------------------------------------------------------------
// Chargement asynchrone depuis Supabase `documents`
// ---------------------------------------------------------------------------

/**
 * Charge les modèles depuis la table Supabase `documents`,
 * en les convertissant au format LetterTemplate interne.
 * Retourne les modèles par défaut (hardcodés) si la table est vide ou inaccessible.
 *
 * @param type  - Filtre optionnel par type de modèle
 */
export async function getTemplatesFromSupabase(
  type?: 'confraternal' | 'mission' | 'mandat_creation',
): Promise<LetterTemplate[]> {
  try {
    const { getDocumentsBackend } = await import('./backendApi');
    const docs = await getDocumentsBackend(type);
    if (docs.length > 0) {
      return docs.map(d => ({
        id: d.id,
        type: d.type,
        name: d.name,
        content: d.contenu,
        isDefault: d.is_default,
        createdAt: d.created_at ?? new Date().toISOString(),
        updatedAt: d.updated_at ?? new Date().toISOString(),
      }));
    }
  } catch (err) {
    console.warn('[templateUtils] getTemplatesFromSupabase error – using local defaults:', err);
  }
  // Fallback : modèles locaux (localStorage → hardcodés)
  return type ? getTemplatesByType(type) : getAllTemplates();
}

/**
 * Sauvegarde un modèle dans Supabase `documents` ET dans localStorage.
 */
export async function saveTemplateToSupabase(template: LetterTemplate): Promise<void> {
  // Persist locally first (fast, resilient)
  saveTemplate(template);
  try {
    const { saveDocumentBackend } = await import('./backendApi');
    await saveDocumentBackend({
      id: template.id,
      type: template.type,
      name: template.name,
      contenu: template.content,
      is_default: template.isDefault,
    });
  } catch (err) {
    console.warn('[templateUtils] saveTemplateToSupabase error – saved locally only:', err);
  }
}

/**
 * Supprime un modèle de Supabase `documents` ET de localStorage.
 */
export async function deleteTemplateFromSupabase(id: string): Promise<void> {
  deleteTemplate(id);
  try {
    const { deleteDocumentBackend } = await import('./backendApi');
    await deleteDocumentBackend(id);
  } catch (err) {
    console.warn('[templateUtils] deleteTemplateFromSupabase error – deleted locally only:', err);
  }
}
