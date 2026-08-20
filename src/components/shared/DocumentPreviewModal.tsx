import { trpc } from "@/providers/trpc-client";
import { X, Download, FileText, Image, Loader2 } from "lucide-react";

interface DocumentPreviewModalProps {
  documentId: number;
  fileName: string;
  mimeType: string;
  onClose: () => void;
}

export default function DocumentPreviewModal({
  documentId,
  fileName,
  mimeType,
  onClose,
}: DocumentPreviewModalProps) {
  const { data: urlData, isLoading } = trpc.storage.getSignedUrl.useQuery(
    { documentId },
    { enabled: documentId > 0 },
  );

  const signedUrl = urlData?.signedUrl ?? null;
  const loading = isLoading;
  const error = !isLoading && !signedUrl ? "Failed to generate preview URL" : "";

  const isPdf = mimeType === "application/pdf";
  const isImage = mimeType.startsWith("image/");

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {isPdf ? <FileText size={18} className="text-red-500" /> : <Image size={18} className="text-blue-500" />}
            <h3 className="text-sm font-semibold text-gray-900 truncate max-w-[400px]">{fileName}</h3>
          </div>
          <div className="flex items-center gap-2">
            {signedUrl && (
              <a
                href={signedUrl}
                download={fileName}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#C9A04C] hover:bg-[#C9A04C]/5 rounded-lg transition-colors"
              >
                <Download size={14} />
                Download
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-auto p-4 bg-gray-50 flex items-center justify-center min-h-[400px]">
          {loading && (
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={32} className="text-[#C9A04C] animate-spin" />
              <p className="text-sm text-gray-500">Generating preview...</p>
            </div>
          )}

          {error && (
            <div className="text-center">
              <p className="text-red-500 text-sm">{error}</p>
              <p className="text-gray-400 text-xs mt-1">Please try downloading instead.</p>
            </div>
          )}

          {signedUrl && isPdf && (
            <iframe
              src={signedUrl}
              className="w-full h-[70vh] rounded-lg border border-gray-200"
              title={fileName}
            />
          )}

          {signedUrl && isImage && (
            <img
              src={signedUrl}
              alt={fileName}
              className="max-w-full max-h-[70vh] rounded-lg shadow-md"
            />
          )}
        </div>
      </div>
    </div>
  );
}
