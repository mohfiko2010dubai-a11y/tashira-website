import { ApplicationDomScope } from "@/components/customer/ApplicationDomScope";
import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { I18nextProvider, useTranslation } from "react-i18next";
import { HelmetProvider } from "react-helmet-async";
import { TRPCProvider } from "@/providers/trpc";
import DynamicApplicationStart from "@/pages/DynamicApplicationStart";
import DynamicApplication from "@/pages/DynamicApplication";
import PaymentPage from "@/pages/PaymentPage";
import { languageRoute } from "@contracts/language-routes";

/** A separate React root permits an independent router without a nested browser router or iframe.
 * The actual wizard pages, session, query cache, uploads and payment gates are reused unchanged. */
function RememberApplication() {
  const location = useLocation();
  useEffect(() => {
    const referenceNumber = /\/apply\/(TSH-[A-Z0-9-]+)\/interview/i.exec(location.pathname)?.[1];
    if (!referenceNumber) return;
    try { localStorage.setItem("tashira_assistant_reference", referenceNumber); window.dispatchEvent(new Event("storage")); } catch { /* Secure email resume remains available. */ }
  }, [location.pathname]);
  return null;
}

export default function AssistantApplication({ initialPath }: { initialPath: string }) {
  const container = useRef<HTMLDivElement>(null);
  const { i18n } = useTranslation();
  const initial = useRef(initialPath);
  const applicationRoot = useRef<ReturnType<typeof createRoot> | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
    applicationRoot.current ??= createRoot(container.current!, { identifierPrefix: "assistant-" });
    applicationRoot.current.render(<TRPCProvider><I18nextProvider i18n={i18n}><HelmetProvider>
      <MemoryRouter initialEntries={[languageRoute(initial.current).pathname]}>
        <RememberApplication /><ApplicationDomScope.Provider value={container.current}>
        <Routes>
          <Route path="/apply" element={<DynamicApplicationStart />} />
          <Route path="/apply/:referenceNumber/interview" element={<DynamicApplication />} />
          <Route path="/pay/:referenceNumber" element={<PaymentPage />} />
          <Route path="/" element={<DynamicApplicationStart />} />
          <Route path="*" element={<a href={initial.current}>{i18n.language.startsWith("ar") ? "افتح الطلب في صفحة مستقلة" : "Open application in a full page"}</a>} />
        </Routes></ApplicationDomScope.Provider>
      </MemoryRouter>
    </HelmetProvider></I18nextProvider></TRPCProvider>);
    }, 0);
    return () => clearTimeout(timer);
  }, [i18n]);
  useEffect(() => () => { const root = applicationRoot.current; applicationRoot.current = null; if (root) queueMicrotask(() => root.unmount()); }, []);
  return <div ref={container} data-assistant-application className="relative isolate [transform:translateZ(0)] [--site-header-height:0px] [&_[data-application-layout]_aside]:hidden" />;
}
