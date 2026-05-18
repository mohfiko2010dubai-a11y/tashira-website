import { useTranslation } from 'react-i18next';
import DOMPurify from 'dompurify';

interface LegalProps {
  page: 'terms' | 'privacy' | 'refund' | 'cookies';
}

export default function Legal({ page }: LegalProps) {
  const { t } = useTranslation('legal');

  const title = t(`${page}.title`);
  const content = t(`${page}.content`);

  const sanitizedContent = DOMPurify.sanitize(content);

  return (
    <div className="min-h-screen">
      {/* Page Header */}
      <div
        className="pt-32 pb-12 px-4 text-center"
        style={{ background: 'linear-gradient(180deg, #FAFAF7, #F0EDE8)' }}
      >
        <h1 className="text-3xl sm:text-4xl font-bold text-[#1A2332]">{title}</h1>
        <div className="w-16 h-[3px] mx-auto mt-4 rounded-full" style={{ background: 'linear-gradient(90deg, #C9A04C, #DDBB7A)' }} />
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <div
          className="prose prose-lg max-w-none legal-content"
          dangerouslySetInnerHTML={{ __html: sanitizedContent }}
        />
      </div>
    </div>
  );
}
