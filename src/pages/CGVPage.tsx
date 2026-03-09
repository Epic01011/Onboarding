// ============================================================
// PAGE CGV — HAYOT EXPERTISE
// Rendu visuel professionnel avec navigation par article
// ============================================================

import React, { useState } from 'react';
import { CGV, ArticleCGV } from '../data/cgv';

// Icônes SVG inline (sans dépendance externe)
const IconScale = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M3 6l9-3 9 3M3 6v12l9 3 9-3V6M12 3v18" />
  </svg>
);

const IconChevron = ({ open }: { open: boolean }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`}
    fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const IconDownload = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

// Badge coloré par catégorie d'article
const ARTICLE_COLORS: Record<number, string> = {
  1: 'bg-blue-100 text-blue-800',
  2: 'bg-blue-100 text-blue-800',
  3: 'bg-indigo-100 text-indigo-800',
  4: 'bg-indigo-100 text-indigo-800',
  5: 'bg-violet-100 text-violet-800',
  6: 'bg-violet-100 text-violet-800',
  7: 'bg-emerald-100 text-emerald-800',
  8: 'bg-amber-100 text-amber-800',
  9: 'bg-red-100 text-red-800',
  10: 'bg-orange-100 text-orange-800',
  11: 'bg-teal-100 text-teal-800',
  12: 'bg-sky-100 text-sky-800',
  13: 'bg-gray-100 text-gray-700',
  14: 'bg-gray-100 text-gray-700',
  15: 'bg-gray-100 text-gray-700',
  16: 'bg-slate-100 text-slate-800',
};

const ArticleAccordion: React.FC<{ article: ArticleCGV }> = ({ article }) => {
  const [open, setOpen] = useState(false);
  const colorClass = ARTICLE_COLORS[article.id] || 'bg-gray-100 text-gray-700';

  return (
    <div className="border border-gray-200 rounded-xl mb-3 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left bg-white hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${colorClass}`}>
            Art. {article.id}
          </span>
          <span className="font-semibold text-gray-800 text-sm">{article.titre}</span>
        </div>
        <IconChevron open={open} />
      </button>

      {open && (
        <div className="px-5 py-4 bg-gray-50 border-t border-gray-100">
          {article.contenu.map((paragraphe, idx) => (
            <p key={idx} className="text-sm text-gray-700 leading-relaxed mb-3 last:mb-0 text-justify">
              {paragraphe}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Page principale des CGV
 */
const CGVPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandAll, setExpandAll] = useState(false);

  const filteredArticles = CGV.articles.filter(
    (article) =>
      article.titre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.contenu.some((p) =>
        p.toLowerCase().includes(searchTerm.toLowerCase())
      )
  );

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* ===== HERO HEADER ===== */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-800 text-white">
        <div className="max-w-5xl mx-auto px-6 py-12">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-white/20 rounded-lg p-2">
                  <IconScale />
                </div>
                <span className="text-blue-200 text-sm font-medium uppercase tracking-widest">
                  {CGV.cabinet}
                </span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">
                Conditions Générales
              </h1>
              <p className="text-blue-200 text-sm">
                Applicables à toutes les missions d'expertise comptable
              </p>
            </div>
            <div className="text-right">
              <div className="bg-white/10 rounded-xl px-5 py-4 backdrop-blur-sm">
                <p className="text-xs text-blue-200 uppercase tracking-wide">Version</p>
                <p className="text-2xl font-bold">{CGV.version}</p>
                <p className="text-xs text-blue-300">{CGV.dateMAJ}</p>
              </div>
            </div>
          </div>

          {/* Stats rapides */}
          <div className="grid grid-cols-3 gap-4 mt-8">
            {[
              { label: 'Articles', value: CGV.articles.length },
              { label: 'Logiciel', value: CGV.logiciel },
              { label: 'Tribunal compétent', value: 'Paris' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/10 rounded-lg px-4 py-3 backdrop-blur-sm">
                <p className="text-xs text-blue-300 uppercase tracking-wide">{stat.label}</p>
                <p className="font-semibold text-sm mt-0.5">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== CONTENT ===== */}
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Barre d'actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              placeholder="Rechercher dans les CGV..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
            />
            <svg className="absolute left-3 top-3 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setExpandAll(!expandAll)}
              className="text-sm text-blue-700 hover:text-blue-900 font-medium px-4 py-2.5 border border-blue-300 rounded-xl hover:bg-blue-50 transition-colors"
            >
              {expandAll ? 'Tout réduire' : 'Tout développer'}
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 text-sm text-white bg-blue-800 hover:bg-blue-900 font-medium px-4 py-2.5 rounded-xl transition-colors shadow-sm no-print"
            >
              <IconDownload />
              Exporter PDF
            </button>
          </div>
        </div>

        {/* Avertissement légal */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-8 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm text-amber-800">
            <strong>Document contractuel.</strong>{' '}
            Les présentes CGV sont annexées de plein droit à toute Lettre de Mission
            signée avec le Cabinet {CGV.cabinet}. En signant la lettre de mission, le
            client reconnaît les avoir lues et acceptées dans leur intégralité.
          </p>
        </div>

        {/* Articles */}
        {searchTerm && filteredArticles.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">Aucun article ne correspond à votre recherche.</p>
          </div>
        ) : (
          <div>
            {(searchTerm ? filteredArticles : CGV.articles).map((article) => (
              <ArticleAccordionControlled
                key={article.id}
                article={article}
                forceOpen={expandAll}
              />
            ))}
          </div>
        )}

        {/* Footer CGV */}
        <footer className="mt-12 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-gray-500">
            <div>
              <p className="font-semibold text-gray-700 mb-1">Assurance RCP</p>
              <p>{CGV.assureur} — Couverture France</p>
            </div>
            <div>
              <p className="font-semibold text-gray-700 mb-1">Juridiction</p>
              <p>{CGV.tribunal}</p>
            </div>
            <div>
              <p className="font-semibold text-gray-700 mb-1">Logiciel</p>
              <p>{CGV.logiciel} (REV SAS — RCS Cherbourg n° 880 265 921)</p>
            </div>
          </div>
          <p className="text-center text-xs text-gray-400 mt-6">
            © {new Date().getFullYear()} {CGV.cabinet} — Tous droits réservés —
            Version {CGV.version} en vigueur depuis {CGV.dateMAJ}
          </p>
        </footer>
      </div>
    </div>
  );
};

// Version contrôlée de l'accordion (pour expand-all)
const ArticleAccordionControlled: React.FC<{
  article: ArticleCGV;
  forceOpen: boolean;
}> = ({ article, forceOpen }) => {
  const [localOpen, setLocalOpen] = useState(false);
  const isOpen = forceOpen || localOpen;
  const colorClass = ARTICLE_COLORS[article.id] || 'bg-gray-100 text-gray-700';

  return (
    <div className="border border-gray-200 rounded-xl mb-3 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left bg-white hover:bg-gray-50 transition-colors"
        onClick={() => setLocalOpen(!localOpen)}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${colorClass}`}>
            Art. {article.id}
          </span>
          <span className="font-semibold text-gray-800 text-sm">{article.titre}</span>
        </div>
        <IconChevron open={isOpen} />
      </button>

      {isOpen && (
        <div className="px-5 py-4 bg-gray-50 border-t border-gray-100">
          {article.contenu.map((paragraphe, idx) => (
            <p key={idx} className="text-sm text-gray-700 leading-relaxed mb-3 last:mb-0 text-justify">
              {paragraphe}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

export { ArticleAccordion };
export default CGVPage;
