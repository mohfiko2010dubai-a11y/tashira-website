import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// All language imports
import enCommon from './locales/en/common.json';
import enHome from './locales/en/home.json';
import enPricing from './locales/en/pricing.json';
import enHowToApply from './locales/en/howToApply.json';
import enTrack from './locales/en/track.json';
import enLegal from './locales/en/legal.json';
import enSaudiVisa from './locales/en/saudiVisa.json';
import enTravelDeals from './locales/en/travelDeals.json';
import enWizard from './locales/en/wizard.json';

import arCommon from './locales/ar/common.json';
import arHome from './locales/ar/home.json';
import arPricing from './locales/ar/pricing.json';
import arHowToApply from './locales/ar/howToApply.json';
import arTrack from './locales/ar/track.json';
import arLegal from './locales/ar/legal-v2.json';
import arSaudiVisa from './locales/ar/saudiVisa.json';
import arTravelDeals from './locales/ar/travelDeals.json';
import arWizard from './locales/ar/wizard.json';

// Build resources from all available languages
const enResources = {
  common: enCommon,
  home: enHome,
  pricing: enPricing,
  howToApply: enHowToApply,
  track: enTrack,
  legal: enLegal,
  saudiVisa: enSaudiVisa,
  travelDeals: enTravelDeals,
  wizard: enWizard,
};

const arResources = {
  common: arCommon,
  home: arHome,
  pricing: arPricing,
  howToApply: arHowToApply,
  track: arTrack,
  legal: arLegal,
  saudiVisa: arSaudiVisa,
  travelDeals: arTravelDeals,
  wizard: arWizard,
};

// All languages use English fallback for missing keys
const resources: Record<string, typeof enResources | typeof arResources> = {
  en: enResources,
  ar: arResources,
  // All other languages fallback to English
  fr: enResources,
  es: enResources,
  de: enResources,
  tr: enResources,
  pt: enResources,
  it: enResources,
  ru: enResources,
  zh: enResources,
  ja: enResources,
  ko: enResources,
  hi: enResources,
  ur: arResources, // Urdu uses Arabic as base (RTL)
  id: enResources,
  th: enResources,
  vi: enResources,
  ms: enResources,
  fa: arResources, // Persian uses Arabic as base (RTL)
  nl: enResources,
  pl: enResources,
  sv: enResources,
  el: enResources,
  he: arResources, // Hebrew uses Arabic as base (RTL)
  bn: enResources,
  ta: enResources,
  tl: enResources,
  uk: enResources,
  ro: enResources,
  hu: enResources,
};

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

export default i18n;
