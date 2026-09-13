import { useMemo, useSyncExternalStore, type ReactNode } from "react";
import { Router } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { createAppI18n } from "./i18n";
import { languageRoute } from "@contracts/language-routes";
import { LanguageNavigation, type Navigation } from "./language-navigation-state";

export function LocalizedApp({ navigation, children }: { navigation: Navigation; children: ReactNode }) {
  const location = useSyncExternalStore(navigation.subscribe, navigation.snapshot, navigation.snapshot);
  const route = languageRoute(location.pathname);
  const i18n = useMemo(() => createAppI18n(route.language), [route.language]);
  return <I18nextProvider i18n={i18n}><LanguageNavigation.Provider value={navigation.switchLanguage}>
    <Router basename={route.prefixed ? `/${route.language}` : "/"} location={location} navigator={navigation.navigator}>{children}</Router>
  </LanguageNavigation.Provider></I18nextProvider>;
}
