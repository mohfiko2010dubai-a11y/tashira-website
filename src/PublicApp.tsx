import PageHead from "./components/PageHead";
import { useSyncExternalStore } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { fixedMetadata } from "@contracts/ssr-pages";
import Header from "@/components/shared/Header";
import Footer from "@/components/shared/Footer";
import ScrollToTop from "@/components/shared/ScrollToTop";
import ChatBot from "@/components/shared/ChatBot";
import Home from "@/pages/Home";
import Pricing from "@/pages/Pricing";
import HowToApply from "@/pages/HowToApply";
import Track from "@/pages/Track";
import Legal from "@/pages/Legal";
import Contact from "@/pages/Contact";
import DynamicApplicationStart from "@/pages/DynamicApplicationStart";
import CustomerPrecheck from "@/pages/CustomerPrecheck";
import StaticInfoPage from "@/pages/content/StaticInfoPage";
import ContentIndexPage from "@/pages/content/ContentIndexPage";
import CmsContentPageWrapper from "@/pages/content/CmsContentPageWrapper";
import LandingRoute from "@/pages/content/LandingRoute";

const subscribeToClient = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export default function PublicApp() {
  const location = useLocation();
  const { i18n } = useTranslation();
  const mounted = useSyncExternalStore(subscribeToClient, clientSnapshot, serverSnapshot);
  const meta = fixedMetadata(location.pathname, i18n.language);
  return <HelmetProvider><div className={`min-h-screen bg-white ${i18n.language.startsWith("ar") ? "font-tajawal" : "font-inter"}`}>
    <Header />
    <main className={/^\/(apply|guides|news|about|editorial-policy|sources-and-verification|uae-visa)(\/|$)/.test(location.pathname) ? "site-header-clearance" : undefined}><Routes>
      <Route path="/" element={<Home />} />
      <Route path="/visa-prices" element={<Pricing />} />
      <Route path="/how-to-apply" element={<HowToApply />} />
      <Route path="/apply" element={<DynamicApplicationStart />} />
      <Route path="/track" element={<Track />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/visa-pre-check" element={<CustomerPrecheck />} />
      <Route path="/guides" element={<ContentIndexPage type="GUIDE" />} />
      <Route path="/news" element={<ContentIndexPage type="NEWS" />} />
      <Route path="/guides/:slug" element={<CmsContentPageWrapper type="GUIDE" />} />
      <Route path="/news/:slug" element={<CmsContentPageWrapper type="NEWS" />} />
      <Route path="/uae-visa/:slug" element={<LandingRoute />} />
      <Route path="/about" element={<StaticInfoPage page="about" />} />
      <Route path="/editorial-policy" element={<StaticInfoPage page="editorial" />} />
      <Route path="/sources-and-verification" element={<StaticInfoPage page="sources" />} />
      {(["terms", "privacy", "refund", "cookies"] as const).map(page => <Route key={page} path={`/${page}`} element={<Legal page={page} />} />)}
    </Routes></main>
    {meta && <PageHead title={meta.title} description={meta.description} canonicalPath={meta.canonicalPath} robots={["/apply", "/track"].includes(location.pathname) ? "noindex" : undefined} />}
    <Footer />
    {mounted && <><ScrollToTop /><ChatBot key={location.search.includes("resume=1") ? "resume" : "default"} /></>}
  </div></HelmetProvider>;
}
