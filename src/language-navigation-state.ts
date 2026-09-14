import { motionCommit } from "./lib/motion";
import { createContext, useContext } from "react";
import { createPath, type Location, type Navigator } from "react-router-dom";
import { flushSync } from "react-dom";
import { languagePath, languageRoute, type SiteLanguage } from "@contracts/language-routes";

export type Navigation = { subscribe: (listener: () => void) => () => void; snapshot: () => Location; navigator: Navigator; switchLanguage: (language: SiteLanguage) => void };
export const LanguageNavigation = createContext<((language: SiteLanguage) => void) | null>(null);
export const useLanguageNavigation = () => useContext(LanguageNavigation);

/** Called from browser bootstrap, never from a component's first render. */
export function createLanguageNavigation(): Navigation {
  const read = (): Location => ({ pathname: window.location.pathname, search: window.location.search, hash: window.location.hash, state: window.history.state?.usr ?? null, key: window.history.state?.key ?? "initial" });
  let location = read();
  let historyIndex = Number(window.history.state?.motionIndex ?? 0);
  window.history.replaceState({ ...window.history.state, motionIndex: historyIndex }, "");
  const listeners = new Set<() => void>();
  const publish = () => {
    location = read();
    const language = languageRoute(location.pathname).language;
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    listeners.forEach(listener => listener());
  };
  window.addEventListener("popstate", () => {
    const nextIndex = Number(window.history.state?.motionIndex ?? historyIndex - 1);
    const back = nextIndex < historyIndex; historyIndex = nextIndex;
    motionCommit(publish, back);
  });
  const commit = (to: Parameters<Navigator["push"]>[0], state: unknown, replace: boolean) => {
    const href = typeof to === "string" ? to : createPath(to);
    const data = { usr: state, key: crypto.randomUUID(), motionIndex: replace ? historyIndex : ++historyIndex };
    if (replace) window.history.replaceState(data, "", href); else window.history.pushState(data, "", href);
    const targetPath = new URL(href, window.location.href).pathname.replace(/^\/(en|ar)(?=\/|$)/, "");
    if (/^\/(admin|staff|login|dashboard)(\/|$)/.test(targetPath)) publish(); else motionCommit(publish);
  };
  return {
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, snapshot: () => location,
    navigator: { createHref: to => typeof to === "string" ? to : createPath(to), go: delta => window.history.go(delta), push: (to, state) => commit(to, state, false), replace: (to, state) => commit(to, state, true) },
    switchLanguage: language => {
      const href = languagePath(location.pathname, language) + location.search + location.hash;
      window.history.replaceState(window.history.state, "", href);
      flushSync(() => { document.documentElement.lang = language; document.documentElement.dir = language === "ar" ? "rtl" : "ltr"; publish(); });
    },
  };
}
