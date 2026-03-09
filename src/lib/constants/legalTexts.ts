/**
 * Référentiel exhaustif des textes juridiques
 * Conditions Générales de Vente (CGV), Annexe RGPD,
 * Modèles de Lettres de Mission (LDM Standard et IRPP)
 */

// ─── CGV ──────────────────────────────────────────────────────────────────────

export const CGV: { id: number; article: string; content: string }[] = [
  {
    id: 1,
    article: '1. Domaine d\'application',
    content:
      'Les présentes Conditions Générales sont applicables à la Mission définie ci-dessus entre le Cabinet et le Client. Le Client reconnaît qu\'il contracte en qualité de professionnel, tel que ce terme est défini par le Code de la consommation au jour de la signature du Contrat, et que le Contrat constitue un contrat de prestations de services en rapport avec ses activités professionnelles.',
  },
  {
    id: 2,
    article: '2. Définition de la Mission',
    content:
      'La Mission incombant au Cabinet est détaillée dans la Lettre de Mission et est strictement limitée à son contenu.',
  },
  {
    id: 3,
    article: '3. Obligations du Cabinet',
    content:
      'Le Cabinet effectue la Mission qui lui est confiée conformément aux dispositions du Code de déontologie intégré au décret du 30 mars 2012 relatif à l\'exercice de l\'activité d\'expertise comptable, de la norme professionnelle de « Maîtrise de la qualité », de la norme professionnelle relative aux obligations de la profession d\'expertise comptable en matière de lutte contre le blanchiment des capitaux et le financement du terrorisme (NPLAB). Il contracte, en raison de cette mission, une obligation de moyens. Les procédures et les travaux que le Cabinet mettra en œuvre dans le cadre du Contrat correspondent à une mission d\'assistance à l\'établissement des comptes annuels et ne constitueront ni une présentation de compte, ni un audit, ni un examen limité de comptes. En conséquence, aucune expression d\'opinion ne sera donnée à l\'issue de la Mission. Cette mission n\'a pas pour objectif de déceler des erreurs, actes illégaux ou autres irrégularités pouvant ou ayant eu lieu chez le Client. Le Cabinet peut se faire assister par les collaborateurs de son choix. À l\'achèvement de sa Mission, le Cabinet restitue les documents appartenant au Client. Le Cabinet est tenu au secret professionnel dans les conditions prévues à l\'article 226-13 du Code pénal ; à une obligation de discrétion, distincte de l\'obligation précédente.',
  },
  {
    id: 4,
    article: '4. Obligations du Client',
    content:
      'Le Client s\'interdit tout acte de nature à porter atteinte à l\'indépendance du Cabinet ou de ses collaborateurs. Le Client s\'engage à fournir au Cabinet, préalablement au commencement de la Mission, les informations et documents d\'identification requis en application des dispositions visées aux articles L 561-1 et suivants du Code monétaire et financier ; à mettre à la disposition du Cabinet, l\'ensemble des documents, données, informations et logiciels ou plateformes utilisées par le Client ; à ne communiquer au Cabinet que des informations, données et des documents utiles à la réalisation de la Mission. Le Client reste responsable de la bonne application de la législation et des règlements en vigueur.',
  },
  {
    id: 5,
    article: '5. Utilisation du Logiciel',
    content:
      'Pour la réalisation de la Mission, le Cabinet a recours au logiciel de comptabilité Pennylane (le « Logiciel ») détenu par la société REV, SAS immatriculée au RCS de Cherbourg sous le numéro 880 265 921 (« REV »). Concomitamment à la signature des présentes ou dans un délai qui ne saurait excéder quinze (15) jours, le Client s\'engage à conclure avec REV, un contrat l\'autorisant à utiliser le Logiciel.',
  },
  {
    id: 6,
    article: '6. Données Comptables et Données des comptes de paiement du Client',
    content:
      'Le Client concède au Cabinet tous droits de propriété intellectuelle sur les données auxquelles le Cabinet pourrait avoir accès par le biais du Logiciel et en particulier ses données comptables et financières issues de sa comptabilité. Le Cabinet utilisera les Données Comptables et les Données de Paiement notamment aux fins de réalisation de la Mission.',
  },
  {
    id: 7,
    article: '7. Modalités de paiement',
    content:
      'Le montant des honoraires pour la réalisation de la Mission est précisé à l\'annexe 1 du Contrat. La Mission est facturée mensuellement, terme à échoir, et sera payée par prélèvement automatique le même mois. En cas de retard de paiement, des pénalités de retard sont exigibles le jour suivant la date de règlement figurant sur la facture. Le taux d\'intérêt des pénalités de retard exigibles s\'élève à trois fois le taux d\'intérêt légal en vigueur. Une indemnité forfaitaire pour frais de recouvrement d\'un montant de 40 euros est également exigible de plein droit.',
  },
  {
    id: 8,
    article: '8. Assurance et responsabilité',
    content:
      'La responsabilité civile professionnelle du Cabinet est assurée par Verspieren. La couverture géographique de cette assurance porte sur la France. En application de l\'article 2254 modifié du Code civil, la responsabilité civile du Cabinet ne peut être mise en jeu que sur une période contractuellement définie à un (1) an. Le montant des dommages directs réparables que le Cabinet peut être amené à payer au Client est limité, tous dommages confondus, aux honoraires effectivement payés pour la période de 12 mois précédant le ou les événements.',
  },
  {
    id: 9,
    article: '9. Résiliation de la mission',
    content:
      'Les conditions de résiliation sont précisées à l\'article 2 de la Lettre de Mission. Nonobstant ce qui précède, chacune des parties pourra résilier ce Contrat sans délai par lettre recommandée avec accusé de réception, si l\'autre partie n\'exécute pas ou ne respecte pas une quelconque de ses obligations. Le Cabinet peut résilier de plein droit le Contrat en cas de perte de confiance du Cabinet dans le Client ou en cas de méconnaissance par ce dernier d\'une clause substantielle du Contrat.',
  },
  {
    id: 10,
    article: '10. Force majeure',
    content:
      'Conformément aux dispositions de l\'article 1218 du code civil, chacune des parties sera dégagée de toute responsabilité si l\'inexécution de ses obligations résulte d\'un cas de force majeure.',
  },
  {
    id: 11,
    article: '11. Données personnelles',
    content:
      'Le Cabinet traitera les données personnelles éventuellement transmises par le Client dans les conditions de l\'annexe 5 du Contrat.',
  },
  {
    id: 12,
    article: '12. Publicité',
    content:
      'Le Client autorise le Cabinet à utiliser son nom et son logo dans le cadre de ses opérations de marketing (brochures, présentations, site internet).',
  },
  {
    id: 13,
    article: '13. Nullité',
    content:
      'La nullité ou l\'inopposabilité d\'une ou plusieurs dispositions du Contrat, n\'affectera pas la validité des autres stipulations.',
  },
  {
    id: 14,
    article: '14. Intégralité du Contrat',
    content:
      'Le Contrat exprime l\'intégralité des obligations des Parties, annule et remplace tout accord, correspondance, ou écrit antérieur.',
  },
  {
    id: 15,
    article: '15. Interprétation',
    content:
      'Les intitulés et la numérotation des clauses du Contrat ont pour seul but de permettre de localiser les différentes clauses.',
  },
  {
    id: 16,
    article: '16. Réclamations, litiges et attribution de juridiction',
    content:
      'Le Contrat sera régi et interprété selon le droit français. Les difficultés et réclamations qui pourraient survenir dans le cadre de la présente Lettre de Mission seront traitées par le service relation Client du Cabinet HAYOT EXPERTISE. Faute de parvenir à un accord amiable, tous les litiges auxquels le Contrat pourra donner lieu seront soumis au tribunal de commerce de Paris.',
  },
];

