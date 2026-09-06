import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import Seo from '@/components/Seo';

type PageKey = 'about' | 'editorial' | 'sources';

const PATHS: Record<PageKey, string> = {
  about: '/about',
  editorial: '/editorial-policy',
  sources: '/sources-and-verification',
};

export default function StaticInfoPage({ page }: { page: PageKey }) {
  const { t, i18n } = useTranslation('content');
  const language = i18n.language?.startsWith('ar') ? 'ar' : 'en';
  const title = t(`${page}.title`);
  const body = t(`${page}.body`);

  return (
    <div className="bg-[#FAFAF7]">
      <Seo
        title={`${title} | TASHIRA`}
        description={body.slice(0, 155)}
        canonicalPath={PATHS[page]}
        lang={language}
      />
      <header className="bg-gradient-to-br from-[#0A1628] to-[#12233d] py-14 text-white">
        <div className="mx-auto max-w-3xl px-4">
          <nav className="mb-4 text-sm text-white/60">
            <Link to="/" className="hover:text-[#DDBB7A]">{t('breadcrumbHome')}</Link>
            <span className="text-white/40"> / {title}</span>
          </nav>
          <h1 className="text-3xl font-bold md:text-4xl">{title}</h1>
        </div>
      </header>
      <div className="border-b border-[#C9A04C]/20 bg-[#C9A04C]/10">
        <p className="mx-auto max-w-3xl px-4 py-3 text-sm text-[#0A1628]/80">{t('disclosure')}</p>
      </div>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="leading-relaxed text-gray-700">{body}</p>
        <div className="mt-10 rounded-2xl bg-[#0A1628] p-8 text-center">
          <Link to="/apply" className="inline-block rounded-xl bg-[#C9A04C] px-10 py-4 text-lg font-bold text-[#0A1628] transition hover:bg-[#DDBB7A]">
            {t('ctaApply')}
          </Link>
        </div>
      </main>
    </div>
  );
}
