import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Pre-loaded English and Arabic (primary languages)
import enCommon from './locales/en/common.json';
import enHome from './locales/en/home.json';
import enPricing from './locales/en/pricing.json';
import enHowToApply from './locales/en/howToApply.json';
import enTrack from './locales/en/track.json';
import enLegal from './locales/en/legal.json';
import enSaudiVisa from './locales/en/saudiVisa.json';
import enTravelDeals from './locales/en/travelDeals.json';

import arCommon from './locales/ar/common.json';
import arHome from './locales/ar/home.json';
import arPricing from './locales/ar/pricing.json';
import arHowToApply from './locales/ar/howToApply.json';
import arTrack from './locales/ar/track.json';
import arLegal from './locales/ar/legal.json';
import arSaudiVisa from './locales/ar/saudiVisa.json';
import arTravelDeals from './locales/ar/travelDeals.json';

const resources: Record<string, any> = {
  en: {
    common: enCommon,
    home: enHome,
    pricing: enPricing,
    howToApply: enHowToApply,
    track: enTrack,
    legal: enLegal,
    saudiVisa: enSaudiVisa,
    travelDeals: enTravelDeals,
  },
  ar: {
    common: arCommon,
    home: arHome,
    pricing: arPricing,
    howToApply: arHowToApply,
    track: arTrack,
    legal: arLegal,
    saudiVisa: arSaudiVisa,
    travelDeals: arTravelDeals,
  },
};

// Lazy-load other languages from JSON files
const lazyLanguages = [
  'fr', 'es', 'de', 'tr', 'pt', 'it', 'ru', 'zh', 'ja', 'ko',
  'hi', 'ur', 'id', 'th', 'vi', 'ms', 'fa', 'nl', 'pl', 'sv',
  'el', 'he', 'bn', 'ta', 'tl', 'uk', 'ro', 'hu',
];

async function loadLanguage(lang: string) {
  try {
    const modules = await Promise.all([
      import(`./locales/${lang}/common.json`).catch(() => null),
      import(`./locales/${lang}/home.json`).catch(() => null),
      import(`./locales/${lang}/pricing.json`).catch(() => null),
      import(`./locales/${lang}/howToApply.json`).catch(() => null),
      import(`./locales/${lang}/track.json`).catch(() => null),
      import(`./locales/${lang}/legal.json`).catch(() => null),
      import(`./locales/${lang}/saudiVisa.json`).catch(() => null),
      import(`./locales/${lang}/travelDeals.json`).catch(() => null),
    ]);

    if (modules[0]) {
      resources[lang] = {
        common: modules[0].default || modules[0],
        home: modules[1]?.default || modules[1] || resources.en.home,
        pricing: modules[2]?.default || modules[2] || resources.en.pricing,
        howToApply: modules[3]?.default || modules[3] || resources.en.howToApply,
        track: modules[4]?.default || modules[4] || resources.en.track,
        legal: modules[5]?.default || modules[5] || resources.en.legal,
        saudiVisa: modules[6]?.default || modules[6] || resources.en.saudiVisa,
        travelDeals: modules[7]?.default || modules[7] || resources.en.travelDeals,
      };
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: localStorage.getItem('i18nextLng') || 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

// Pre-load detected language if not en/ar
const detectedLang = localStorage.getItem('i18nextLng') || navigator.language.split('-')[0];
if (detectedLang !== 'en' && detectedLang !== 'ar' && lazyLanguages.includes(detectedLang)) {
  loadLanguage(detectedLang).then((loaded) => {
    if (loaded) {
      i18n.addResources(detectedLang, 'common', resources[detectedLang].common);
      i18n.addResources(detectedLang, 'home', resources[detectedLang].home);
      i18n.addResources(detectedLang, 'pricing', resources[detectedLang].pricing);
      i18n.addResources(detectedLang, 'howToApply', resources[detectedLang].howToApply);
      i18n.addResources(detectedLang, 'track', resources[detectedLang].track);
      i18n.addResources(detectedLang, 'legal', resources[detectedLang].legal);
      i18n.addResources(detectedLang, 'saudiVisa', resources[detectedLang].saudiVisa);
      i18n.addResources(detectedLang, 'travelDeals', resources[detectedLang].travelDeals);
    }
  });
}

export default i18n;
export { loadLanguage };
