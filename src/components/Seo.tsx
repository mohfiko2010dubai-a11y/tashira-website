import { Helmet } from 'react-helmet-async';

interface SeoProps {
  title: string;
  description?: string | null;
  canonicalPath: string;
  robots?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImage?: string | null;
  /** Absolute alternates per locale, e.g. { en: '/uae-visa', ar: '/uae-visa' } */
  alternates?: { en?: string; ar?: string };
  jsonLd?: Record<string, unknown> | null;
  lang: string;
}

const ORIGIN = 'https://tashiraev.com';

export default function Seo({ title, description, canonicalPath, robots, ogTitle, ogDescription, ogImage, alternates, jsonLd, lang }: SeoProps) {
  const canonical = `${ORIGIN}${canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`}`;
  return (
    <Helmet>
      <title>{title}</title>
      {description ? <meta name="description" content={description} /> : null}
      <link rel="canonical" href={canonical} />
      {robots ? <meta name="robots" content={robots} /> : null}
      <meta property="og:title" content={ogTitle || title} />
      {ogDescription || description ? <meta property="og:description" content={ogDescription || description || ''} /> : null}
      <meta property="og:url" content={canonical} />
      <meta property="og:type" content="article" />
      {ogImage ? <meta property="og:image" content={ogImage} /> : null}
      <meta property="og:locale" content={lang === 'ar' ? 'ar_AE' : 'en_US'} />
      <meta property="og:locale:alternate" content={lang === 'ar' ? 'en_US' : 'ar_AE'} />
      {alternates?.en ? <link rel="alternate" hrefLang="en" href={`${ORIGIN}${alternates.en}`} /> : null}
      {alternates?.ar ? <link rel="alternate" hrefLang="ar" href={`${ORIGIN}${alternates.ar}`} /> : null}
      <link rel="alternate" hrefLang="x-default" href={`${ORIGIN}${alternates?.en || canonicalPath}`} />
      {jsonLd ? <script type="application/ld+json">{JSON.stringify(jsonLd)}</script> : null}
    </Helmet>
  );
}
