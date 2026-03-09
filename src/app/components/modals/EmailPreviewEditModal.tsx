import { useState } from 'react';
import { X, Eye, Edit3, Send, Mail, Monitor, Smartphone, Download } from 'lucide-react';

type ViewMode = 'desktop' | 'mobile';
type Tab = 'preview' | 'edit';

interface EmailPreviewEditModalProps {
  subject: string;
  htmlContent: string;
  to: string;
  toName?: string;
  onSend: (subject: string, htmlContent: string) => void;
  onClose: () => void;
}

export function EmailPreviewEditModal({ subject, htmlContent, to, toName, onSend, onClose }: EmailPreviewEditModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('preview');
  const [editSubject, setEditSubject] = useState(subject);
  const [editHtml, setEditHtml] = useState(htmlContent);
  const [viewMode, setViewMode] = useState<ViewMode>('desktop');

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'preview', label: 'Aperçu', icon: <Eye className="w-3.5 h-3.5" /> },
    { id: 'edit', label: 'Modifier', icon: <Edit3 className="w-3.5 h-3.5" /> },
  ];

  /**
   * Exporte l'email en PDF via fenêtre d'impression.
   * @page A4 + en-tête De / À / Objet formaté au-dessus du corps de l'email.
   */
  const handleExportPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Autorisez les pop-ups pour générer le PDF.');
      return;
    }
    const recipient = toName ? `${toName} &lt;${to}&gt;` : to;
    printWindow.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>${editSubject}</title>
  <style>
    @page { size: A4; margin: 2cm 2.5cm; }
    @media print {
      html, body { height: 100%; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #1a1a1a; margin: 0; padding: 0; }
    .email-header {
      background: #f5f5f5;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 14px 16px;
      margin-bottom: 24px;
    }
    .email-header p { margin: 3px 0; font-size: 10pt; color: #555; }
    .email-header strong { color: #222; }
    .email-body { font-size: 11pt; }
  </style>
</head>
<body>
  <div class="email-header">
    <p><strong>De :</strong> CabinetFlow Expert-Comptable &lt;onboarding@cabinet.fr&gt;</p>
    <p><strong>À :</strong> ${recipient}</p>
    <p><strong>Objet :</strong> ${editSubject}</p>
  </div>
  <div class="email-body">${editHtml}</div>
</body>
</html>`);
    printWindow.document.close();
    setTimeout(() => { printWindow.focus(); printWindow.print(); }, 350);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      {/*
        h-[90vh] fixe (pas max-h) → flex-1 peut calculer la hauteur disponible
        et overflow-y-auto fonctionne dans la zone de contenu
      */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50 rounded-t-2xl flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
              <Mail className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Prévisualisation de l'email</p>
              <p className="text-xs text-gray-500">Destinataire : {toName ? `${toName} <${to}>` : to}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Subject bar */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3 flex-shrink-0">
          <span className="text-xs text-gray-500 whitespace-nowrap font-medium">Objet :</span>
          <input
            type="text"
            value={editSubject}
            onChange={e => setEditSubject(e.target.value)}
            className="flex-1 text-sm text-gray-800 border-0 outline-none bg-transparent focus:bg-gray-50 px-2 py-1 rounded-lg transition-all"
            placeholder="Objet de l'email..."
          />
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode('desktop')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'desktop' ? 'bg-gray-200 text-gray-700' : 'text-gray-400 hover:bg-gray-100'}`}
              title="Vue bureau"
            >
              <Monitor className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('mobile')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'mobile' ? 'bg-gray-200 text-gray-700' : 'text-gray-400 hover:bg-gray-100'}`}
              title="Vue mobile"
            >
              <Smartphone className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 px-5 pt-3 pb-0 border-b border-gray-100 flex-shrink-0">
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

        {/* Zone de contenu — flex-1 fonctionne car h-[90vh] est fixé sur le parent */}
        <div className="flex-1 overflow-hidden">

          {/* Aperçu email */}
          {activeTab === 'preview' && (
            <div className="h-full overflow-y-auto bg-gray-100 p-6 flex justify-center">
              <div className={`bg-white shadow-lg rounded-lg overflow-hidden transition-all ${
                viewMode === 'mobile' ? 'w-80' : 'w-full max-w-2xl'
              }`}>
                {/* En-tête client email */}
                <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="font-medium text-gray-700">De :</span>
                    <span>CabinetFlow Expert-Comptable &lt;onboarding@cabinet.fr&gt;</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                    <span className="font-medium text-gray-700">À :</span>
                    <span>{toName ? `${toName} <${to}>` : to}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs mt-1">
                    <span className="font-medium text-gray-700 text-xs">Objet :</span>
                    <span className="font-medium text-gray-800">{editSubject}</span>
                  </div>
                </div>
                {/* Corps */}
                <div
                  className="p-0"
                  dangerouslySetInnerHTML={{ __html: editHtml }}
                />
              </div>
            </div>
          )}

          {/* Éditeur HTML */}
          {activeTab === 'edit' && (
            <div className="h-full flex flex-col p-4 gap-3">
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 flex-shrink-0">
                <Edit3 className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <p className="text-xs text-amber-700">
                  Modifiez le HTML directement ci-dessous. Les modifications s'appliquent en temps réel dans l'aperçu.
                </p>
              </div>
              <div className="flex-1">
                <textarea
                  value={editHtml}
                  onChange={e => setEditHtml(e.target.value)}
                  className="w-full h-full min-h-40 border border-gray-200 rounded-xl p-4 text-xs font-mono resize-none outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                  spellCheck={false}
                  placeholder="Contenu HTML de l'email..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3 rounded-b-2xl flex-shrink-0">
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-white transition-all"
            title="Exporte l'email au format PDF (via impression navigateur)"
          >
            <Download className="w-4 h-4" /> Exporter en PDF
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-white transition-all">
              Annuler
            </button>
            <button
              onClick={() => onSend(editSubject, editHtml)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-5 py-2.5 rounded-xl transition-all shadow-sm"
            >
              <Send className="w-4 h-4" /> Envoyer l'email
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
