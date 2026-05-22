import { Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './i18n';
import Header from '@/components/shared/Header';
import Footer from '@/components/shared/Footer';
import ScrollToTop from '@/components/shared/ScrollToTop';
import ChatBot from '@/components/shared/ChatBot';
import GoogleTranslate from '@/components/shared/GoogleTranslate';
import AdminGuard from '@/components/shared/AdminGuard';
import Home from '@/pages/Home';
import Pricing from '@/pages/Pricing';
import TravelDeals from '@/pages/TravelDeals';
import SaudiVisa from '@/pages/SaudiVisa';
import HowToApply from '@/pages/HowToApply';
import Track from '@/pages/Track';
import Legal from '@/pages/Legal';
import Dashboard from '@/pages/Dashboard';
import Login from './pages/Login';
import NotFound from './pages/NotFound';

function AppContent() {
  const { i18n } = useTranslation();

  useEffect(() => {
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  return (
    <div className={`min-h-screen bg-white ${i18n.language === 'ar' ? 'font-tajawal' : 'font-inter'}`}>
      {/* Language Selector Bar */}
      <div className="fixed top-16 left-0 right-0 z-40 bg-gradient-to-r from-gray-50 via-white to-gray-50 border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-10">
          <span className="text-[10px] text-gray-400 font-medium hidden sm:inline">
            25+ Languages Supported
          </span>
          <div className="ml-auto">
            <GoogleTranslate />
          </div>
        </div>
      </div>

      <Header />
      <main className="pt-10">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/visa-prices" element={<Pricing />} />
          <Route path="/travel-deals" element={<TravelDeals />} />
          <Route path="/saudi-visa" element={<SaudiVisa />} />
          <Route path="/how-to-apply" element={<HowToApply />} />
          <Route path="/track" element={<Track />} />
          <Route path="/terms" element={<Legal page="terms" />} />
          <Route path="/privacy" element={<Legal page="privacy" />} />
          <Route path="/refund" element={<Legal page="refund" />} />
          <Route path="/cookies" element={<Legal page="cookies" />} />
          <Route path="/dashboard" element={<AdminGuard><Dashboard /></AdminGuard>} />
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
      <ScrollToTop />
      <ChatBot />
    </div>
  );
}

export default AppContent;
