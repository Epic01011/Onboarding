import { X, Send, Eye, Download } from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';

interface EmailPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: () => void;
  subject: string;
  recipient: string;
  recipientName: string;
  htmlContent: string;
  senderName?: string;
  senderEmail?: string;
}

export function EmailPreviewModal({
  isOpen,
  onClose,
  onSend,
  subject,
  recipient,
  recipientName,
  htmlContent,
  senderName = 'CabinetFlow',
  senderEmail = 'onboarding@cabinet.fr',
}: EmailPreviewModalProps) {
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    setSending(true);
    await onSend();
    setSending(false);
  };

  /**
   * Exporte l'email en PDF via fenêtre d'impression.
   * En-tête De / À / Objet + corps HTML, format A4.
   */
  const handleExportPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Autorisez les pop-ups pour générer le PDF.');
      return;
    }
    const recipientDisplay = recipientName
      ? `${recipientName} &lt;${recipient}&gt;`
      : recipient;

    printWindow.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
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
  </style>
</head>
<body>
  <div class="email-header">
    <p><strong>De :</strong> ${senderName} &lt;${senderEmail}&gt;</p>
    <p><strong>À :</strong> ${recipientDisplay}</p>
    <p><strong>Objet :</strong> ${subject}</p>
  </div>
  ${htmlContent}
</body>
</html>`);
    printWindow.document.close();
    setTimeout(() => { printWindow.focus(); printWindow.print(); }, 350);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {/*
        h-[85vh] fixe (pas max-h) → les enfants flex-1 calculent leur hauteur correctement
        overflow-hidden coupe le débordement au niveau du DialogContent
        La zone de contenu utilise flex-1 + overflow-y-auto pour le scroll interne
      */}
      <DialogContent className="max-w-3xl h-[85vh] overflow-hidden flex flex-col p-0">

        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-white" />
              <DialogTitle className="text-white text-base">Prévisualisation de l’email</DialogTitle>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Métadonnées email */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 space-y-2 flex-shrink-0">
          <div className="flex items-start gap-2">
            <span className="text-xs text-gray-500 w-16 flex-shrink-0 mt-0.5">De :</span>
            <div className="flex-1">
              <p className="text-sm text-gray-900">{senderName}</p>
              <p className="text-xs text-gray-500">{senderEmail}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-xs text-gray-500 w-16 flex-shrink-0 mt-0.5">À :</span>
            <div className="flex-1">
              <p className="text-sm text-gray-900">{recipientName}</p>
              <p className="text-xs text-gray-500">{recipient}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-xs text-gray-500 w-16 flex-shrink-0 mt-0.5">Objet :</span>
            <p className="text-sm text-gray-900 flex-1">{subject}</p>
          </div>
        </div>

        {/* Corps de l'email — zone scrollable (flex-1 fonctionne car h-[85vh] est fixé) */}
        <div className="flex-1 overflow-y-auto px-6 py-4 bg-white">
          <div
            className="border border-gray-200 rounded-lg p-4 bg-gray-50"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-white transition-all"
            title="Exporte l'email au format PDF (via impression navigateur)"
          >
            <Download className="w-4 h-4" /> Exporter en PDF
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
            >
              Annuler
            </button>
            <button
              onClick={handleSend}
              disabled={sending}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              {sending ? 'Envoi en cours...' : "Envoyer l'email"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
