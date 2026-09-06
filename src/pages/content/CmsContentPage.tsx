import { useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { trpc } from '@/providers/trpc-client';
import Seo from '@/components/Seo';
import { trackContentEvent } from '@/lib/content-analytics';

type BodyBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'faq'; items: { q: string; a: string }[] }
  | { type: 'cta'; label: string; href: string };

interface CmsContentPageProps {
  /** Full slug path, e.g. "uae-visa/14-days" or "guides/how-to-apply" */
  slug: string;
  contentType: 'LANDING' | 'GUIDE' | 'NEWS';
  /** Visa context forwarded to the application journey, e.g. "14-days" */
  visaContext?: string;
}

function renderBlock(block: BodyBlock, index: number, onCta: (href: string) => void) {
  switch (block.type) {
    case 'heading':
      return <h2 key={index} className="mt-10 mb-4 text-2xl font-bold text-[#0A1628]">{block.text}</h2>;
    case 'paragraph':
      return <p key={index} className="mb-4 leading-relaxed text-gray-700">{block.text}</p>;
    case 'list':
      return (
        <ul key={index} className="mb-6 list-disc space-y-2 ps-6 text-gray-700">
          {block.items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      );
    case 'faq':
      return (
        <div key={index} className="mb-8 space-y-4">
          {block.items.map((f, i) => (
            <details key={i} className="rounded-xl border border-[#C9A04C]/30 bg-white p-4">
              <summary className="cursor-pointer font-semibold text-[#0A1628]">{f.q}</summary>
              <p className="mt-2 text-gray-700">{f.a}</p>
            </details>
          ))}
        </div>
      );
    case 'cta':
      return (
        <button
          key={index}
          onClick={() => onCta(block.href)}
          className="my-6 rounded-xl bg-[#C9A04C] px-8 py-3 font-semibold text-[#0A1628] transition hover:bg-[#DDBB7A]"
        >
          {block.label}
        </button>
      );
    default:
      return null;
  }
}

export default function CmsContentPage({ slug, contentType, visaContext }: CmsContentPageProps) {
  const { t, i18n } = useTranslation('content');
  const navigate = useNavigate();
  const language = i18n.language?.startsWith('ar') ? 'ar' : 'en';

  const query = trpc.content.publicBySlug.useQuery({ language, slug }, { retry: false });
  const item = query.data;

  const relatedQuery = trpc.content.publicList.useQuery(
    { contentType: 'GUIDE', language },
    { enabled: contentType !== 'GUIDE' },
  );

  useEffect(() => {
    if (!item) return;
    trackContentEvent(contentType === 'LANDING' ? 'landing_page_view' : 'guide_view', {
      content_type: contentType,
      language,
      slug,
    });
  }, [item, contentType, language, slug]);

  const breadcrumbs = useMemo(() => {
    const parts = slug.split('/');
    return parts.slice(0, -1).map((part, i) => ({
      label: part.replace(/-/g, ' '),
      href: `/${parts.slice(0, i + 1).join('/')}`,
    }));
  }, [slug]);

  const handleCta = (href: string) => {
    trackContentEvent('landing_cta_click', { content_type: contentType, language, slug, cta_target: href });
    if (href === '/apply' && visaContext) {
      navigate(`/apply?visa=${encodeURIComponent(visaContext)}`);
    } else if (href === '/visa-pre-check') {
      trackContentEvent('visa_precheck_start', { content_type: contentType, language, slug });
      navigate(href);
    } else {
      navigate(href);
    }
  };

  if (query.isLoading) {
    return <div className="mx-auto max-w-3xl px-4 py-20 text-center text-gray-500">…</div>;
  }

  if (!item) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-3xl font-bold text-[#0A1628]">{t('notFoundTitle')}</h1>
        <p className="mt-4 text-gray-600">{t('notFoundBody')}</p>
        <Link to="/apply" className="mt-6 inline-block rounded-xl bg-[#C9A04C] px-8 py-3 font-semibold text-[#0A1628]">
          {t('ctaApply')}
        </Link>
      </div>
    );
  }

  const blocks = (Array.isArray(item.bodyBlocks) ? item.bodyBlocks : []) as BodyBlock[];
  const alternates = item.alternateSlug
    ? { [language]: `/${slug}`, [item.alternateLanguage]: `/${item.alternateSlug}` } as { en?: string; ar?: string }
    : { [language]: `/${slug}` } as { en?: string; ar?: string };

  return (
    <div className="bg-[#FAFAF7]">
      <Seo
        title={item.seoTitle || item.title}
        description={item.metaDescription || item.excerpt}
        canonicalPath={`/${slug}`}
        robots={item.robots}
        ogTitle={item.ogTitle}
        ogDescription={item.ogDescription}
        ogImage={item.ogImage}
        alternates={alternates}
        jsonLd={item.structuredData as Record<string, unknown> | null}
        lang={language}
      />

      {/* Hero */}
      <header className="bg-gradient-to-br from-[#0A1628] to-[#12233d] py-14 text-white">
        <div className="mx-auto max-w-3xl px-4">
          <nav className="mb-4 text-sm text-white/60">
            <Link to="/" className="hover:text-[#DDBB7A]">{t('breadcrumbHome')}</Link>
            {breadcrumbs.map((b) => (
              <span key={b.href}> / <Link to={b.href} className="capitalize hover:text-[#DDBB7A]">{b.label}</Link></span>
            ))}
            <span className="text-white/40"> / {item.title}</span>
          </nav>
          {contentType === 'NEWS' && (
            <span className="mb-3 inline-block rounded-full bg-[#C9A04C]/20 px-3 py-1 text-xs font-semibold text-[#DDBB7A]">
              {t('newsBadge')}
            </span>
          )}
          <h1 className="text-3xl font-bold leading-tight md:text-4xl">{item.title}</h1>
          {item.excerpt && <p className="mt-4 text-lg text-white/80">{item.excerpt}</p>}
          {contentType === 'NEWS' && (
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-white/60">
              {item.author && <span>{t('author')}: {item.author}</span>}
              {item.reviewer && <span>{t('reviewer')}: {item.reviewer}</span>}
              {item.sourceAuthority && (
                <span>
                  {t('source')}: {item.sourceUrl
                    ? <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">{item.sourceAuthority}</a>
                    : item.sourceAuthority}
                </span>
              )}
              {item.lastVerifiedAt && <span>{t('verifiedAt')}: {String(item.lastVerifiedAt).slice(0, 10)}</span>}
            </div>
          )}
        </div>
      </header>

      {/* Disclosure — Google Ads policy safety, always visible */}
      <div className="border-b border-[#C9A04C]/20 bg-[#C9A04C]/10">
        <p className="mx-auto max-w-3xl px-4 py-3 text-sm text-[#0A1628]/80">{t('disclosure')}</p>
      </div>

      {item.syntheticLabel && (
        <div className="bg-amber-100">
          <p className="mx-auto max-w-3xl px-4 py-2 text-xs font-mono text-amber-800">{t('syntheticNotice')}</p>
        </div>
      )}

      {/* Body */}
      <main className="mx-auto max-w-3xl px-4 py-10">
        {item.heroImage && (
          <img src={item.heroImage} alt={item.heroImageAlt || item.title} className="mb-8 w-full rounded-2xl object-cover" />
        )}
        {blocks.map((b, i) => renderBlock(b, i, handleCta))}

        {contentType !== 'NEWS' && (
          <div className="mt-10 rounded-2xl bg-[#0A1628] p-8 text-center text-white">
            <button
              onClick={() => handleCta('/apply')}
              className="rounded-xl bg-[#C9A04C] px-10 py-4 text-lg font-bold text-[#0A1628] transition hover:bg-[#DDBB7A]"
            >
              {t('ctaApply')}
            </button>
            <div className="mt-3">
              <button onClick={() => handleCta('/visa-pre-check')} className="text-sm text-white/70 underline hover:text-[#DDBB7A]">
                {t('ctaCheck')}
              </button>
            </div>
          </div>
        )}

        {/* Related guides */}
        {relatedQuery.data && relatedQuery.data.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 text-xl font-bold text-[#0A1628]">{t('relatedTitle')}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {relatedQuery.data.slice(0, 4).map((g) => (
                <Link
                  key={g.slug}
                  to={`/${g.slug}`}
                  onClick={() => trackContentEvent('related_content_click', { content_type: 'GUIDE', language, slug: g.slug })}
                  className="rounded-xl border border-[#C9A04C]/30 bg-white p-4 transition hover:border-[#C9A04C]"
                >
                  <h3 className="font-semibold text-[#0A1628]">{g.title}</h3>
                  {g.excerpt && <p className="mt-1 text-sm text-gray-600">{g.excerpt}</p>}
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
