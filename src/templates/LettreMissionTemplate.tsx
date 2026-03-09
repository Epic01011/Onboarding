// ============================================================
// LETTRE DE MISSION — Template React avec export PDF/DOCX
// Cabinet HAYOT EXPERTISE - Version 3.0
// Nouveauté v3 : sélecteur de modèle (BNC/IRPP/Social/Avenant)
//               + clauses dynamiques par type de mission
// ============================================================

import React from 'react';
import { CGV } from '../data/cgv';
import { MISSION_TEMPLATES, MissionTemplate } from '../data/missionTemplates';

export interface LettreMissionData {
  // Informations client
  clientNom: string;
  clientFormeJuridique: string;
  clientSiret: string;
  clientAdresse: string;
  clientRepresentant: string;
  clientQualite: string;
  // Informations mission
  typeMission: string;
  missionTemplateId?: string;    // id du modèle sélectionné
  dateDebut: string;
  // Grille tarifaire complète (HT/mois ou HT/an selon catégorie)
  tarifComptabilite?: number; // HT/mois
  tarifConseil?: number; // HT/heure
  tarifFiscal?: number; // HT/an
  tarifJuridique?: number; // HT/an
  tarifSocial?: number; // HT/mois
  tarifSuiviClient?: number; // HT/mois
  // Options
  assuranceRCPro?: boolean;
  // Métadonnées
  dateSignature: string;
  numeroLdM: string;
  ville: string;
  delaiPrevisRevision?: number; // En jours (par défaut 30)
}

interface LettreMissionTemplateProps {
  data: LettreMissionData;
  showCGV?: boolean;
  printMode?: boolean;
}

// Labels lisibles pour chaque sous-section de mission
const SECTION_LABELS: Record<string, string> = {
  comptabilite: 'Comptabilité',
  conseil: 'Conseil & Gestion',
  fiscal: 'Fiscal',
  juridique: 'Juridique',
  social: 'Social & RH',
  suiviClient: 'Suivi Client',
  specifique: 'Dispositions spécifiques',
};

/**
 * Composant principal de la Lettre de Mission.
 * v3.0 : modèles BNC / IRPP / Social / Avenant / Standard
 * Compatible export PDF (window.print) et DOCX.
 */