// ─── ANNEXE RGPD ──────────────────────────────────────────────────────────────

export const ANNEXE_RGPD: { id: number; article: string; content: string }[] = [
  {
    id: 0,
    article: 'Préambule',
    content:
      'Les parties s\'assurent du respect de la législation applicable en matière de protection des données personnelles, conformément au règlement (UE) 2016/679 du Parlement européen et du Conseil du 27 avril 2016 (dit « RGPD ») et la loi n°78-17 du 6 janvier 1978 relative à l\'informatique, aux fichiers et aux libertés, modifiée.',
  },
  {
    id: 1,
    article: '1. Responsabilité du traitement',
    content:
      'Dans le cadre des présentes, il est expressément convenu que le Client est le responsable de traitement au sens du RGPD, et que le Cabinet est le Sous-Traitant au sens du RGPD.',
  },
  {
    id: 2,
    article: '2. Conformité à la législation sur les données personnelles',
    content:
      'Chacune des parties doit se conformer à la Législation sur les Données Personnelles.',
  },
  {
    id: 3,
    article: '3. Obligations du responsable de traitement',
    content:
      'Le Responsable de Traitement garantit que toutes les données personnelles fournies au Sous-Traitant dans le cadre du Contrat sont conformes à la Législation sur les Données Personnelles.',
  },
  {
    id: 4,
    article: '4. Instructions au sous-traitant',
    content:
      'Le Sous-Traitant traite des données personnelles pour le compte du Responsable de Traitement. En conséquence, le Sous-Traitant devra traiter les données personnelles uniquement sur et conformément aux instructions documentées du Responsable de Traitement.',
  },
  {
    id: 5,
    article: '5. Détails du traitement',
    content:
      'Le traitement de données personnelles accompli par le Sous-Traitant est détaillé en appendice 1 de la présente annexe.',
  },
  {
    id: 6,
    article: '6. Mesures techniques et organisationnelles',
    content:
      'Le Sous-Traitant fournit des garanties suffisantes pour mettre en œuvre des mesures techniques et organisationnelles appropriées de manière à ce que le traitement réponde aux exigences de la Législation sur les Données Personnelles et garantisse la protection des droits de la personne concernée.',
  },
  {
    id: 7,
    article: '7. Sous-traitants de second rang',
    content:
      'Dans le cadre de l\'exécution du Contrat, le Responsable de Traitement pourra autoriser le Sous-Traitant à engager, en tant que de besoin, des sous-traitants. Le Responsable de Traitement autorise d\'ores et déjà le Sous-Traitant à recourir à la société REV, SAS immatriculée au RCS de Cherbourg sous le numéro 880 265 921, à titre de Sous-Traitant de Second Rang (REV recourant elle-même aux sociétés Budget Insight, Fintecture, Amazon Web Services EMEA SARL, Heroku Inc et Klippa App B.V. à titre de Sous-Traitants de Troisième Rang).',
  },
  {
    id: 8,
    article: '8. Personnel',
    content:
      'Le Sous-Traitant s\'engage à ce que les personnes autorisées à traiter les données personnelles soient liées par un accord de confidentialité.',
  },
  {
    id: 9,
    article: '9. Droit des personnes concernées',
    content:
      'Aux fins des présentes le terme « Requête d\'une Personne Concernée » désigne une demande faite par une personne concernée en vue d\'exercer ses droits reconnus par la Législation sur les Données Personnelles.',
  },
  {
    id: 10,
    article: '10. Assistance à la conformité du responsable de traitement',
    content:
      'Sans préjudice de l\'article 2, le Sous-Traitant doit fournir une assistance raisonnable au Responsable de Traitement pour lui permettre de satisfaire à ses obligations au titre de la Législation sur les Données Personnelles.',
  },
  {
    id: 11,
    article: '11. Transfert de données personnelles en dehors de l\'espace économique européen',
    content:
      'Le Sous-Traitant s\'engage à ne pas divulguer ni transférer les données à caractère personnel à un responsable de traitement ou un sous-traitant localisé dans un pays non-membre de l\'UE sans l\'accord préalable et écrit du Responsable de Traitement.',
  },
  {
    id: 12,
    article: '12. Registre des activités de traitement',
    content:
      'Le Sous-Traitant devra tenir un registre des activités de traitements effectués pour le compte du Responsable de Traitement, conformément aux exigences de l\'article 30 du RGPD.',
  },
  {
    id: 13,
    article: '13. Conformité, information et audit',
    content:
      'Le Sous-Traitant doit mettre à la disposition du Responsable de Traitement les informations raisonnablement nécessaires pour démontrer sa conformité aux obligations prévues dans la présente annexe, et permettre la réalisation d\'audits, y compris des inspections, par le Responsable de Traitement ou un autre auditeur mandaté par ce dernier.',
  },
  {
    id: 14,
    article: '14. Notification de violation',
    content:
      'En cas de violation de données personnelles liée aux services objet du Contrat impliquant le Sous-Traitant, le Sous-Traitant doit en informer sans délai le Responsable de Traitement et lui fournir toute information utile à la gestion de l\'incident.',
  },
  {
    id: 15,
    article: '15. Effacement ou restitution des données personnelles',
    content:
      'Le Sous-Traitant doit, à la demande écrite du Responsable de Traitement, soit supprimer, soit restituer les données personnelles au terme des services ou à la résiliation du Contrat.',
  },
  {
    id: 16,
    article: '16. Responsabilité',
    content:
      'Le Responsable de Traitement indemnisera le Sous-Traitant pour tout dommage résultant de ou en relation avec toute non-conformité par le Responsable de Traitement à ses obligations au titre de la présente annexe ou de la Législation sur les Données Personnelles.',
  },
  {
    id: 17,
    article: 'Appendice 1 : Détails du traitement',
    content:
      'Finalité du traitement : réalisation de la Mission. Durée : durée du Contrat, conservation pour la durée de la prescription civile. Nature : saisie, hébergement, transfert. Type de données : données comptables et financières. Catégorie de personnes concernées : clients, fournisseurs et personnel du Client.',
  },
];

