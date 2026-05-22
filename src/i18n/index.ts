import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enCommon from './locales/en/common.json';
import enHome from './locales/en/home.json';
import enPricing from './locales/en/pricing.json';
import enHowToApply from './locales/en/howToApply.json';
import enTrack from './locales/en/track.json';
import enLegal from './locales/en/legal.json';
import enSaudiVisa from './locales/en/saudiVisa.json';

import arCommon from './locales/ar/common.json';
import arHome from './locales/ar/home.json';
import arPricing from './locales/ar/pricing.json';
import arHowToApply from './locales/ar/howToApply.json';
import arTrack from './locales/ar/track.json';
import arLegal from './locales/ar/legal.json';
import arSaudiVisa from './locales/ar/saudiVisa.json';

const resources = {
  en: {
    common: enCommon,
    home: enHome,
    pricing: enPricing,
    howToApply: enHowToApply,
    track: enTrack,
    legal: enLegal,
    saudiVisa: enSaudiVisa,
  },
  ar: {
    common: arCommon,
    home: arHome,
    pricing: arPricing,
    howToApply: arHowToApply,
    track: arTrack,
    legal: arLegal,
    saudiVisa: arSaudiVisa,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