export const LettreMissionTemplate: React.FC<LettreMissionTemplateProps> = ({
  data,
  showCGV = true,
  printMode = false,
}) => {
  const baseClass = printMode
    ? 'font-serif text-sm text-gray-900'
    : 'font-sans text-sm text-gray-900 max-w-4xl mx-auto';

  const delaiPreavis = data.delaiPrevisRevision || 30;
  const tvaTaux = 0.2;

  // Calcul du total HT
  const totalHT =
    (data.tarifComptabilite || 0) +
    (data.tarifSocial || 0) +
    (data.tarifSuiviClient || 0);
  const totalTTC = totalHT * (1 + tvaTaux);

  // Récupération du modèle sélectionné (si applicable)
  const selectedTemplate: MissionTemplate | undefined = data.missionTemplateId
    ? MISSION_TEMPLATES.find((t) => t.id === data.missionTemplateId)
    : undefined;

  return (
    <div className={baseClass} id="lettre-mission-document">
      {/* ========== EN-TÊTE CABINET ========== */}
      <header className="flex items-start justify-between mb-10 pb-6 border-b-2 border-blue-800">
        <div>
          <h1 className="text-2xl font-bold text-blue-900 tracking-wide uppercase">
            HAYOT EXPERTISE
          </h1>
          <p className="text-xs text-gray-500 mt-1">Expert-Comptable • Commissaire aux Comptes</p>
          <p className="text-xs text-gray-500">Cabinet inscrit à l'Ordre des Experts-Comptables</p>
        </div>
        <div className="text-right text-xs text-gray-600">
          <p className="font-semibold">N° LdM : {data.numeroLdM}</p>
          <p>{data.ville}, le {data.dateSignature}</p>
          {selectedTemplate && (
            <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded ${selectedTemplate.badgeColor}`}>
              {selectedTemplate.label}
            </span>
          )}
        </div>
      </header>

      {/* ========== TITRE ========== */}
      <section className="text-center mb-10">
        <h2 className="text-xl font-bold text-blue-900 border border-blue-800 inline-block px-8 py-2 uppercase tracking-widest">
          LETTRE DE MISSION
        </h2>
        {selectedTemplate && (
          <p className="text-xs text-gray-500 mt-2 italic">{selectedTemplate.description}</p>
        )}
      </section>

      {/* ========== PARTIES CABINET & CLIENT ========== */}
      <section className="mb-8 grid grid-cols-2 gap-8">
        <div className="bg-blue-50 rounded-lg p-5 border border-blue-100">
          <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-3">LE CABINET</h3>
          <p className="font-semibold">HAYOT EXPERTISE</p>
          <p className="text-xs text-gray-600">Expert-Comptable</p>
          <p className="text-xs text-gray-600">58 rue de Monceau, 75008 Paris</p>
          <p className="text-xs text-gray-600">SIREN : 942 525 098</p>
          <p className="text-xs text-gray-600">Assuré par <strong>Verspieren</strong></p>
        </div>
        <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">LE CLIENT</h3>
          <p className="font-semibold">{data.clientNom}</p>
          <p className="text-xs text-gray-600">{data.clientFormeJuridique}</p>
          <p className="text-xs text-gray-600">SIRET : {data.clientSiret}</p>
          <p className="text-xs text-gray-600">{data.clientAdresse}</p>
          <p className="text-xs text-gray-600">
            Représenté par {data.clientRepresentant}, {data.clientQualite}
          </p>
        </div>
      </section>

      {/* ========== ARTICLE 1 — OBJET DE LA MISSION ========== */}
      <section className="mb-6">
        <h3 className="text-sm font-bold text-blue-900 bg-blue-50 px-4 py-2 rounded mb-3 uppercase tracking-wide border-l-4 border-blue-700">
          Article 1 — Objet de la Mission
        </h3>
        <div className="px-2 space-y-3">
          {/* Clauses objet depuis le modèle sélectionné OU texte par défaut */}
          {selectedTemplate ? (
            selectedTemplate.clauses.objetMission.map((para, i) => (
              <p key={i} className="text-justify leading-relaxed">{para}</p>
            ))
          ) : (
            <>
              <p className="text-justify leading-relaxed">
                Le Cabinet est chargé d'une mission de <strong>{data.typeMission}</strong>.
                Cette mission prend effet à compter du <strong>{data.dateDebut}</strong>.
              </p>
              <p className="text-justify leading-relaxed">
                La présente mission correspond à une <strong>obligation de moyens et non de résultat</strong>. Elle est réalisée conformément aux normes professionnelles de l'Ordre des Experts-Comptables et au Code de déontologie.
              </p>
            </>
          )}

          <p className="text-justify leading-relaxed">
            La mission <strong>{data.typeMission}</strong> prend effet à compter du <strong>{data.dateDebut}</strong>.
          </p>

          {/* Présentation Cabinet */}
          <div className="bg-blue-50 border-l-4 border-blue-700 p-4 my-4">
            <h4 className="text-xs font-bold text-blue-800 mb-2 uppercase">Qui sommes-nous ?</h4>
            <ul className="text-xs text-gray-700 space-y-2">
              <li>✓ <strong>Un cabinet humain :</strong> Vos enjeux sont nos enjeux. Nous construisons des relations de confiance durables.</li>
              <li>✓ <strong>Un cabinet réactif :</strong> Disponibilité et écoute permanente pour répondre à vos besoins spécifiques.</li>
              <li>✓ <strong>Un cabinet digitalisé :</strong> Intégration complète avec Pennylane pour une comptabilité modernisée et automatisée.</li>
              <li>✓ <strong>Une expertise reconnue :</strong> Respect des normes professionnelles de l'Ordre des Experts-Comptables.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ========== ARTICLE 2 — DESCRIPTION DES MISSIONS ========== */}
      {selectedTemplate && (
        <section className="mb-6">
          <h3 className="text-sm font-bold text-blue-900 bg-blue-50 px-4 py-2 rounded mb-3 uppercase tracking-wide border-l-4 border-blue-700">
            Article 2 — Description des Missions
          </h3>
          <div className="px-2 space-y-4">
            {Object.entries(selectedTemplate.clauses.descriptionMissions).map(([key, lines]) =>
              lines && lines.length > 0 ? (
                <div key={key}>
                  <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-2">
                    {SECTION_LABELS[key] || key}
                  </h4>
                  <ul className="list-none space-y-1">
                    {lines.map((line, i) => (
                      <li key={i} className="text-xs text-gray-700 leading-relaxed flex gap-2">
                        <span className="text-blue-400 mt-0.5">›</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null
            )}
          </div>
        </section>
      )}

      {/* ========== ARTICLE 3 (ou 2 si pas de modèle) — DURÉE & RÉSILIATION ========== */}
      <section className="mb-6">
        <h3 className="text-sm font-bold text-blue-900 bg-blue-50 px-4 py-2 rounded mb-3 uppercase tracking-wide border-l-4 border-blue-700">
          {selectedTemplate ? 'Article 3' : 'Article 2'} — Durée et Résiliation
        </h3>
        <div className="px-2 space-y-2">
          {selectedTemplate ? (
            selectedTemplate.clauses.duree.map((para, i) => (
              <p key={i} className="text-justify leading-relaxed">{para}</p>
            ))
          ) : (
            <p className="text-justify leading-relaxed">
              Le présent contrat est conclu pour une durée indéterminée à compter de sa signature. Chacune des parties peut y mettre fin par lettre recommandée avec accusé de réception, sous réserve du respect d'un préavis de trois (3) mois, sauf faute grave.
            </p>
          )}
        </div>
      </section>

      {/* ========== ARTICLE 4 (ou 3) — GRILLE TARIFAIRE ========== */}
      <section className="mb-6">
        <h3 className="text-sm font-bold text-blue-900 bg-blue-50 px-4 py-2 rounded mb-3 uppercase tracking-wide border-l-4 border-blue-700">
          {selectedTemplate ? 'Article 4' : 'Article 3'} — Honoraires et Facturation
        </h3>
        <div className="px-2">
          {/* Clauses honoraires du modèle */}
          {selectedTemplate && (
            <div className="mb-4 space-y-2">
              {selectedTemplate.clauses.honoraires.map((para, i) => (
                <p key={i} className="text-xs text-gray-700 leading-relaxed">{para}</p>
              ))}
            </div>
          )}

          <p className="mb-4 font-semibold text-blue-900">
            Les honoraires ci-dessous sont convenus d'un commun accord. Ils s'entendent <strong>hors TVA</strong> (20 %).
          </p>

          {/* Grille tarifaire */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 space-y-3">
            {data.tarifComptabilite && (
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-xs font-semibold">Comptabilité Générale</span>
                <span className="text-xs text-blue-900 font-bold">
                  {data.tarifComptabilite.toLocaleString('fr-FR')} € HT/mois
                </span>
              </div>
            )}
            {data.tarifConseil && (
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-xs font-semibold">Conseil & Optimisation</span>
                <span className="text-xs text-blue-900 font-bold">
                  {data.tarifConseil.toLocaleString('fr-FR')} € HT/heure
                </span>
              </div>
            )}
            {data.tarifFiscal && (
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-xs font-semibold">Déclaration Fiscale (IR/IS)</span>
                <span className="text-xs text-blue-900 font-bold">
                  {data.tarifFiscal.toLocaleString('fr-FR')} € HT/an
                </span>
              </div>
            )}
            {data.tarifJuridique && (
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-xs font-semibold">Conseils Juridiques</span>
                <span className="text-xs text-blue-900 font-bold">
                  {data.tarifJuridique.toLocaleString('fr-FR')} € HT/an
                </span>
              </div>
            )}
            {data.tarifSocial && (
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-xs font-semibold">Paie & Social</span>
                <span className="text-xs text-blue-900 font-bold">
                  {data.tarifSocial.toLocaleString('fr-FR')} € HT/mois
                </span>
              </div>
            )}
            {data.tarifSuiviClient && (
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-xs font-semibold">Suivi Client & Support</span>
                <span className="text-xs text-blue-900 font-bold">
                  {data.tarifSuiviClient.toLocaleString('fr-FR')} € HT/mois
                </span>
              </div>
            )}

            {/* TOTAL */}
            {totalHT > 0 && (
              <div className="pt-2 border-t-2 border-blue-800 flex justify-between items-center">
                <div>
                  <p className="text-xs text-gray-600">Sous-total HT :</p>
                  <p className="text-xs text-gray-600">TVA (20 %) :</p>
                  <p className="text-xs font-bold text-blue-900">Total TTC :</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-blue-900">{totalHT.toLocaleString('fr-FR')} € HT</p>
                  <p className="text-xs font-bold text-blue-900">{(totalHT * tvaTaux).toLocaleString('fr-FR')} €</p>
                  <p className="text-sm font-bold text-blue-900 bg-yellow-100 px-2 py-1 rounded">
                    {totalTTC.toLocaleString('fr-FR')} € TTC
                  </p>
                </div>
              </div>
            )}
          </div>

          <p className="mt-3 text-xs text-gray-600 bg-yellow-50 border border-yellow-200 p-2 rounded">
            <strong>Facturation :</strong> Début de mois • Règlement par prélèvement automatique • Pénalités de retard : 3× taux légal + 40 € • Aucun escompte accordé
          </p>
        </div>
      </section>

      {/* ========== ARTICLE 5 — COUVERTURE ASSURANTIELLE ========== */}
      <section className="mb-6">
        <h3 className="text-sm font-bold text-blue-900 bg-blue-50 px-4 py-2 rounded mb-3 uppercase tracking-wide border-l-4 border-blue-700">
          {selectedTemplate ? 'Article 5' : 'Article 4'} — Couverture Assurantielle
        </h3>
        <div className="px-2">
          <p className="mb-3 text-justify leading-relaxed">
            Le Cabinet est assuré en responsabilité civile professionnelle par <strong>Verspieren</strong> pour couvrir l'ensemble de ses interventions.
          </p>
          <div className="bg-amber-50 border border-amber-200 p-4 rounded">
            <p className="text-xs mb-2"><strong>Assureur :</strong> Verspieren</p>
            <p className="text-xs mb-2"><strong>Couverture :</strong> Honoraires d'assistance en cas de contrôle fiscal ou social</p>
            <p className="text-xs mb-2"><strong>Extension optionnelle :</strong> Assurance complémentaire couvrant nos honoraires d'assistance et, le cas échéant, les honoraires d'un avocat lors d'un contentieux fiscal ou social.</p>
            <p className="text-xs"><strong>Délai de couverture (run-off) :</strong> 1 an après résiliation de la mission</p>
          </div>
        </div>
      </section>

      {/* ========== ARTICLE 6 — OBLIGATIONS LCB-FT ========== */}
      <section className="mb-6">
        <h3 className="text-sm font-bold text-blue-900 bg-blue-50 px-4 py-2 rounded mb-3 uppercase tracking-wide border-l-4 border-blue-700">
          {selectedTemplate ? 'Article 6' : 'Article 5'} — Obligations d'Identification (LCB-FT)
        </h3>
        <div className="px-2 space-y-2">
          {selectedTemplate ? (
            selectedTemplate.clauses.identification.map((para, i) => (
              <p key={i} className="text-xs text-justify leading-relaxed">{para}</p>
            ))
          ) : (
            <p className="text-xs text-justify leading-relaxed">
              Dans le cadre des obligations LCB-FT (articles L. 561-1 et suivants du Code monétaire et financier), le Client fournit avant démarrage les éléments d'identification et de bénéficiaire effectif. Leur obtention constitue une condition suspensive de mise en œuvre de la mission.
            </p>
          )}
        </div>
      </section>

      {/* ========== ARTICLE 7 — RÉVISION DES TARIFS ========== */}
      <section className="mb-6">
        <h3 className="text-sm font-bold text-blue-900 bg-blue-50 px-4 py-2 rounded mb-3 uppercase tracking-wide border-l-4 border-blue-700">
          {selectedTemplate ? 'Article 7' : 'Article 6'} — Révision des Tarifs
        </h3>
        <div className="px-2 bg-blue-50 border-l-4 border-blue-700 p-3 rounded">
          <p className="text-xs text-justify leading-relaxed">
            Toute révision de tarif sera notifiée par écrit au client avec un préavis de <strong>{delaiPreavis} jours</strong> avant sa prise d'effet.
          </p>
        </div>
      </section>

      {/* ========== ARTICLE 8 — CONDITIONS GÉNÉRALES ========== */}
      <section className="mb-6">
        <h3 className="text-sm font-bold text-blue-900 bg-blue-50 px-4 py-2 rounded mb-3 uppercase tracking-wide border-l-4 border-blue-700">
          {selectedTemplate ? 'Article 8' : 'Article 7'} — Conditions Générales
        </h3>
        <p className="px-2 text-justify leading-relaxed text-xs">
          La présente Lettre de Mission est complétée par nos <strong>Conditions Générales de Vente (CGV)</strong>, annexées au présent document. En signant, le client reconnaît avoir lu et accepté ces conditions dans leur intégrité.
        </p>
        <p className="px-2 mt-2 text-xs font-semibold text-blue-900">
          ⟹ En cas de contradiction entre la Lettre de Mission et les CGV, la Lettre de Mission prévaut.
        </p>
      </section>

      {/* ========== SIGNATURES ========== */}
      <section className="mb-10 mt-16">
        <h3 className="text-sm font-bold text-gray-700 mb-8 uppercase tracking-wide">
          Signatures — Bon pour accord
        </h3>
        <div className="grid grid-cols-2 gap-16">
          <div>
            <p className="text-xs text-gray-600 font-semibold mb-6">Pour le Cabinet HAYOT EXPERTISE</p>
            <div className="border-b-2 border-gray-800 h-20 mb-4" />
            <p className="text-xs text-gray-600 mb-1">L'Expert-Comptable</p>
            <p className="text-xs text-gray-500">Signature et tampon</p>
            <div className="mt-6 border-t border-gray-300 pt-2">
              <p className="text-xs text-gray-500">Date : ___________________</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-600 font-semibold mb-6">Pour {data.clientNom}</p>
            <div className="border-b-2 border-gray-800 h-20 mb-4" />
            <p className="text-xs text-gray-600 mb-1">{data.clientRepresentant}, {data.clientQualite}</p>
            <p className="text-xs text-gray-500">Signature</p>
            <div className="mt-6 border-t border-gray-300 pt-2">
              <p className="text-xs text-gray-500">Date : ___________________</p>
              <p className="text-xs text-gray-400 mt-2 italic">Mention manuscrite : « Lu et approuvé »</p>
            </div>
          </div>
        </div>
      </section>

      {/* ========== ANNEXE CGV ========== */}
      {showCGV && (
        <section className="mt-16 pt-8 border-t-4 border-blue-800">
          <div className="text-center mb-8">
            <span className="bg-blue-800 text-white text-xs font-bold uppercase tracking-widest px-6 py-2 rounded">
              ANNEXE — CONDITIONS GÉNÉRALES
            </span>
            <p className="text-xs text-gray-500 mt-2">
              Version {CGV.version} — {CGV.dateMAJ} — {CGV.cabinet}
            </p>
          </div>
          {CGV.articles.map((article) => (
            <div key={article.id} className="mb-5">
              <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-2">
                {article.id}. {article.titre}
              </h4>
              {article.contenu.map((paragraphe, idx) => (
                <p key={idx} className="text-xs text-gray-700 leading-relaxed mb-2 text-justify">
                  {paragraphe}
                </p>
              ))}
            </div>
          ))}
          <div className="mt-8 pt-4 border-t border-gray-200 text-xs text-gray-500 text-center">
            <p>Les présentes CGV constituent l'annexe intégrante de la Lettre de Mission N° {data.numeroLdM}.</p>
            <p>En cas de contradiction, la Lettre de Mission prévaut.</p>
          </div>
        </section>
      )}
    </div>
  );
};

// ============================================================
// EXPORT PDF
// ============================================================
export const exportToPDF = (elementId: string = 'lettre-mission-document'): void => {
  const element = document.getElementById(elementId);
  if (!element) return;
  const printContent = element.innerHTML;
  const originalBody = document.body.innerHTML;
  document.body.innerHTML = `<html><head><style>body{font-family:'Georgia',serif;font-size:11pt;color:#1a1a1a;}@page{margin:2cm;size:A4;}@media print{.no-print{display:none!important;}}</style></head><body>${printContent}</body></html>`;
  window.print();
  document.body.innerHTML = originalBody;
  window.location.reload();
};

// ============================================================
// EXPORT DOCX
// ============================================================
export const exportToDocx = async (
  data: LettreMissionData,
  elementId: string = 'lettre-mission-document'
): Promise<void> => {
  try {
    const element = document.getElementById(elementId);
    if (!element) return;
    const htmlContent = element.innerHTML;
    const docxContent = `<!DOCTYPE html><html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'><head><meta charset='utf-8'><title>Lettre de Mission - ${data.clientNom}</title><style>body{font-family:Arial,sans-serif;font-size:11pt;color:#1a1a1a;margin:2cm;line-height:1.5;}h1{font-size:18pt;color:#003d7a;font-weight:bold;}h2{font-size:14pt;color:#003d7a;text-align:center;border:1pt solid #003d7a;padding:6pt;}h3{font-size:11pt;color:#003d7a;background:#eef2ff;padding:6pt;border-left:4pt solid #003d7a;}p{font-size:11pt;margin:6pt 0;text-align:justify;}table{width:100%;border-collapse:collapse;margin:10pt 0;}td,th{border:1pt solid #ddd;padding:6pt;font-size:10pt;}th{background:#f0f4ff;font-weight:bold;color:#003d7a;}</style></head><body>${htmlContent}</body></html>`;
    const blob = new Blob([docxContent], { type: 'application/msword' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Lettre-de-Mission-${data.numeroLdM}-${data.clientNom.replace(/\s+/g, '-')}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Erreur export DOCX:', error);
  }
};

export default LettreMissionTemplate;
