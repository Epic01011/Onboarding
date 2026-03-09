// ============================================================
// MODÈLES DE LETTRES DE MISSION — Cabinet HAYOT EXPERTISE
// Alignés sur la structure de LettreMissionTemplate.tsx
// 5 modèles : Standard / BNC / IRPP / Social / Avenant
// ============================================================

export type MissionTemplateId =
  | 'standard'
  | 'bnc'
  | 'irpp'
  | 'social_assistance'
  | 'avenant';

export interface MissionTemplate {
  id: MissionTemplateId;
  label: string;
  description: string;
  badgeColor: string;
  defaultTypeMission: string;
  clauses: {
    objetMission: string[];
    descriptionMissions: {
      comptabilite?: string[];
      conseil?: string[];
      fiscal?: string[];
      juridique?: string[];
      social?: string[];
      suiviClient?: string[];
      specifique?: string[];
    };
    honoraires: string[];
    duree: string[];
    repartitionTravaux: string[];
    identification: string[];
  };
}

export const MISSION_TEMPLATES: MissionTemplate[] = [
  {
    id: 'standard',
    label: 'Standard (BIC/IS)',
    description:
      'TPE/PME, sociétés ou EI au réel : tenue/révision comptable, liasse, TVA, social selon besoin.',
    badgeColor: 'bg-blue-100 text-blue-800',
    defaultTypeMission:
      'Mission de tenue/révision comptable, fiscalité courante et accompagnement social',
    clauses: {
      objetMission: [
        "La présente lettre de mission a pour objet de définir la nature, l'étendue et les limites des interventions confiées au Cabinet ainsi que les obligations réciproques des parties.",
        "La mission est une obligation de moyens et s'exécute conformément aux normes professionnelles de l'Ordre des Experts-Comptables, au code de déontologie intégré au décret du 30 mars 2012, et aux textes légaux et réglementaires applicables.",
      ],
      descriptionMissions: {
        comptabilite: [
          'Création et paramétrage du dossier, plan comptable adapté à votre activité, organisation du processus de collecte des pièces.',
          'Tenue ou supervision de la comptabilité : saisie/révision des opérations, rapprochements bancaires mensuels, contrôle de cohérence, suivi des comptes de tiers (clients/fournisseurs).',
          "Établissement des comptes annuels (bilan, compte de résultat, annexe) et, le cas échéant, situations intermédiaires mensuelles ou trimestrielles sur demande (facturation complémentaire selon temps passé).",
        ],
        conseil: [
          "Accompagnement de gestion : tableaux de bord, analyse de marge et de trésorerie, budgets prévisionnels et business plans.",
          "Veille réglementaire permanente et recommandations d'optimisation fiscale/sociale dans le respect de la réglementation en vigueur.",
        ],
        fiscal: [
          'Établissement et dépôt des déclarations de TVA (régime réel normal ou simplifié), préparation et transmission de la liasse fiscale, gestion des acomptes et du solde IS/IR, déclarations annexes (CFE, CVAE, DAS2, taxes diverses).',
          'Assistance lors de contrôles fiscaux éventuels : facturation séparée sur devis/temps passé, sauf forfait spécifique souscrit.',
        ],
        social: [
          "Établissement des bulletins de paie, gestion des déclarations sociales nominatives (DSN) et des formalités d'embauche, suivi des cotisations sociales (URSSAF, caisses de retraite).",
          'Assistance lors de contrôles sociaux (URSSAF) sur devis/temps passé selon périmètre.',
        ],
        suiviClient: [
          'Rendez-vous périodiques pour faire le point sur votre situation comptable, fiscale et sociale ; analyse des indicateurs clés de performance.',
          "Disponibilité permanente pour répondre à vos questions ; accompagnement à l'utilisation des outils digitaux (ex. Pennylane) ; coordination des échanges.",
        ],
      },
      honoraires: [
        "Les honoraires sont définis au devis/forfait annuel et/ou à l'acte selon la grille tarifaire communiquée ; ils s'entendent hors TVA (20 %).",
        "Facturation mensuelle terme à échoir, règlement par prélèvement automatique. En cas de retard : pénalités au taux de 3× le taux d'intérêt légal en vigueur, exigibles dès le lendemain de l'échéance + indemnité forfaitaire de recouvrement de 40 €. Aucun escompte accordé.",
        "Les prestations hors périmètre (contentieux, audit, inventaires physiques des actifs, attestations spécifiques, démarches exceptionnelles, déplacements) font l'objet d'une facturation complémentaire sur devis.",
      ],
      duree: [
        'La mission prend effet à la date de démarrage convenue et est conclue pour une durée indéterminée à compter de la signature.',
        "Chacune des parties peut y mettre fin par lettre recommandée avec accusé de réception sous réserve d'un préavis de trois (3) mois, sauf faute grave. La résiliation ne dispense pas le Client du règlement des honoraires dus pour les travaux réalisés.",
      ],
      repartitionTravaux: [
        "Le Client est responsable de l'exhaustivité, de la sincérité et de la ponctualité des pièces transmises ; il s'engage à communiquer tout justificatif avant le 10 du mois suivant l'opération.",
        "Le Cabinet réalise les travaux prévus au périmètre sous la direction de l'expert-comptable associé et restitue les documents appartenant au Client à l'issue de la mission.",
      ],
      identification: [
        "Dans le cadre des obligations LCB-FT (articles L. 561-1 et suivants du Code monétaire et financier), le Client fournit avant démarrage les éléments d'identification (personne physique ou morale) et, le cas échéant, les informations relatives au bénéficiaire effectif. Leur obtention constitue une condition suspensive de mise en œuvre de la mission.",
      ],
    },
  },

  {
    id: 'bnc',
    label: 'BNC — Professions libérales',
    description:
      'Professions libérales relevant des BNC : recettes/dépenses, 2035 et annexes, immobilisations, TVA si applicable.',
    badgeColor: 'bg-yellow-100 text-yellow-800',
    defaultTypeMission:
      'Mission comptable et fiscale BNC — établissement de la déclaration 2035 et accompagnement professionnel',
    clauses: {
      objetMission: [
        "La présente lettre de mission concerne une activité libérale relevant des Bénéfices Non Commerciaux (BNC). Elle a pour objet d'assister le Client dans ses obligations comptables et fiscales et de sécuriser ses déclarations professionnelles.",
        "La mission est une obligation de moyens ; elle n'a pas pour objet de déceler des fraudes ou des irrégularités non portées à notre connaissance. Elle est réalisée conformément aux normes de l'Ordre des Experts-Comptables.",
      ],
      descriptionMissions: {
        comptabilite: [
          "Mise en place du dossier et des règles d'imputation spécifiques BNC : recettes encaissées, dépenses payées, suivi des immobilisations et amortissements déductibles, TVA le cas échéant.",
          'Tenue/supervision des écritures, contrôle de cohérence, rapprochements bancaires, justification des soldes.',
          "Préparation des éléments de clôture et des états nécessaires à l'établissement de la déclaration professionnelle.",
        ],
        fiscal: [
          'Établissement de la déclaration professionnelle BNC (formulaire 2035 et annexes 2035 A/B) et télétransmission dans le respect des délais légaux.',
          'Déclarations de TVA si applicable selon régime et seuils ; taxes annexes selon situation (CVAE, CFE, DAS2…) sur périmètre défini.',
          'Assistance en cas de contrôle fiscal : facturation séparée sur temps passé ou forfait spécifique si souscrit.',
        ],
        conseil: [
          'Organisation administrative : classement, justificatifs, notes de frais, frais de déplacements, bonnes pratiques de tenue.',
          'Points de pilotage : suivi de trésorerie, anticipation des charges sociales/fiscales, conseil sur les investissements professionnels (amortissement, choix de financement).',
        ],
        specifique: [
          "Le Client s'engage à distinguer strictement les dépenses professionnelles et personnelles, à établir des notes de frais régulières et à conserver l'ensemble des justificatifs.",
          "En l'absence répétée de justificatifs dans les délais convenus, le Cabinet pourra, après en avoir informé le Client par tous moyens, inscrire les charges sans récupération de TVA (si applicable) et/ou suspendre les travaux.",
        ],
      },
      honoraires: [
        "Honoraires forfaitaires et/ou à l'acte selon la lettre de mission et la grille tarifaire ; les situations intermédiaires, prestations d'assistance à contrôle et interventions exceptionnelles sont hors forfait sauf mention expresse.",
        'Facturation mensuelle terme à échoir, règlement par prélèvement. Pénalités de retard : 3× taux légal + 40 €.',
      ],
      duree: [
        "La mission est conclue pour l'exercice comptable en cours et se renouvelle par tacite reconduction, sauf dénonciation par LRAR au moins trois (3) mois avant la date de clôture de l'exercice.",
      ],
      repartitionTravaux: [
        "Le Client fournit mensuellement les relevés bancaires, factures de recettes et de dépenses, justificatifs de frais de déplacements, notes de frais et informations d'inventaire en fin d'exercice.",
        'Le Cabinet réalise la tenue/révision, établit les déclarations prévues et adresse au Client les livrables pour validation avant dépôt.',
      ],
      identification: [
        "Obligations d'identification (LCB-FT) : transmission des éléments requis (CNI, KBIS ou équivalent, bénéficiaire effectif) avant démarrage de la mission.",
      ],
    },
  },

  {
    id: 'irpp',
    label: 'IRPP / IR — Assistance déclarative',
    description:
      "Assistance à l'établissement de la déclaration d'impôt sur le revenu (2042 + annexes), optimisation légale.",
    badgeColor: 'bg-orange-100 text-orange-800',
    defaultTypeMission:
      "Mission d'assistance à l'établissement et au dépôt de la déclaration d'impôt sur le revenu (IR — 2042)",
    clauses: {
      objetMission: [
        "La présente mission consiste à assister le Client dans la collecte, la vérification et la mise en forme des éléments nécessaires à l'établissement de sa déclaration annuelle d'impôt sur le revenu, dans la limite des informations transmises.",
        "Le Cabinet n'intervient pas en tant qu'avocat et n'assure pas, sauf accord distinct, la représentation en cas de contentieux fiscal ou de recours contentieux devant les juridictions administratives.",
      ],
      descriptionMissions: {
        fiscal: [
          "Collecte et revue des informations fiscales du foyer : salaires et pensions, revenus fonciers (2044), revenus de capitaux mobiliers (IFU), revenus BIC/BNC/BA, plus-values mobilières et immobilières (2042 C), crédits et réductions d'impôt, IFI le cas échéant.",
          'Préparation et/ou revue de la déclaration 2042 et des annexes applicables ; assistance à la télé-déclaration sur impots.gouv.fr si incluse dans le périmètre.',
          "Identification des points d'optimisation légaux (choix des régimes, déductions admissibles, réductions d'impôt, case à cocher…) et recommandations dans le respect strict de la réglementation.",
        ],
        conseil: [
          'Conseil de premier niveau sur la situation fiscale du foyer : gestion du prélèvement à la source, acomptes, rattrapage, calendrier des échéances.',
          "Orientation vers un avocat fiscaliste ou notaire pour toute problématique contentieuse, successorale ou patrimoniale complexe, sauf mission complémentaire expressément acceptée.",
        ],
        specifique: [
          "Le Client demeure responsable de l'exactitude, de l'exhaustivité et de la sincérité des informations et documents transmis ; le Cabinet ne peut être tenu responsable des omissions, des erreurs ou des pièces non communiquées.",
          "Le traitement de la mission suppose la remise de l'intégralité des pièces dans un délai compatible avec la date limite de dépôt de la déclaration.",
        ],
      },
      honoraires: [
        "Honoraires définis au forfait ou au temps passé selon la complexité du dossier et le nombre d'annexes ; un devis préalable peut être établi sur demande.",
        "Toute demande post-dépôt (corrections, réponses aux demandes de l'administration, réclamations) est facturée en sus sauf forfait dédié expressément prévu.",
      ],
      duree: [
        "Mission ponctuelle portant sur la campagne déclarative de l'année N.",
        "Tout renouvellement ou extension à d'autres exercices ou à la gestion patrimoniale fera l'objet d'un avenant écrit.",
      ],
      repartitionTravaux: [
        "Le Client transmet l'ensemble des justificatifs (IFU, attestations employeur, charges déductibles, justificatifs fonciers, actes notariés le cas échéant…) et valide les informations avant télétransmission.",
        "Le Cabinet prépare la déclaration et, si inclus, soumet au Client une version de validation avant envoi à l'administration.",
      ],
      identification: [
        "Obligations LCB-FT : le Client transmet avant démarrage une copie de pièce d'identité et justificatif de domicile fiscal.",
      ],
    },
  },

  {
    id: 'social_assistance',
    label: 'Assistance sociale spécifique',
    description:
      'Mission RH/sociale ciblée : paie/DSN, procédures, assistance contrôle URSSAF, rédaction de contrats.',
    badgeColor: 'bg-red-100 text-red-800',
    defaultTypeMission:
      "Mission d'assistance en matière sociale spécifique (paie / DSN / procédures RH / URSSAF)",
    clauses: {
      objetMission: [
        "La présente mission sociale spécifique a pour objet d'assister le Client sur un périmètre social défini (paie, DSN, procédures RH, formalités d'embauche/départ, assistance contrôle URSSAF), sans se substituer à ses obligations d'employeur.",
        "Le Cabinet intervient dans le cadre d'une obligation de moyens et peut recommander, en cas de contentieux prud'homal ou de négociation collective complexe, l'intervention d'un avocat en droit du travail.",
      ],
      descriptionMissions: {
        social: [
          'Paramétrage du logiciel de paie, production des bulletins de salaire selon les variables transmises et gestion des déclarations sociales nominatives (DSN) mensuelles.',
          "Formalités d'embauche (DPAE, contrat de travail type, remise des documents d'entrée), formalités de départ (solde de tout compte, attestation Pôle Emploi, certificat de travail, rupture conventionnelle le cas échéant).",
          'Établissement des attestations de salaire (maladie, maternité, accident du travail), suivi des cotisations URSSAF, retraite, prévoyance.',
          "Assistance lors du contrôle URSSAF : préparation du dossier, analyse des chefs de redressement, échanges avec l'agent contrôleur (hors contentieux en commission de recours amiable ou juridiction, sauf mission complémentaire).",
        ],
        conseil: [
          'Conseil en droit du travail de premier niveau : rédaction/relecture de contrats (CDI, CDD, alternance, stage), veille sociale, gestion des absences et congés.',
          'Audit social ponctuel : revue des pratiques paie et déclarative, conformité des contrats, détection des risques.',
        ],
        specifique: [
          "Le Client s'engage à communiquer les variables de paie (absences, primes, heures supplémentaires, embauches, ruptures…) au plus tard le [date à définir] de chaque mois.",
          "Toute prestation non comprise dans le périmètre ci-dessus (contentieux prud'homal, représentation en commission de recours amiable, négociation d'accord collectif) fait l'objet d'un devis séparé et/ou d'une orientation vers un conseil spécialisé.",
        ],
      },
      honoraires: [
        "Honoraires selon forfait mensuel (paie/DSN) et/ou à l'acte : entrée salarié, départ, contrat, attestation, mise en place dossier… selon grille tarifaire. Assistance contrôle URSSAF : au temps passé.",
        'Facturation mensuelle ou à la réalisation selon la nature de la prestation. Modalités identiques aux CGV (pénalités de retard, indemnité de recouvrement).',
      ],
      duree: [
        'Mission conclue sur la période convenue ; toute reconduction est formalisée par avenant.',
        "Résiliation sous préavis défini au contrat principal ou à l'avenant.",
      ],
      repartitionTravaux: [
        "Le Client valide les bulletins et la DSN avant envoi lorsque cela est requis, et conserve les pièces originales (contrats signés, justificatifs d'absence…).",
        "Le Cabinet prépare les documents et réalise les déclarations dans le périmètre convenu sous la responsabilité de l'expert-comptable.",
      ],
      identification: [
        "Obligations LCB-FT et respect du secret professionnel. Sécurisation des échanges de données personnelles (RGPD) conforme à l'annexe Données Personnelles des CGV.",
      ],
    },
  },

  {
    id: 'avenant',
    label: 'Avenant — Mission complémentaire',
    description:
      "Avenant prêt à l'emploi pour ajouter une mission ponctuelle : prévisionnel, situation intermédiaire, assistance contrôle, acte juridique simple, etc.",
    badgeColor: 'bg-green-100 text-green-800',
    defaultTypeMission: 'Avenant n°[X] à la lettre de mission — mission complémentaire',
    clauses: {
      objetMission: [
        'Le présent avenant complète et modifie la lettre de mission initiale en ajoutant la prestation spécifique décrite ci-après. Toutes les autres clauses de la lettre de mission et des Conditions Générales demeurent inchangées et en vigueur, sauf stipulation expresse contraire dans le présent avenant.',
        'Le présent avenant entre en vigueur à sa date de signature par les deux parties.',
      ],
      descriptionMissions: {
        specifique: [
          'Nature et contenu de la prestation ajoutée : [décrire précisément la prestation, les livrables attendus, le calendrier prévisionnel et les hypothèses de travail retenues].',
          "Périmètre et exclusions : la présente prestation ne comprend pas l'audit légal, les inventaires physiques des actifs, le contentieux, les démarches administratives non prévues, sauf accord distinct.",
        ],
      },
      honoraires: [
        "Honoraires convenus au forfait / au temps passé selon les conditions définies dans cet avenant ; ils s'entendent hors TVA (20 %).",
        'Les frais et débours exposés pour le compte du Client (greffe, annonces légales, frais de déplacement sur demande expresse) sont refacturés au réel avec justificatifs.',
      ],
      duree: [
        "L'avenant prend effet à sa date de signature et s'achève à la remise du livrable convenu ou à l'issue de la période expressément définie.",
        "Pour toute mission récurrente intégrée via cet avenant, un préavis de résiliation est prévu dans les mêmes conditions que la lettre de mission principale.",
      ],
      repartitionTravaux: [
        "Le Client s'engage à fournir les informations, données et justificatifs nécessaires dans les délais permettant la bonne réalisation de la prestation.",
        "Le Cabinet réalise la prestation selon les normes professionnelles applicables et les diligences convenues, et informe le Client en cas d'impossibilité ou d'imprévu.",
      ],
      identification: [
        "Obligations d'identification (LCB-FT) si non déjà satisfaites au titre de la lettre de mission principale. Rappel de la confidentialité et du secret professionnel pour toutes informations recueillies.",
      ],
    },
  },
];
