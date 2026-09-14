import type { CSSProperties } from 'react';
import type { DocumentUploadProgress } from '@contracts/document-upload-policy';
import { uploadDisplayPercent } from '@contracts/upload-progress';

export function UploadProgress({ progress, name, ar, error, retry, disabled }: {
  progress: DocumentUploadProgress; name: string; ar: boolean; error?: string; retry?: () => void; disabled?: boolean;
}) {
  const percent = uploadDisplayPercent(progress);
  const verifying = progress.phase === 'processing' || progress.phase === 'saving';
  const accepted = progress.phase === 'accepted';
  const label = accepted ? (ar ? 'تم الاستلام والتحقّق' : 'Received and verified')
    : progress.phase === 'failed' ? (ar ? 'فشل الرفع' : 'Upload failed')
    : progress.phase === 'processing' && /\.hei[cf]$/iu.test(name) ? (ar ? 'جارٍ تحويل الصورة' : 'Converting photo')
    : verifying ? (ar ? 'جارٍ التحقّق من الملف' : 'Verifying file')
    : progress.phase === 'preparing' ? (ar ? 'جارٍ تجهيز الملف' : 'Preparing file') : (ar ? 'جارٍ الرفع' : 'Uploading');
  return <div className="upload-feedback" data-state={progress.phase} style={{ '--p': `${percent ?? 0}%`, '--fraction': (percent ?? 0) / 100 } as CSSProperties}>
    <div className="upload-feedback-row">
      <span className="upload-gateway" aria-hidden="true">{[false, true].map(fill => <svg key={String(fill)} className={fill ? 'upload-fill' : 'upload-muted'} viewBox="30 2 140 180" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round">
        <path d="M40 172 V104 C40 70 68 46 100 24 C132 46 160 70 160 104 V172 M70 172 V104 C70 88 86 76 100 61.5 C114 76 130 88 130 104 V172" />
      </svg>)}</span>
      <span className="upload-filename">{name}</span>
      {retry && error && <button type="button" disabled={disabled} onClick={retry}>{ar ? 'إعادة المحاولة' : 'Retry'}</button>}
    </div>
    <div className="upload-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={label}>
      <span className={verifying || percent === undefined ? 'upload-shuttle' : ''} />
    </div>
    <div className="upload-feedback-row" role="status" aria-live="polite">
      <span>{accepted && <svg className="upload-check" viewBox="0 0 24 24" aria-hidden="true"><path pathLength="1" d="M4 12.5 9.5 18 20 6.5" /></svg>}{label}</span>
      <span>{percent === undefined ? '—' : `${percent.toLocaleString(ar ? 'ar' : 'en')}%`}</span>
    </div>
    {error && <p role="alert">{error}</p>}
  </div>;
}
