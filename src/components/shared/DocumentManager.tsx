import { useState } from "react";
import { trpc } from "@/providers/trpc-client";
import DocumentPreviewModal from "./DocumentPreviewModal";
import type { DocumentListItem } from "@/types/trpc";
import type { LucideIcon } from "lucide-react";
import {
  FileText, Image, Search, Download, Trash2, RefreshCw,
  Eye, AlertCircle, CheckCircle, X, FileWarning,
} from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  passport: "Passport Copy",
  photo: "Personal Photo",
  national_id: "National ID",
  supporting: "Supporting Document",
  visa: "Visa PDF",
  invoice: "Invoice PDF",
  gcc_residence: "GCC Residence",
  sponsor_id: "Sponsor ID",
};

const TYPE_COLORS: Record<string, string> = {
  passport: "bg-blue-50 text-blue-600",
  photo: "bg-purple-50 text-purple-600",
  national_id: "bg-emerald-50 text-emerald-600",
  supporting: "bg-amber-50 text-amber-600",
  visa: "bg-cyan-50 text-cyan-600",
  invoice: "bg-rose-50 text-rose-600",
  gcc_residence: "bg-indigo-50 text-indigo-600",
  sponsor_id: "bg-gray-50 text-gray-600",
};

const STATUS_ICONS: Record<string, LucideIcon> = {
  uploaded: CheckCircle,
  pending: AlertCircle,
  failed: FileWarning,
  replaced: RefreshCw,
};

const STATUS_COLORS: Record<string, string> = {
  uploaded: "text-emerald-500",
  pending: "text-amber-500",
  failed: "text-red-500",
  replaced: "text-blue-500",
};

interface DocumentManagerProps {
  applicationId: number;
  readOnly?: boolean;
}

export default function DocumentManager({ applicationId, readOnly = false }: DocumentManagerProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | DocumentListItem["documentType"]>("");
  const [previewDoc, setPreviewDoc] = useState<DocumentListItem | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: docs, isLoading } = trpc.document.listByApplication.useQuery({
    applicationId,
    search: search || undefined,
    documentType: typeFilter || undefined,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  const { data: countData } = trpc.document.countByApplication.useQuery({ applicationId });
  const deleteDoc = trpc.document.delete.useMutation({
    onSuccess: () => {
      utils.document.listByApplication.invalidate({ applicationId });
      utils.document.countByApplication.invalidate({ applicationId });
      setDeletingId(null);
    },
  });

  const handleDelete = (doc: DocumentListItem) => {
    if (!confirm(`Delete "${doc.originalFileName}"? This cannot be undone.`)) return;
    setDeletingId(doc.id);
    deleteDoc.mutate({ id: doc.id });
  };

  const handleDownload = async (doc: DocumentListItem) => {
    try {
      const result = await utils.storage.getSignedUrl.fetch({ documentId: doc.id });
      if (result?.signedUrl) {
        const a = document.createElement("a");
        a.href = result.signedUrl;
        a.download = doc.originalFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error("Download failed:", err);
      alert("Download failed. Please try again.");
    }
  };

  const formatSize = (bytes: number | bigint) => {
    const b = Number(bytes);
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-[#C9A04C]/10 text-[#C9A04C] px-3 py-1 rounded-full text-sm font-semibold">
            {countData?.count || 0} Documents
          </div>
          {countData && countData.totalSize > 0 && (
            <span className="text-xs text-gray-400">
              Total: {formatSize(countData.totalSize)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            {docs?.filter((d) => d.uploadStatus === "uploaded").length || 0} uploaded
          </span>
          {docs && docs.some((d) => d.uploadStatus === "failed") && (
            <span className="text-xs text-red-400 flex items-center gap-1">
              <AlertCircle size={10} />
              {docs.filter((d) => d.uploadStatus === "failed").length} failed
            </span>
          )}
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by filename..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#C9A04C] focus:outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={12} />
            </button>
          )}
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#C9A04C] focus:outline-none bg-white min-w-[150px]"
        >
          <option value="">All Types</option>
          {Object.entries(TYPE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Documents List */}
      {isLoading ? (
        <div className="text-center py-10 text-gray-400 text-sm">Loading documents...</div>
      ) : !docs || docs.length === 0 ? (
        <div className="border border-dashed border-gray-200 rounded-lg p-8 text-center">
          <FileText size={24} className="text-gray-300 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">No documents found.</p>
          <p className="text-gray-300 text-xs mt-1">Documents will appear here after customer upload.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => {
            const isImage = doc.mimeType.startsWith("image/");
            const StatusIcon = STATUS_ICONS[doc.uploadStatus] || AlertCircle;
            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 bg-white border border-gray-100 rounded-lg p-3 hover:border-gray-200 transition-colors"
              >
                {/* Icon */}
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  isImage ? "bg-purple-50" : "bg-red-50"
                }`}>
                  {isImage ? <Image size={16} className="text-purple-500" /> : <FileText size={16} className="text-red-500" />}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{doc.originalFileName}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className={`px-1.5 py-0.5 rounded-full ${TYPE_COLORS[doc.documentType] || "bg-gray-50 text-gray-600"}`}>
                      {TYPE_LABELS[doc.documentType] || doc.documentType}
                    </span>
                    <span>{formatSize(doc.fileSize)}</span>
                    <span>{doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : "-"}</span>
                    <span className={`flex items-center gap-0.5 ${STATUS_COLORS[doc.uploadStatus] || "text-gray-500"}`}>
                      <StatusIcon size={10} />
                      {doc.uploadStatus}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPreviewDoc(doc)}
                    className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Preview"
                  >
                    <Eye size={14} />
                  </button>
                  <button
                    onClick={() => handleDownload(doc)}
                    className="p-1.5 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                    title="Download"
                  >
                    <Download size={14} />
                  </button>
                    {!readOnly && <button
                      onClick={() => handleDelete(doc)}
                    disabled={deleteDoc.isPending && deletingId === doc.id}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                    </button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview Modal */}
      {previewDoc && (
        <DocumentPreviewModal
          documentId={previewDoc.id}
          fileName={previewDoc.originalFileName}
          mimeType={previewDoc.mimeType}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  );
}
