import { useState, useCallback } from "react";
import { trpc } from "@/providers/trpc";

export interface PendingFile {
  file: File;
  documentType: "passport" | "photo" | "national_id" | "supporting" | "gcc_residence" | "sponsor_id";
  applicantIndex: number;
}

export interface UploadProgress {
  fileName: string;
  status: "pending" | "uploading" | "success" | "failed";
  progress: number;
}

export function useDocumentUpload() {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const storageUpload = trpc.storage.upload.useMutation();
  const docCreate = trpc.document.create.useMutation();

  const uploadFiles = useCallback(
    async (
      files: PendingFile[],
      applicationId: number,
      applicantIds: number[],
      uploadedBy?: string,
    ): Promise<{ success: boolean; uploaded: number; failed: number }> => {
      if (files.length === 0) return { success: true, uploaded: 0, failed: 0 };

      setIsUploading(true);
      setUploadProgress(
        files.map((f) => ({
          fileName: f.file.name,
          status: "pending" as const,
          progress: 0,
        })),
      );

      let uploaded = 0;
      let failed = 0;

      for (let i = 0; i < files.length; i++) {
        const pf = files[i];

        setUploadProgress((prev) => {
          const updated = [...prev];
          updated[i] = { ...updated[i], status: "uploading", progress: 30 };
          return updated;
        });

        try {
          // Read file as base64
          const base64 = await fileToBase64(pf.file);

          setUploadProgress((prev) => {
            const updated = [...prev];
            updated[i] = { ...updated[i], progress: 60 };
            return updated;
          });

          // Upload to Supabase
          const result = await storageUpload.mutateAsync({
            applicationId,
            applicantId: applicantIds[pf.applicantIndex] || undefined,
            documentType: pf.documentType,
            fileName: pf.file.name,
            mimeType: pf.file.type,
            fileSize: pf.file.size,
            base64Data: base64.split(",")[1], // Remove data: prefix
            uploadedBy,
          });

          setUploadProgress((prev) => {
            const updated = [...prev];
            updated[i] = { ...updated[i], progress: 80 };
            return updated;
          });

          // Create document record in MySQL
          await docCreate.mutateAsync({
            applicationId,
            applicantId: applicantIds[pf.applicantIndex] || undefined,
            documentType: pf.documentType,
            originalFileName: pf.file.name,
            storedFileName: result.storedFileName,
            mimeType: pf.file.type,
            fileSize: pf.file.size,
            storagePath: result.storagePath,
            uploadStatus: "uploaded",
            uploadedBy,
          });

          setUploadProgress((prev) => {
            const updated = [...prev];
            updated[i] = { fileName: pf.file.name, status: "success", progress: 100 };
            return updated;
          });

          uploaded++;
        } catch (err: unknown) {
          console.error(`[Upload] Failed for ${pf.file.name}:`, err instanceof Error ? err.message : 'Upload failed');

          setUploadProgress((prev) => {
            const updated = [...prev];
            updated[i] = { fileName: pf.file.name, status: "failed", progress: 0 };
            return updated;
          });

          failed++;
        }
      }

      setIsUploading(false);
      return { success: failed === 0, uploaded, failed };
    },
    [storageUpload, docCreate],
  );

  const reset = useCallback(() => {
    setUploadProgress([]);
    setIsUploading(false);
  }, []);

  return {
    uploadFiles,
    uploadProgress,
    isUploading,
    reset,
  };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
