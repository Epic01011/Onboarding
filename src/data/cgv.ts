// ============================================================
// CGV HAYOT EXPERTISE — Modèle de données structuré
// Mise à jour : Mars 2026
// ============================================================

export interface ArticleCGV {
  id: number;
  titre: string;
  contenu: string[];
}

export interface CGVModel {
  version: string;
  dateMAJ: string;
  cabinet: string;
  assureur: string;
  logiciel: string;
  tribunal: string;
  articles: ArticleCGV[];
}

export const CGV: CGVModel = {
  version: "2026.1",
  dateMAJ: "Mars 2026",
  cabinet: "HAYOT EXPERTISE",
  assureur: "Verspieren",
  logiciel: "Pennylane",
  tribunal: "Tribunal de commerce de Paris",
  articles: [
    {
      id: 1,
      titre: "Domaine d'application",
      contenu: [
        "Les présentes Conditions Générales sont applicables à la Mission définie ci-dessus entre le Cabinet et le Client.",
        "Le Client reconnaît qu'il contracte en qualité de professionnel, tel que ce terme est défini par le Code de la consommation au jour de la signature du Contrat, et que le Contrat constitue un contrat de prestations de services en rapport avec ses activités professionnelles."
      ]
    },
    {
      id: 2,
      titre: "Définition de la Mission",
      contenu: [
        "La Mission incombant au Cabinet est détaillée dans la Lettre de Mission et est strictement limitée à son contenu."
      ]
    },
    {
      id: 3,
      titre: "Obligations du Cabinet",
      contenu: [
        "Le Cabinet effectue la Mission qui lui est confiée conformément aux dispositions du Code de déontologie intégré au décret du 30 mars 2012 relatif à l'exercice de l'activité d'expertise comptable, de la norme professionnelle de « Maîtrise de la qualité », de la norme professionnelle relative aux obligations de la profession d'expertise comptable en matière de lutte contre le blanchiment des capitaux et le financement du terrorisme (NPLAB) élaborée en application des dispositions du Code monétaire et financier et le cas échéant de la norme professionnelle de travail spécifique à la mission considérée. Il contracte, en raison de cette mission, une obligation de moyens.",
        "Les procédures et les travaux que le Cabinet mettra en œuvre dans le cadre du Contrat correspondent à une mission d'assistance à l'établissement des comptes annuels et ne constitueront ni une présentation de compte, ni un audit, ni un examen limité de comptes. En conséquence, aucune expression d'opinion ne sera donnée à l'issue de la Mission.",
        "Le Cabinet peut se faire assister par les collaborateurs de son choix.",
        "À l'achèvement de sa Mission, le Cabinet restitue les documents appartenant au Client que ce dernier lui a confiés pour l'exécution de la Mission.",
        "Le Cabinet est tenu : au secret professionnel dans les conditions prévues à l'article 226-13 du Code pénal ; à une obligation de discrétion, distincte de l'obligation précédente, quant aux informations recueillies et à la diffusion des documents qu'il a établis. Ces derniers sont adressés au Client, à l'exclusion de tout envoi à un tiers, sauf demande du Client."
      ]
    },
    {
      id: 4,
      titre: "Obligations du Client",
      contenu: [
        "Le Client s'interdit tout acte de nature à porter atteinte à l'indépendance du Cabinet ou de ses collaborateurs.",
        "Le Client s'engage à fournir au Cabinet, préalablement au commencement de la Mission, les informations et documents d'identification requis en application des dispositions visées aux articles L 561-1 et suivants du Code monétaire et financier.",
        "Le Client s'engage à mettre à la disposition du Cabinet l'ensemble des documents, données, informations et logiciels ou plateformes utilisées par le Client pour les besoins de son activité et nécessaires à l'exécution de la Mission.",
        "Le Client s'engage à ne communiquer au Cabinet que des informations, données et des documents utiles à la réalisation de la Mission.",
        "Le Client s'engage à réaliser les travaux lui incombant conformément aux stipulations prévues dans le tableau de répartition des obligations respectives (annexe 2).",
        "Le Client s'engage à porter à la connaissance du Cabinet les faits nouveaux ou exceptionnels et à lui signaler également les engagements susceptibles d'affecter les résultats ou la situation patrimoniale de l'entité.",
        "Le Client s'engage à confirmer par écrit, si le Cabinet le lui demande, que les documents, renseignements et explications fournis sont exhaustifs et reflètent fidèlement la situation patrimoniale de l'entité.",
        "Le Client reste responsable de la bonne application de la législation et des règlements en vigueur ; le Cabinet ne peut être considéré comme se substituant aux obligations du Client du fait de cette Mission."
      ]
    },
    {
      id: 5,
      titre: "Utilisation du Logiciel",
      contenu: [
        "Pour la réalisation de la Mission, le Cabinet a recours au logiciel de comptabilité Pennylane (le « Logiciel ») détenu par la société REV, SAS immatriculée au RCS de Cherbourg sous le numéro 880 265 921 (« REV »).",
        "Concomitamment à la signature des présentes ou dans un délai qui ne saurait excéder quinze (15) jours à compter de la signature des présentes, le Client s'engage à conclure avec REV, un contrat l'autorisant à utiliser le Logiciel.",
        "Le Client déclare avoir vérifié que le Logiciel est compatible avec son environnement informatique en vue de bénéficier pleinement d'un droit d'utilisation."
      ]
    },
    {
      id: 6,
      titre: "Données Comptables et Données des comptes de paiement du Client",
      contenu: [
        "Le Client concède au Cabinet tous droits de propriété intellectuelle sur les données auxquelles le Cabinet pourrait avoir accès par le biais du Logiciel et en particulier ses données comptables et financières issues de sa comptabilité (les « Données Comptables »), ainsi que les données de ses comptes de paiement (les « Données de Paiement »).",
        "Au titre du droit sui generis sur les Données Comptables et sur les Données de Paiement, le Client concède au Cabinet, à titre non-exclusif et gratuit : le droit d'extraire les Données Comptables et les Données de Paiement de leur base de données ; le droit d'utiliser et de reproduire les Données Comptables et les Données de Paiement ; le droit de traduire les Données Comptables et les Données de Paiement en toutes langues.",
        "Cette concession est effective tant pour la France que pour l'étranger et pour toute la durée légale de protection des droits sui generis sur les bases de données et des droits d'auteur."
      ]
    },
    {
      id: 7,
      titre: "Modalités de paiement",
      contenu: [
        "Le montant des honoraires pour la réalisation de la Mission est précisé à l'annexe 1 du Contrat.",
        "La Mission est facturée mensuellement, terme à échoir, et sera payée par prélèvement automatique le même mois.",
        "Le Client s'engage à mettre en place cette procédure de prélèvement dans les quinze (15) jours à compter de la signature du Contrat.",
        "Les honoraires sont payés à leur date d'échéance ; en cas de paiement anticipé, aucun escompte n'est accordé ; en cas de retard de paiement, des pénalités de retard sont exigibles le jour suivant la date de règlement figurant sur la facture. Le taux d'intérêt des pénalités de retard exigibles s'élève à trois fois le taux d'intérêt légal en vigueur.",
        "Une indemnité forfaitaire pour frais de recouvrement d'un montant de 40 euros est également exigible de plein droit en cas de retard de paiement.",
        "Le non-paiement des honoraires pourra, après rappel par lettre recommandée avec accusé de réception, entraîner la suspension des travaux ou mettre fin à la Mission."
      ]
    },
    {
      id: 8,
      titre: "Assurance et responsabilité",
      contenu: [
        "La responsabilité civile professionnelle du Cabinet est assurée par Verspieren. La couverture géographique de cette assurance porte sur la France.",
        "En application de l'article 2254 modifié du Code civil, la responsabilité civile du Cabinet ne peut être mise en jeu que sur une période contractuellement définie à un (1) an à compter du moment où le préjudice est connu ou aurait dû être connu par le Client.",
        "Le montant des dommages directs réparables que le Cabinet peut être amené à payer au Client est limité, tous dommages confondus, aux honoraires effectivement payés pour la période de 12 mois précédant le ou les événements ayant engendré une telle mise en cause de sa responsabilité."
      ]
    },
    {
      id: 9,
      titre: "Résiliation de la mission",
      contenu: [
        "Les conditions de résiliation sont précisées à l'article 2 de la Lettre de Mission.",
        "Nonobstant ce qui précède, chacune des parties pourra résilier ce Contrat sans délai par lettre recommandée avec accusé de réception, si l'autre partie n'exécute pas ou ne respecte pas une quelconque de ses obligations résultant du Contrat et, dans la mesure où il peut y être remédié, si la partie susvisée n'y a pas remédié dans les soixante (60) jours suivant la notification écrite de cette violation.",
        "Le Cabinet peut résilier de plein droit le Contrat en cas de perte de confiance du Cabinet dans le Client ou en cas de méconnaissance par ce dernier d'une clause substantielle du Contrat."
      ]
    },
    {
      id: 10,
      titre: "Force majeure",
      contenu: [
        "Conformément aux dispositions de l'article 1218 du code civil, chacune des parties sera dégagée de toute responsabilité si l'inexécution de ses obligations résulte d'un cas de force majeure, au sens de la jurisprudence de la Cour de cassation.",
        "Si la Mission est suspendue pour cause de Force Majeure pendant une durée supérieure à un (1) mois, l'une ou l'autre des parties pourra résilier de plein droit le Contrat par courrier recommandé avec avis de réception."
      ]
    },
    {
      id: 11,
      titre: "Données personnelles",
      contenu: [
        "Le Cabinet traitera les données personnelles éventuellement transmises par le Client dans les conditions de l'annexe RGPD du Contrat."
      ]
    },
    {
      id: 12,
      titre: "Publicité",
      contenu: [
        "Le Client autorise le Cabinet à utiliser son nom et son logo dans le cadre de ses opérations de marketing (brochures, présentations, site internet)."
      ]
    },
    {
      id: 13,
      titre: "Nullité",
      contenu: [
        "La nullité ou l'inopposabilité d'une ou plusieurs dispositions du Contrat n'affectera pas la validité des autres stipulations de ce Contrat, dès lors que les obligations peuvent être réalisées."
      ]
    },
    {
      id: 14,
      titre: "Intégralité du Contrat",
      contenu: [
        "Le Contrat exprime l'intégralité des obligations des Parties, annule et remplace tout accord, correspondance, ou écrit antérieur, relatif au même objet.",
        "En cas de contradiction ou de divergence entre les termes des documents contractuels, l'ordre de prévalence est le suivant : la Lettre de Mission ; l'annexe 1 ; l'annexe 2 ; l'annexe RGPD ; les Conditions Générales."
      ]
    },
    {
      id: 15,
      titre: "Interprétation",
      contenu: [
        "Les intitulés et la numérotation des clauses du Contrat ont pour seul but de permettre de localiser les différentes clauses et n'ont aucune signification particulière ni portée juridique."
      ]
    },
    {
      id: 16,
      titre: "Réclamations, litiges et attribution de juridiction",
      contenu: [
        "Le Contrat sera régi et interprété selon le droit français.",
        "Les difficultés et réclamations qui pourraient survenir dans le cadre de la présente Lettre de Mission seront traitées par le service relation Client du Cabinet HAYOT EXPERTISE.",
        "Les litiges qui pourraient éventuellement survenir entre le Cabinet et le Client pourront être portés, avant toute action judiciaire, devant le président du Conseil Régional de l'Ordre compétent ou son représentant aux fins de conciliation.",
        "Faute de parvenir à un accord amiable, tous les litiges auxquels le Contrat pourra donner lieu seront soumis au tribunal de commerce de Paris."
      ]
    }
  ]
};

export default CGV;
