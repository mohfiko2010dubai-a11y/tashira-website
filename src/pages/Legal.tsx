import { useTranslation } from 'react-i18next';
import { validatedLegalHtml } from '@/lib/legal-html';
import { languagePath } from '@contracts/language-routes';
import { processingCopy } from '@contracts/processing-copy';

interface LegalProps {
  page: 'terms' | 'privacy' | 'refund' | 'cookies';
}

export default function Legal({ page }: LegalProps) {
  const { t, i18n } = useTranslation('legal');

  const title = t(`${page}.title`);
  const content = t(`${page}.content`);
  const sanitizedContent = validatedLegalHtml(content).replace(/href=(["'])(\/(?!\/)[^"']*)\1/g, (_match, quote: string, href: string) => `href=${quote}${languagePath(href, i18n.language.startsWith('ar') ? 'ar' : 'en')}${quote}`);

  return (
    <>
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
        {(page === 'terms' || page === 'refund') && <section className="prose prose-lg mt-6 max-w-none legal-content">
          <h2>{i18n.language.startsWith('ar') ? 'ضمان إرسال الطلب — ساري من 30 سبتمبر 2026' : 'Submission guarantee — effective 30 September 2026'}</h2>
          <p>{processingCopy(i18n.language).regular}</p><p>{processingCopy(i18n.language).express}</p>
        </section>}
      </div>
    </div>
    </>
  );
}
