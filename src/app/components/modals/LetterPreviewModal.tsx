import { useState, useEffect } from 'react';
import {
  X, Eye, Edit3, List, ChevronDown, CheckCircle2,
  Printer, Send, FileText, Copy, RotateCcw, Plus, Download, Loader2
} from 'lucide-react';
import DOMPurify from 'dompurify';
import {
  LetterTemplate, createNewTemplate,
  substituteVariables, buildLetterHtml, TemplateVariables, AVAILABLE_VARIABLES,
  getTemplatesFromSupabase, saveTemplateToSupabase, deleteTemplateFromSupabase,
} from '../../utils/templateUtils';

type ActiveTab = 'preview' | 'edit' | 'variables';

interface LetterPreviewModalProps {
  type: 'confraternal' | 'mission';
  variables: TemplateVariables;
  onSend: (content: string, templateId: string) => void;
  onClose: () => void;
  sendLabel?: string;
}

export function LetterPreviewModal({ type, variables, onSend, onClose, sendLabel }: LetterPreviewModalProps) {
  const [templates, setTemplates] = useState<LetterTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<LetterTemplate | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('preview');
  const [showTemplateSelect, setShowTemplateSelect] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [newTemplateName, setNewTemplateName] = useState('');
  const [showSaveAs, setShowSaveAs] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  // Load templates from Supabase `documents` table, with localStorage fallback
  useEffect(() => {
    let cancelled = false;
    setLoadingTemplates(true);
    getTemplatesFromSupabase(type).then(tmplList => {
      if (cancelled) return;
      setTemplates(tmplList);
      if (tmplList.length > 0) {
        const t = tmplList[0];
        setSelectedTemplate(t);
        setEditedContent(t.content);
      }
      setLoadingTemplates(false);
    });
    return () => { cancelled = true; };
  }, [type]);

  const renderedContent = editedContent ? substituteVariables(editedContent, variables) : '';
  const renderedHtml = buildLetterHtml(renderedContent, variables);

  const handleSelectTemplate = (t: LetterTemplate) => {
    setSelectedTemplate(t);
    setEditedContent(t.content);
    setShowTemplateSelect(false);
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplate) return;
    setSaving(true);
    const updated = { ...selectedTemplate, content: editedContent };
    await saveTemplateToSupabase(updated);
    setSelectedTemplate(updated);
    const refreshed = await getTemplatesFromSupabase(type);
    setTemplates(refreshed);
    setSaving(false);
    setSavedMsg('Modèle sauvegardé !');
    setTimeout(() => setSavedMsg(''), 2000);
  };

  const handleSaveAsNew = async () => {
    if (!newTemplateName.trim()) return;
    const newT = createNewTemplate(type);
    const saved = { ...newT, name: newTemplateName, content: editedContent };
    await saveTemplateToSupabase(saved);
    const updated = await getTemplatesFromSupabase(type);
    setTemplates(updated);
    setSelectedTemplate(saved);
    setShowSaveAs(false);
    setNewTemplateName('');
    setSavedMsg('Nouveau modèle créé !');
    setTimeout(() => setSavedMsg(''), 2000);
  };

  const handleNewTemplate = async () => {
    const t = createNewTemplate(type);
    await saveTemplateToSupabase(t);
    const updated = await getTemplatesFromSupabase(type);
    setTemplates(updated);
    setSelectedTemplate(t);
    setEditedContent(t.content);
  };

  const handleReset = () => {
    if (selectedTemplate) setEditedContent(selectedTemplate.content);
  };

  const handleDeleteTemplate = async () => {
    if (!selectedTemplate || selectedTemplate.isDefault) return;
    await deleteTemplateFromSupabase(selectedTemplate.id);
    const updated = await getTemplatesFromSupabase(type);
    setTemplates(updated);
    if (updated.length > 0) {
      setSelectedTemplate(updated[0]);
      setEditedContent(updated[0].content);
    } else {
      setSelectedTemplate(null);
      setEditedContent('');
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${selectedTemplate?.name || 'Lettre'}</title>
          <style>
            body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.6; margin: 2cm; color: #1a1a1a; }
            strong { font-weight: bold; }
            hr { border: none; border-top: 1px solid #ccc; margin: 16px 0; }
          </style>
        </head>
        <body>${renderedHtml}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleExportDoc = () => {
    const docHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8">
<style>
  body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.6; margin: 2cm; color: #1a1a1a; }
  strong { font-weight: bold; }
  hr { border: none; border-top: 1px solid #ccc; margin: 16px 0; }
</style>
</head>
<body>${renderedHtml}</body>
</html>`;
    const blob = new Blob(['\ufeff', docHtml], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedTemplate?.name || 'lettre'}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const tabs: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'preview', label: 'Aperçu', icon: <Eye className="w-3.5 h-3.5" /> },
    { id: 'edit', label: 'Modifier', icon: <Edit3 className="w-3.5 h-3.5" /> },
    { id: 'variables', label: 'Variables', icon: <List className="w-3.5 h-3.5" /> },
  ];

  const varCategories = ['Cabinet', 'Client', type === 'confraternal' ? 'Reprise' : 'Mission', 'Honoraires', 'Dates'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {type === 'confraternal' ? '📜 Lettre Confraternelle' : '📄 Lettre de Mission'}
              </p>
              <p className="text-xs text-gray-500">Prévisualisation et personnalisation avant envoi</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Template selector */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-0">
            <button
              onClick={() => setShowTemplateSelect(!showTemplateSelect)}
              disabled={loadingTemplates}
              className="flex items-center gap-2 w-full max-w-xs bg-white border border-gray-200 hover:border-gray-300 text-gray-700 text-sm px-3 py-2 rounded-lg transition-all disabled:opacity-60"
            >
              {loadingTemplates ? (
                <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin flex-shrink-0" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              )}
              <span className="truncate text-left flex-1">
                {loadingTemplates ? 'Chargement depuis Supabase…' : (selectedTemplate?.name || 'Choisir un modèle')}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            </button>

            {showTemplateSelect && (
              <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-10 overflow-hidden">
                <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-1.5">
                  <span className="text-xs text-gray-400 font-medium">Source :</span>
                  <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-medium">Supabase documents</span>
                </div>
                <div className="p-1">
                  {templates.map(t => (
                    <button
                      key={t.id}
                      onClick={() => handleSelectTemplate(t)}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-all ${t.id === selectedTemplate?.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'}`}
                    >
                      <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{t.name}</p>
                        {t.isDefault && <p className="text-xs text-gray-400">Modèle par défaut</p>}
                      </div>
                      {t.id === selectedTemplate?.id && <CheckCircle2 className="w-4 h-4 text-blue-500 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
                <div className="border-t border-gray-100 p-1">
                  <button
                    onClick={() => { handleNewTemplate(); setShowTemplateSelect(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Créer un nouveau modèle
                  </button>
                </div>
              </div>
            )}
          </div>

          {savedMsg && (
            <span className="text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> {savedMsg}
            </span>
          )}

          <div className="flex items-center gap-1.5 ml-auto">
            {activeTab === 'edit' && (
              <>
                <button onClick={handleReset} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-all">
                  <RotateCcw className="w-3.5 h-3.5" /> Reset
                </button>
                {selectedTemplate && !selectedTemplate.isDefault && (
                  <button
                    onClick={handleDeleteTemplate}
                    className="text-xs text-red-500 hover:text-red-700 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-all"
                    title="Supprimer ce modèle"
                  >
                    ✕
                  </button>
                )}
                {!showSaveAs ? (
                  <>
                    <button onClick={() => setShowSaveAs(true)} className="text-xs text-gray-600 hover:text-gray-800 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all flex items-center gap-1">
                      <Copy className="w-3.5 h-3.5" /> Sauver sous...
                    </button>
                    <button onClick={handleSaveTemplate} disabled={saving} className="flex items-center gap-1 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-all">
                      {saving ? '...' : <><CheckCircle2 className="w-3.5 h-3.5" /> Sauvegarder</>}
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newTemplateName}
                      onChange={e => setNewTemplateName(e.target.value)}
                      placeholder="Nom du modèle..."
                      className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-400 w-40"
                      onKeyDown={e => e.key === 'Enter' && handleSaveAsNew()}
                    />
                    <button onClick={handleSaveAsNew} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">OK</button>
                    <button onClick={() => setShowSaveAs(false)} className="text-xs text-gray-500 px-2 py-1.5 rounded-lg hover:bg-gray-100">✕</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 px-5 pt-3 pb-0 border-b border-gray-100">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium rounded-t-lg border-b-2 transition-all ${
                activeTab === t.id
                  ? 'text-blue-600 border-blue-600 bg-blue-50'
                  : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {activeTab === 'preview' && (
            <div className="h-full overflow-y-auto p-6 bg-gray-100">
              <div
                className="bg-white shadow-lg rounded-lg mx-auto max-w-2xl p-12 min-h-[600px]"
                style={{ fontFamily: '"Times New Roman", serif', fontSize: '13px', lineHeight: '1.7', color: '#1a1a1a' }}
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderedHtml) }}
              />
            </div>
          )}

          {activeTab === 'edit' && (
            <div className="h-full flex">
              <div className="flex-1 flex flex-col p-4">
                <p className="text-xs text-gray-500 mb-2 flex-shrink-0">
                  Modifiez le contenu ci-dessous. Utilisez <code className="bg-gray-100 px-1 rounded">{'{{variable}}'}</code> pour les données dynamiques.
                </p>
                <textarea
                  value={editedContent}
                  onChange={e => setEditedContent(e.target.value)}
                  className="flex-1 min-h-0 border border-gray-200 rounded-xl p-4 text-sm font-mono resize-none outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                  spellCheck={false}
                />
              </div>
            </div>
          )}

          {activeTab === 'variables' && (
            <div className="h-full overflow-y-auto p-5">
              <p className="text-xs text-gray-500 mb-4">
                Cliquez sur une variable pour la copier dans votre presse-papier. Les valeurs sont automatiquement substituées dans l'aperçu.
              </p>
              <div className="space-y-4">
                {varCategories.map(cat => {
                  const catVars = AVAILABLE_VARIABLES.filter(v => v.category === cat);
                  if (catVars.length === 0) return null;
                  return (
                    <div key={cat}>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{cat}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {catVars.map(v => {
                          const value = variables[v.key as keyof TemplateVariables];
                          return (
                            <button
                              key={v.key}
                              onClick={() => navigator.clipboard?.writeText(`{{${v.key}}}`)}
                              className="flex items-start gap-2 p-2.5 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all text-left group"
                            >
                              <code className="text-xs bg-gray-100 group-hover:bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-mono flex-shrink-0">
                                {`{{${v.key}}}`}
                              </code>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-gray-700 truncate">{v.label}</p>
                                {value ? (
                                  <p className="text-xs text-emerald-600 truncate">✓ {String(value).substring(0, 40)}</p>
                                ) : (
                                  <p className="text-xs text-gray-400">Non renseigné</p>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3 rounded-b-2xl">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-white transition-all"
          >
            <Printer className="w-4 h-4" /> Imprimer / PDF
          </button>
          <button
            onClick={handleExportDoc}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-white transition-all"
          >
            <Download className="w-4 h-4" /> Exporter DOC
          </button>

          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-xl hover:bg-white transition-all">
              Fermer
            </button>
            <button
              onClick={() => onSend(renderedContent, selectedTemplate?.id || '')}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-5 py-2.5 rounded-xl transition-all shadow-sm"
            >
              <Send className="w-4 h-4" />
              {sendLabel || 'Envoyer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}