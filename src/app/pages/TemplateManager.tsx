import { useState, useRef } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowLeft, Plus, Trash2, Edit3, Eye, Scale, PenLine,
  FileText, Save, CheckCircle2, AlertCircle, Copy, List, Upload,
  Download, Cog, Library, X, Menu, RotateCcw,
} from 'lucide-react';
import DOMPurify from 'dompurify';
import {
  LetterTemplate, createNewTemplate, buildLetterHtml, AVAILABLE_VARIABLES,
  substituteVariables, TemplateVariables,
} from '../utils/templateUtils';
import { getCabinetInfo } from '../utils/servicesStorage';
import { useTemplates } from '../hooks/useTemplates';

type ViewMode = 'list' | 'edit';

export function TemplateManager() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<LetterTemplate | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editName, setEditName] = useState('');
  // Track the last-persisted state so we can revert unsaved edits.
  const [savedContent, setSavedContent] = useState('');
  const [savedName, setSavedName] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [activeTab, setActiveTab] = useState<'edit' | 'preview' | 'variables'>('edit');
  const [savedMsg, setSavedMsg] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'confraternal' | 'mission' | 'mandat_creation'>('all');
  const [showMobileList, setShowMobileList] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<{ name: string; content: string } | null>(null);

  // ── Backend-synced templates ──────────────────────────────────────────────
  const { templates, saveTemplate, deleteTemplate, loading: _loading } = useTemplates();

  const cabinet = getCabinetInfo();

  const handleSelect = (t: LetterTemplate) => {
    setSelected(t);
    setEditContent(t.content);
    setEditName(t.name);
    setSavedContent(t.content);
    setSavedName(t.name);
    setViewMode('edit');
    setActiveTab('edit');
    setShowMobileList(false); // close sidebar on mobile after selection
  };

  const handleSave = async () => {
    if (!selected) return;
    const updated = { ...selected, name: editName, content: editContent };
    await saveTemplate(updated);
    setSelected(updated);
    setSavedContent(editContent);
    setSavedName(editName);
    setSavedMsg('Modèle sauvegardé !');
    setTimeout(() => setSavedMsg(''), 2500);
  };

  const handleRevert = () => {
    setEditContent(savedContent);
    setEditName(savedName);
  };

  const handleNew = async (type: 'confraternal' | 'mission' | 'mandat_creation') => {
    const t = createNewTemplate(type);
    await saveTemplate(t);
    handleSelect(t);
  };
  const handleDelete = async (t: LetterTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    if (t.isDefault) return;
    if (confirm(`Supprimer "${t.name}" ?`)) {
      await deleteTemplate(t.id);
      if (selected?.id === t.id) {
        setSelected(null);
        setViewMode('list');
      }
    }
  };

  const handleDuplicate = async (t: LetterTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    const dup = createNewTemplate(t.type);
    const newT = { ...dup, name: `Copie de ${t.name}`, content: t.content };
    await saveTemplate(newT);
    handleSelect(newT);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      if (!content) return;
      setPendingImport({ name: file.name.replace(/\.[^.]+$/, ''), content });
    };
    reader.onerror = () => {
      setSavedMsg('Erreur lors de la lecture du fichier');
      setTimeout(() => setSavedMsg(''), 2500);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const confirmImport = async (type: 'confraternal' | 'mission') => {
    if (!pendingImport) return;
    const base = createNewTemplate(type);
    const imported: LetterTemplate = {
      ...base,
      name: pendingImport.name,
      content: pendingImport.content,
    };
    await saveTemplate(imported);
    handleSelect(imported);
    setPendingImport(null);
    setSavedMsg('Modèle importé !');
    setTimeout(() => setSavedMsg(''), 2500);
  };

  const filtered = templates.filter(t => filterType === 'all' || t.type === filterType);

  // Pre-fill cabinet variables in preview
  const previewVars: Record<string, string> = {
    cabinet_nom: cabinet.nom,
    cabinet_adresse: cabinet.adresse,
    cabinet_code_postal: cabinet.codePostal,
    cabinet_ville: cabinet.ville,
    cabinet_siren: cabinet.siren,
    cabinet_numero_ordre: cabinet.numeroOrdre,
    cabinet_expert: cabinet.expertNom,
    cabinet_telephone: cabinet.telephone,
    cabinet_capital_social: cabinet.capitalSocial || '[Capital social]',
    client_genre: 'M.',
    client_prenom: 'Pierre',
    client_nom: 'Martin',
    client_raison_sociale: 'MARTIN SARL',
    client_siren: '987 654 321',
    client_email: 'contact@martin.fr',
    client_adresse: '5 rue Victor Hugo, 69001 Lyon',
    client_forme_juridique: 'SARL',
    client_activite: 'Commerce de détail',
    client_statut_dirigeant: 'de Gérant',
    confrere_email: 'confrere@ancien-cabinet.fr',
    confrere_nom: 'M. Jean Dupont',
    confrere_adresse: '10 avenue de la République, 75011 Paris',
    confrere_societe: 'DUPONT EXPERTISE COMPTABLE',
    date_courrier_confrere: '15 janvier 2025',
    montant_honoraires_dus: '2 500',
    missions_liste: '• Tenue de comptabilité et établissement des comptes annuels\n• Établissement des déclarations fiscales (TVA, IS)\n• Gestion de la paie',
    prix_annuel: '4 800',
    prix_mensuel: '400',
    taux_responsable: '130',
    date_du_jour: new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    date_effet: '1er janvier 2025',
    date_rapprochement: '31 décembre 2024',
    date_revision_annuelle: '1er janvier',
    indice_base_trimestre: 'T3',
    indice_base_annee: '2025',
    indice_base_valeur: '131,4',
    delai_preavis_revision: '30',
  };

  const previewContent = editContent ? substituteVariables(editContent, previewVars as TemplateVariables) : '';

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${editName}</title>
          <style>body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.6; margin: 2cm; color: #1a1a1a; } strong { font-weight: bold; } hr { border: none; border-top: 1px solid #ccc; margin: 16px 0; }</style>
        </head>
        <body>${buildLetterHtml(previewContent, previewVars)}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  /** Download the current template as an .html file */
  const handleExportHtml = () => {
    if (!selected) return;
    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${editName}</title>
  <style>
    body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.7; margin: 2cm; color: #1a1a1a; }
    strong { font-weight: bold; }
    hr { border: none; border-top: 1px solid #ccc; margin: 16px 0; }
  </style>
</head>
<body>
  <!-- Modèle brut — variables non substituées -->
  <pre style="font-family:inherit;white-space:pre-wrap;">${editContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
</body>
</html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${editName.replace(/\s+/g, '-').toLowerCase()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /** Download the current template as a .txt file */
  const handleExportTxt = () => {
    if (!selected) return;
    const blob = new Blob([editContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${editName.replace(/\s+/g, '-').toLowerCase()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /** Navigate to the LDM generator pre-selecting the current template */
  const handleUseInGenerator = () => {
    if (!selected) return;
    navigate('/lettre-mission');
  };

  const varCategories = ['Cabinet', 'Client', 'Reprise', 'Mission', 'Dates'];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Import type selection modal */}
      {pendingImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <p className="text-sm font-semibold text-gray-900 mb-1">Type de modèle à importer</p>
            <p className="text-xs text-gray-500 mb-4">Fichier : <span className="font-medium">{pendingImport.name}</span></p>
            <div className="flex gap-2">
              <button
                onClick={() => confirmImport('confraternal')}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-xl text-sm font-medium transition-all"
              >
                <Scale className="w-4 h-4" /> Confraternelle
              </button>
              <button
                onClick={() => confirmImport('mission')}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-all"
              >
                <PenLine className="w-4 h-4" /> Mission
              </button>
            </div>
            <button
              onClick={() => setPendingImport(null)}
              className="w-full mt-2 py-2 text-xs text-gray-500 hover:text-gray-700 rounded-xl transition-all"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Mobile list overlay */}
      {showMobileList && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setShowMobileList(false)} />
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
          {/* Left: nav + title */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile: toggle list */}
            <button
              className="lg:hidden flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors flex-shrink-0"
              onClick={() => setShowMobileList(v => !v)}
              title="Liste des modèles"
            >
              {showMobileList ? <X className="w-4 h-4 text-gray-600" /> : <Menu className="w-4 h-4 text-gray-600" />}
            </button>
            <button
              onClick={() => navigate('/')}
              className="hidden sm:flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden md:inline">Tableau de bord</span>
            </button>
            <div className="h-4 w-px bg-gray-200 hidden sm:block" />
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Library className="w-4 h-4 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">Bibliothèque de modèles</p>
                <p className="text-xs text-gray-400 hidden sm:block truncate">Lettres confraternelles · Lettres de mission · Mandats</p>
              </div>
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
            {/* Link to LDM generator */}
            <button
              onClick={() => navigate('/lettre-mission')}
              className="flex items-center gap-1.5 text-xs sm:text-sm bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 px-2.5 sm:px-3.5 py-2 rounded-lg transition-all font-medium"
              title="Générateur de lettre de mission"
            >
              <Cog className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Générateur LDM</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.html,.htm,.md"
              onChange={handleImportFile}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs sm:text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 sm:px-3.5 py-2 rounded-lg transition-all"
              title="Importer un modèle (.txt, .html)"
            >
              <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Importer</span>
            </button>
            <button
              onClick={() => handleNew('confraternal')}
              className="flex items-center gap-1.5 text-xs sm:text-sm bg-amber-100 hover:bg-amber-200 text-amber-800 px-2.5 sm:px-3.5 py-2 rounded-lg transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Confraternelle</span>
            </button>
            <button
              onClick={() => handleNew('mandat_creation')}
              className="flex items-center gap-1.5 text-xs sm:text-sm bg-violet-100 hover:bg-violet-200 text-violet-800 px-2.5 sm:px-3.5 py-2 rounded-lg transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Mandat</span>
            </button>
            <button
              onClick={() => handleNew('mission')}
              className="flex items-center gap-1.5 text-xs sm:text-sm bg-blue-600 hover:bg-blue-700 text-white px-2.5 sm:px-3.5 py-2 rounded-lg transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mission</span>
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-4 sm:py-6 gap-4 sm:gap-6 relative">
        {/* Left: Template list — fixed sidebar on desktop, overlay on mobile */}
        <aside
          className={`
            ${showMobileList
              ? 'fixed left-0 top-14 bottom-0 z-40 w-72 shadow-2xl overflow-y-auto'
              : 'hidden lg:block w-72 flex-shrink-0'
            }
            bg-white lg:bg-transparent border-r lg:border-r-0 border-gray-200 px-4 py-4 lg:p-0
          `}
        >
          {/* Filter tabs */}
          <div className="flex gap-0.5 bg-gray-100 p-0.5 rounded-lg mb-3">
            {([['all', 'Tous'], ['confraternal', 'Confrat.'], ['mission', 'Mission'], ['mandat_creation', 'Mandat']] as const).map(([v, l]) => (
              <button
                key={v}
                onClick={() => setFilterType(v)}
                className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-all ${filterType === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {l}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            {filtered.map(t => (
              <div
                key={t.id}
                onClick={() => handleSelect(t)}
                className={`border rounded-xl p-3 cursor-pointer transition-all group ${
                  selected?.id === t.id
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {t.type === 'confraternal' ? (
                      <Scale className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    ) : t.type === 'mandat_creation' ? (
                      <FileText className="w-4 h-4 text-violet-500 flex-shrink-0" />
                    ) : (
                      <PenLine className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{t.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {t.type === 'confraternal' ? 'Confraternelle' : t.type === 'mandat_creation' ? 'Mandat création' : 'Lettre de mission'}
                        {t.isDefault && ' · Défaut'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleDuplicate(t, e)}
                      className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                      title="Dupliquer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    {!t.isDefault && (
                      <button
                        onClick={(e) => handleDelete(t, e)}
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  Modifié le {new Date(t.updatedAt).toLocaleDateString('fr-FR')}
                </p>
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="text-center py-8 bg-white border border-dashed border-gray-300 rounded-xl">
                <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-400">Aucun modèle</p>
                <button onClick={() => handleNew('mission')} className="mt-3 text-xs text-blue-600 hover:underline">
                  + Créer un modèle
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Right: Editor */}
        {viewMode === 'edit' && selected ? (
          <div className="flex-1 min-w-0 bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col" style={{ minHeight: '600px' }}>
            {/* Editor header */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {selected.type === 'confraternal' ? (
                  <Scale className="w-4 h-4 text-amber-500 flex-shrink-0" />
                ) : selected.type === 'mandat_creation' ? (
                  <FileText className="w-4 h-4 text-violet-500 flex-shrink-0" />
                ) : (
                  <PenLine className="w-4 h-4 text-blue-500 flex-shrink-0" />
                )}
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="flex-1 min-w-0 text-sm font-semibold text-gray-900 bg-transparent border-0 outline-none focus:bg-gray-100 px-2 py-1 rounded-lg"
                />
                {/* Unsaved indicator */}
                {(editContent !== savedContent || editName !== savedName) && !savedMsg && (
                  <span className="text-xs text-amber-500 font-medium flex-shrink-0" title="Modifications non sauvegardées">●</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {savedMsg && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {savedMsg}
                  </span>
                )}
                {selected.isDefault && (
                  <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full hidden sm:inline">Défaut</span>
                )}
                {/* Revert button — only visible when there are unsaved changes */}
                {(editContent !== savedContent || editName !== savedName) && (
                  <button
                    onClick={handleRevert}
                    className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-800 px-2.5 py-1.5 border border-amber-200 bg-amber-50 hover:bg-amber-100 rounded-lg transition-all"
                    title="Annuler les modifications non sauvegardées"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Annuler modifications</span>
                  </button>
                )}
                {/* Export buttons */}
                <button onClick={handleExportTxt} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-2.5 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all" title="Télécharger en .txt">
                  <Download className="w-3.5 h-3.5" /> TXT
                </button>
                <button onClick={handleExportHtml} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-2.5 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all" title="Télécharger en .html">
                  <Download className="w-3.5 h-3.5" /> HTML
                </button>
                <button onClick={handlePrint} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-2.5 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all">
                  <Eye className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Imprimer</span>
                </button>
                {selected.type === 'mission' && (
                  <button
                    onClick={handleUseInGenerator}
                    className="flex items-center gap-1.5 text-xs bg-violet-600 hover:bg-violet-700 text-white px-2.5 py-1.5 rounded-lg transition-all"
                    title="Utiliser dans le générateur de lettre de mission"
                  >
                    <Cog className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Générateur</span>
                  </button>
                )}
                <button onClick={handleSave} className="flex items-center gap-1.5 text-xs bg-blue-600 text-white px-2.5 sm:px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-all">
                  <Save className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Sauvegarder</span>
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-0.5 px-4 sm:px-5 pt-3 pb-0 border-b border-gray-100 overflow-x-auto">
              {([['edit', <Edit3 className="w-3.5 h-3.5" />, 'Modifier'], ['preview', <Eye className="w-3.5 h-3.5" />, 'Aperçu'], ['variables', <List className="w-3.5 h-3.5" />, 'Variables']] as const).map(([id, icon, label]) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs font-medium rounded-t-lg border-b-2 transition-all whitespace-nowrap ${
                    activeTab === id
                      ? 'text-blue-600 border-blue-600 bg-blue-50'
                      : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {icon} {label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-hidden" style={{ minHeight: '400px' }}>
              {activeTab === 'edit' && (
                <div className="h-full p-3 sm:p-4">
                  <textarea
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    className="w-full h-full border border-gray-200 rounded-xl p-4 text-sm font-mono resize-none outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                    spellCheck={false}
                    placeholder="Contenu du modèle... Utilisez {{variable}} pour les champs dynamiques."
                    style={{ minHeight: '400px' }}
                  />
                </div>
              )}

              {activeTab === 'preview' && (
                <div className="h-full overflow-y-auto p-4 sm:p-6 bg-gray-100">
                  <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <p className="text-xs text-amber-700">Aperçu avec données d'exemple — variables remplacées par des valeurs fictives</p>
                  </div>
                  <div
                    className="bg-white shadow-lg rounded-lg mx-auto max-w-2xl p-8 sm:p-12 min-h-96"
                    style={{ fontFamily: '"Times New Roman", serif', fontSize: '13px', lineHeight: '1.7', color: '#1a1a1a' }}
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(buildLetterHtml(previewContent, previewVars)) }}
                  />
                </div>
              )}

              {activeTab === 'variables' && (
                <div className="h-full overflow-y-auto p-4 sm:p-5">
                  <p className="text-xs text-gray-500 mb-4">
                    Cliquez sur une variable pour la copier. Insérez-la dans votre modèle : elle sera remplacée automatiquement par les données client lors de la génération.
                  </p>
                  <div className="space-y-5">
                    {varCategories.map(cat => {
                      const catVars = AVAILABLE_VARIABLES.filter(v => v.category === cat);
                      if (catVars.length === 0) return null;
                      return (
                        <div key={cat}>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{cat}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {catVars.map(v => (
                              <button
                                key={v.key}
                                onClick={() => {
                                  navigator.clipboard?.writeText(`{{${v.key}}}`);
                                  setSavedMsg(`Copié : {{${v.key}}}`);
                                  setTimeout(() => setSavedMsg(''), 1500);
                                }}
                                className="flex items-start gap-2 p-2.5 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all text-left group"
                              >
                                <code className="text-xs bg-gray-100 group-hover:bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-mono flex-shrink-0">
                                  {`{{${v.key}}}`}
                                </code>
                                <p className="text-xs text-gray-600 truncate">{v.label}</p>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Empty state — no template selected */
          <div className="flex-1 flex items-center justify-center bg-white border border-dashed border-gray-300 rounded-2xl p-8">
            <div className="text-center max-w-sm">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Library className="w-8 h-8 text-blue-300" />
              </div>
              <p className="text-gray-700 font-semibold mb-1">Sélectionnez un modèle</p>
              <p className="text-xs text-gray-400 mb-5">Choisissez un modèle dans la liste à gauche pour le modifier, ou créez-en un nouveau ci-dessous.</p>
              <div className="flex flex-col sm:flex-row items-center gap-2 justify-center">
                <button onClick={() => handleNew('confraternal')} className="w-full sm:w-auto flex items-center justify-center gap-2 text-sm bg-amber-100 hover:bg-amber-200 text-amber-800 px-3.5 py-2 rounded-lg transition-all">
                  <Plus className="w-4 h-4" /> Confraternelle
                </button>
                <button onClick={() => handleNew('mandat_creation')} className="w-full sm:w-auto flex items-center justify-center gap-2 text-sm bg-violet-100 hover:bg-violet-200 text-violet-800 px-3.5 py-2 rounded-lg transition-all">
                  <Plus className="w-4 h-4" /> Mandat création
                </button>
                <button onClick={() => handleNew('mission')} className="w-full sm:w-auto flex items-center justify-center gap-2 text-sm bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg transition-all">
                  <Plus className="w-4 h-4" /> Mission
                </button>
              </div>
              <div className="mt-6 pt-5 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-2">Aller directement au générateur</p>
                <button
                  onClick={() => navigate('/lettre-mission')}
                  className="flex items-center justify-center gap-2 text-sm text-violet-700 hover:text-violet-900 border border-violet-200 bg-violet-50 hover:bg-violet-100 px-4 py-2 rounded-lg transition-all w-full sm:w-auto mx-auto"
                >
                  <Cog className="w-4 h-4" /> Générateur de lettre de mission
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}