// ─── LDM STANDARD (BNC / BIC / IS) ───────────────────────────────────────────

export const LDM_STANDARD = {
  introduction:
    'Cher(e) {{civilite}} {{nom_dirigeant}},\n\nVous avez bien voulu nous consulter en qualité d\'expert-comptable pour vous assister dans la gestion de votre entreprise. Nous souhaitons tout particulièrement vous remercier de votre marque de confiance. Nous avons établi la présente lettre de mission pour actualiser, d\'un commun accord, les conditions et l\'étendue de nos interventions eu égard aux spécificités de votre activité. La présente lettre de mission est un contrat établi afin de se conformer aux dispositions de l\'article 151 du code de déontologie intégré au décret du 30 mars 2012 relatif à l\'exercice de l\'activité d\'expertise comptable. Cette lettre de mission détaille notre périmètre d\'intervention, nos obligations mutuelles, ainsi que nos modalités d\'honoraires.',

  presentation_entreprise:
    'Votre entreprise, identifiée sous le numéro SIREN {{siret}}, est domiciliée au {{adresse_entreprise}}. Elle exerce à titre principal des activités de {{activite}}. Vous exercez votre activité sous la forme juridique de {{forme_juridique}}. Sur le plan fiscal, l\'entreprise relève du régime {{regime_fiscal}}. En matière de TVA, vous êtes assujetti au régime {{regime_tva}}. La date de clôture de votre exercice comptable est fixée au {{date_cloture}}. Nous utiliserons Pennylane pour le suivi comptable. Il conviendra d\'ajouter et de nous communiquer les notes de frais, IK, frais pro et l\'ensemble des écritures de trésorerie, encaissements, décaissements et espèces pour assurer un suivi exhaustif.',

  presentation_cabinet:
    'La mission que vous envisagez de nous confier sera effectuée dans le respect des dispositions de la norme professionnelle du Conseil Supérieur de l\'Ordre des Experts-Comptables. Conformément à l\'article L 123-14 du Code de commerce, les comptes annuels doivent être réguliers, sincères et donner une image fidèle. Vous restez ainsi responsables à l\'égard des tiers de l\'exhaustivité, de la fiabilité et de l\'exactitude des informations. HAYOT EXPERTISE est né de la volonté d\'apporter un accompagnement humain, réactif et personnalisé à chaque entrepreneur. Nous croyons qu\'un conseil de qualité repose avant tout sur l\'écoute, la transparence et la disponibilité.',

  missions: {
    comptabilite:
      'La mission de comptabilité comprend la création et le paramétrage d\'un plan comptable général adapté à votre activité, la saisie chronologique des opérations commerciales et financières, l\'enregistrement et le classement des écritures dans le grand livre, les rapprochements bancaires mensuels ainsi que l\'établissement des états de rapprochement. Vous bénéficierez également du suivi des comptes de tiers, de la révision et de l\'élaboration des comptes annuels (bilan, compte de résultat et annexe).',

    fiscal:
      'La mission fiscale inclut l\'établissement et le dépôt des déclarations de TVA, la préparation et la transmission de la liasse fiscale, ainsi que la gestion des acomptes et du solde d\'impôt. Nous prenons également en charge la déclaration de la CFE et de la CVAE, tout en vous conseillant pour optimiser légalement votre charge fiscale.',

    juridique:
      'La mission juridique fait l\'objet d\'une facturation à part. Nous vous accompagnons dans la préparation des assemblées générales, la rédaction des procès-verbaux d\'approbation des comptes et le dépôt au greffe.',

    social:
      'La mission sociale couvre l\'établissement des bulletins de paies ({{nombre_salaries}} salariés), la gestion des déclarations sociales nominatives mensuelles (DSN) et des formalités d\'embauche, ainsi que le suivi des cotisations sociales. Nous vous conseillons en droit du travail et protection sociale.',

    conseil:
      'La mission de conseil comprend l\'accompagnement stratégique de votre société dans ses choix de développement et d\'optimisation. Nous vous assistons dans l\'élaboration de budgets prévisionnels et de tableaux de bord. Notre expertise s\'étend au conseil en gestion financière. Cette mission transforme votre expert-comptable en véritable partenaire de votre développement.',

    suivi:
      'La mission de suivi client consiste à assurer un accompagnement personnalisé et régulier. Nous organisons des rendez-vous périodiques pour faire le point sur votre situation. Nous assurons une disponibilité permanente pour répondre à vos questions et vous conseiller sur les décisions importantes.',
  },

  honoraires:
    'Selon nos accords et échanges, nous mettons en place un forfait annuel de {{forfait_annuel}} € HT, soit {{total_mensuel_ht}} € HT par mois, payés par prélèvements. Ce forfait comprend les prestations validées dans votre proposition. Toute prestation hors forfait (ex : modifications statutaires, fiches de paies supplémentaires, formalités exceptionnelles) fera l\'objet d\'une facturation additionnelle selon notre grille tarifaire en vigueur.\n\nClause de révision : Les honoraires forfaitaires et tarifs unitaires sont révisés de plein droit au 1er janvier de chaque année en fonction de l\'évolution de l\'indice SYNTEC ou de l\'indice des prix à la consommation, sans qu\'un accord préalable et explicite du client ne soit requis pour l\'application de cette indexation.',

  duree:
    'La mission est conclue pour une durée d\'une année correspondant à l\'exercice comptable. La mission débute le {{date_debut_mission}}. La mission est renouvelable chaque année par tacite reconduction, sauf dénonciation par lettre recommandée avec accusé de réception trois mois avant la date de clôture de l\'exercice comptable.',
};

