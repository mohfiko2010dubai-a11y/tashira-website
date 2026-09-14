import type { PageMetadata } from './ssr-pages';

export function socialMetadata(meta: PageMetadata, assetOrigin = 'https://www.tashiraev.com') {
  const language = meta.language === 'ar' ? 'ar' : 'en';
  const image = new URL(meta.image || `/og/${language}/home.jpg`, assetOrigin).href;
  return {
    'og:title': meta.title, 'og:description': meta.description,
    'og:url': `https://www.tashiraev.com${meta.canonicalPath}`, 'og:type': 'website',
    'og:locale': language === 'ar' ? 'ar_AE' : 'en_AE',
    'og:image': image, 'og:image:width': '1200', 'og:image:height': '630',
    'og:image:alt': meta.title,
    'twitter:card': 'summary_large_image', 'twitter:title': meta.title,
    'twitter:description': meta.description, 'twitter:image': image, 'twitter:image:alt': meta.title,
  };
}
