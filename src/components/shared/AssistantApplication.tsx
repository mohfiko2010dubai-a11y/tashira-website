import { ApplicationDomScope } from "@/components/customer/ApplicationDomScope";
import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { I18nextProvider, useTranslation } from "react-i18next";
import { HelmetProvider } from "react-helmet-async";
import { TRPCProvider } from "@/providers/trpc";
import DynamicApplicationStart from "@/pages/DynamicApplicationStart";
import DynamicApplication from "@/pages/DynamicApplication";
import PaymentPage from "@/pages/PaymentPage";
import CustomerApplicationPortal from "@/pages/CustomerApplicationPortal";
import { languagePath, languageRoute } from "@contracts/language-routes";

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

/** Keep secondary destinations reachable without sending a saved order back to step 2. */
function ApplicationDestination({ status = false }: { status?: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const ar = i18n.language.startsWith("ar");
  return <>
    <button type="button" className="min-h-11 px-4 text-sm underline" onClick={() => navigate(-1)}>{ar ? "الرجوع إلى الطلب" : "Back to application"}</button>
    {status ? <CustomerApplicationPortal /> : <a className="block p-4 underline" href={languagePath(location.pathname, ar ? "ar" : "en") + location.search + location.hash} target="_blank" rel="noopener noreferrer">{ar ? "افتح الصفحة في نافذة مستقلة" : "Open this page in a new tab"}</a>}
  </>;
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
          <Route path="/applications/:referenceNumber/status" element={<ApplicationDestination status />} />
          <Route path="/" element={<DynamicApplicationStart />} />
          <Route path="*" element={<ApplicationDestination />} />
        </Routes></ApplicationDomScope.Provider>
      </MemoryRouter>
    </HelmetProvider></I18nextProvider></TRPCProvider>);
    }, 0);
    return () => clearTimeout(timer);
  }, [i18n]);
  useEffect(() => () => { const root = applicationRoot.current; applicationRoot.current = null; if (root) queueMicrotask(() => root.unmount()); }, []);
  return <div ref={container} data-assistant-application className="relative isolate [transform:translateZ(0)] [--site-header-height:0px] [&_[data-application-layout]_aside]:hidden" />;
}
