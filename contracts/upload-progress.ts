import type { DocumentUploadProgress } from './document-upload-policy';

/** Transmission is only 96% of the operation; evidence acceptance owns 100%. */
export function uploadDisplayPercent(progress: DocumentUploadProgress): number | undefined {
  if (progress.phase === 'accepted') return 100;
  if (progress.phase === 'failed' || progress.phase === 'preparing') return 0;
  if (progress.phase === 'processing' || progress.phase === 'saving') return 96;
  return progress.percent === undefined || !Number.isFinite(progress.percent)
    ? undefined : Math.max(0, Math.min(96, Math.round(progress.percent * .96)));
}
