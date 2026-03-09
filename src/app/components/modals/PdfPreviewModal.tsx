import { useEffect, useRef, useState } from 'react';
import { X, Download, Send, Loader2, ExternalLink } from 'lucide-react';
import type { PdfResult } from '../../services/pdfGenerator';

interface PdfPreviewModalProps {
  /** Pre-generated PDF result (blob + base64 + filename) */
  pdfResult: PdfResult;
  /** Called when the user confirms sending — receives base64 for email attachment */
  onSend: (base64: string, filename: string) => Promise<void>;
  /** Called to close the modal */
  onClose: () => void;
  /** Recipient email shown in the send button */
  recipientEmail?: string;
  /** Sending state lifted in from parent */
  isSending?: boolean;
}

export function PdfPreviewModal({
  pdfResult,
  onSend,
  onClose,
  recipientEmail,
  isSending = false,
}: PdfPreviewModalProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(pdfResult.blob);
    objectUrlRef.current = url;
    setObjectUrl(url);
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, [pdfResult.blob]);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = objectUrl ?? '';
    a.download = pdfResult.filename;
    a.click();
  };

  const handleOpenNewTab = () => {
    if (objectUrl) window.open(objectUrl, '_blank');
  };

  const handleSend = async () => {
    await onSend(pdfResult.base64, pdfResult.filename);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Prévisualisation PDF — Lettre confraternelle</h3>
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-sm">{pdfResult.filename}</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* PDF iframe */}
        <div className="flex-1 overflow-hidden bg-gray-100 relative min-h-0">
          {objectUrl ? (
            <iframe
              src={`${objectUrl}#toolbar=0`}
              className="w-full h-full"
              title="Prévisualisation PDF"
            />
          ) : (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            </div>
          )}
        </div>

        {/* Action bar */}
        <div className="flex-shrink-0 px-5 py-3 border-t border-gray-100 bg-gray-50 flex flex-wrap items-center gap-2 justify-between">
          {/* Secondary actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-700 px-3 py-2 rounded-lg transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              Télécharger le PDF
            </button>
            <button
              onClick={handleOpenNewTab}
              className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 hover:border-gray-300 text-gray-600 px-3 py-2 rounded-lg transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Ouvrir dans un onglet
            </button>
          </div>

          {/* Send action */}
          <button
            onClick={handleSend}
            disabled={isSending}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm ${
              isSending
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-amber-600 hover:bg-amber-700 text-white'
            }`}
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Envoi en cours…
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Envoyer au confrère{recipientEmail ? ` (${recipientEmail})` : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
