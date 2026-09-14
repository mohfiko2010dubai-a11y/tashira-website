import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { trpc } from '@/providers/trpc-client';
import Seo from '@/components/Seo';
import Logo from '@/components/shared/Logo';

/** Public index page for /guides and /news — lists published content only. */
export default function ContentIndexPage({ type }: { type: 'GUIDE' | 'NEWS' }) {
  const { t, i18n } = useTranslation('content');
  const language = i18n.language?.startsWith('ar') ? 'ar' : 'en';
  const query = trpc.content.publicList.useQuery({ contentType: type, language });

  const title = type === 'GUIDE' ? t('guidesIndexTitle') : t('newsIndexTitle');
  const subtitle = type === 'GUIDE' ? t('guidesIndexSubtitle') : t('newsIndexSubtitle');
  const path = type === 'GUIDE' ? '/guides' : '/news';

  return (
    <div className="bg-[#FAFAF7]">
      <Seo title={`${title} | TASHIRA`} description={subtitle} canonicalPath={path} lang={language} />
      <header className="bg-gradient-to-br from-[#0A1628] to-[#12233d] py-14 text-white">
        <div className="mx-auto max-w-4xl px-4">
          <nav className="mb-4 text-sm text-white/60">
            <Link to="/" className="hover:text-[#DDBB7A]">{t('breadcrumbHome')}</Link>
            <span className="text-white/40"> / {title}</span>
          </nav>
          <h1 className="text-3xl font-bold md:text-4xl">{title}</h1>
          <p className="mt-3 text-white/75">{subtitle}</p>
        </div>
      </header>
      <div className="border-b border-[#C9A04C]/20 bg-[#C9A04C]/10">
        <p className="mx-auto max-w-4xl px-4 py-3 text-sm text-[#0A1628]/80">{t('disclosure')}</p>
      </div>
      <main className="mx-auto max-w-4xl px-4 py-10">
        {query.isLoading && <p className="text-center text-gray-400"><Logo variant="mark-only" watermark size={26} />…</p>}
        {query.data && query.data.length === 0 && (
          <p className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-500"><Logo variant="mark-only" watermark size={26} />{t('indexEmpty')}</p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {query.data?.map((item) => (
            <Link
              key={item.slug}
              to={`/${item.slug}`}
              className="rounded-2xl border border-[#C9A04C]/30 bg-white p-5 transition hover:border-[#C9A04C] hover:shadow-sm"
            >
              {type === 'NEWS' && (
                <span className="mb-2 inline-block rounded-full bg-[#C9A04C]/15 px-3 py-1 text-xs font-semibold text-[#9b7425]">
                  {t('newsBadge')}
                </span>
              )}
              <h2 className="text-lg font-bold text-[#0A1628]">{item.title}</h2>
              {item.excerpt && <p className="mt-2 text-sm leading-relaxed text-gray-600">{item.excerpt}</p>}
            </Link>
          ))}
        </div>
        <div className="mt-10 rounded-2xl bg-[#0A1628] p-8 text-center">
          <Link to="/apply" className="inline-block rounded-xl bg-[#C9A04C] px-10 py-4 text-lg font-bold text-[#0A1628] transition hover:bg-[#DDBB7A]">
            {t('ctaApply')}
          </Link>
        </div>
      </main>
    </div>
  );
}
