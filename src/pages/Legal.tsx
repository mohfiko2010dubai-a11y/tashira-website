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
  const { t, i18n } = useTranslation('legal');

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
        {page === 'terms' && (
          <div className="prose prose-lg mt-6 max-w-none legal-content">
            <h2>{i18n.language.startsWith('ar') ? 'ملحق تفويض الدافع - ساري من 19 أغسطس 2026' : 'Payer Authorization Addendum - Effective 19 August 2026'}</h2>
            <p>
              {i18n.language.startsWith('ar')
                ? 'يجوز أن يتم الدفع بواسطة طرف ثالث مفوض نيابةً عن مقدم أو مقدمي الطلب. يؤكد الدافع أنه مخول باستخدام وسيلة الدفع وأنه يصرح بالدفع مقابل الخدمات المرتبطة بالطلب المحدد. لا يؤثر ذلك في حقوق المستهلك الإلزامية.'
                : 'Payment may be made by an authorized third party on behalf of the applicant(s). The payer confirms authorization to use the payment method and authorizes payment for the services associated with the identified application. This does not limit mandatory consumer rights.'}
            </p>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
