import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import DOMPurify from 'dompurify';

interface LegalProps {
  page: 'terms' | 'privacy' | 'refund' | 'cookies';
}

const pageMeta: Record<string, { title: string; desc: string }> = {
  terms: {
    title: 'Terms & Conditions | Tashira E-Visa Portal',
    desc: 'Read Tashira terms and conditions for UAE visa application services.',
  },
  privacy: {
    title: 'Privacy Policy | Tashira E-Visa Portal',
    desc: 'Learn how Tashira protects your personal data and privacy.',
  },
  refund: {
    title: 'Refund Policy | Tashira E-Visa Portal',
    desc: 'Understand Tashira refund and cancellation policy for UAE visa applications.',
  },
  cookies: {
    title: 'Cookie Policy | Tashira E-Visa Portal',
    desc: 'Learn about cookies and how Tashira uses them.',
  },
};

export default function Legal({ page }: LegalProps) {
  const { t } = useTranslation('legal');

  const title = t(`${page}.title`);
  const content = t(`${page}.content`);
  const meta = pageMeta[page];
  const sanitizedContent = DOMPurify.sanitize(content);

  return (
    <>
      <Helmet>
        <title>{meta.title}</title>
        <meta name="description" content={meta.desc} />
        <link rel="canonical" href={`https://tashiraev.com/${page === 'terms' ? 'terms' : page === 'privacy' ? 'privacy' : page === 'refund' ? 'refund' : 'cookies'}`} />
      </Helmet>
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
    </>
  );
}