// ─── LDM IRPP (Impôt sur le Revenu des Particuliers) ─────────────────────────

export const LDM_IRPP = {
  objet: 'Établissement des déclarations fiscales des particuliers.',

  corps:
    'Madame, Monsieur,\n\nJe fais suite à notre entretien et vous confirme par la présente lettre de mission les conditions dans lesquelles notre cabinet vous assistera dans l\'établissement de vos déclarations personnelles d\'impôt sur le revenu. Cette déclaration sera établie sur la seule base des informations et documents que vous nous aurez communiqués au minimum 15 jours avant la date limite de dépôt. La mission que vous nous confiez sera effectuée dans le respect des dispositions légales et réglementaires applicables aux experts-comptables et s\'inscrit parmi les autres prestations sans assurance à l\'issue desquelles l\'expert-comptable n\'exprime pas d\'opinion.',

  limites:
    'Cette mission est limitée à l\'établissement des déclarations personnelles et ne concerne pas le recouvrement de l\'impôt, ce qui exclut toute gestion du prélèvement à la source. Nous ne contrôlerons pas l\'exhaustivité, l\'exactitude et la régularité des informations communiquées, ni ne procéderons à une évaluation des biens composant votre patrimoine immobilier. Vous nous autorisez par la présente à adresser à l\'administration fiscale les déclarations qui auront été établies dans le cadre de la présente mission.',

  honoraires:
    'Nos honoraires pour l\'intégralité de la déclaration des revenus sont fixés à {{total_honoraires_irpp}} € HT. Ils seront payés à réception de la facture ou par prélèvement.\n\nClause de révision : Les honoraires forfaitaires sont révisés de plein droit au 1er janvier de chaque année en fonction de l\'évolution de l\'indice SYNTEC ou de l\'indice des prix à la consommation, sans qu\'un accord préalable et explicite du client ne soit requis pour l\'application de cette indexation.\n\nLes parties, après en avoir discuté, sont convenues de n\'apporter aucune dérogation aux conditions générales.',
};
