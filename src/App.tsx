import { Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './i18n';
import Header from '@/components/shared/Header';
import Footer from '@/components/shared/Footer';
import ScrollToTop from '@/components/shared/ScrollToTop';
import ChatBot from '@/components/shared/ChatBot';
import AdminGuard from '@/components/shared/AdminGuard';
import Home from '@/pages/Home';
import Pricing from '@/pages/Pricing';
import HowToApply from '@/pages/HowToApply';
import Track from '@/pages/Track';
import Legal from '@/pages/Legal';
import Dashboard from '@/pages/Dashboard';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import AdminLogin from '@/pages/admin/AdminLogin';
import AdminApplications from '@/pages/admin/AdminApplications';
import AdminApplicationDetail from '@/pages/admin/AdminApplicationDetail';

function AppContent() {
  const { i18n } = useTranslation();

  useEffect(() => {
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <div className={`min-h-screen bg-white ${i18n.language === 'ar' ? 'font-tajawal' : 'font-inter'}`}>
      {!isAdminRoute && <Header />}
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/visa-prices" element={<Pricing />} />
          <Route path="/how-to-apply" element={<HowToApply />} />
          <Route path="/track" element={<Track />} />
          <Route path="/terms" element={<Legal page="terms" />} />
          <Route path="/privacy" element={<Legal page="privacy" />} />
          <Route path="/refund" element={<Legal page="refund" />} />
          <Route path="/cookies" element={<Legal page="cookies" />} />
          <Route path="/dashboard" element={<AdminGuard><Dashboard /></AdminGuard>} />
          <Route path="/login" element={<Login />} />
          {/* Admin Routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/applications" element={<AdminApplications />} />
          <Route path="/admin/applications/:referenceNumber" element={<AdminApplicationDetail />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      {!isAdminRoute && <Footer />}
      {!isAdminRoute && <ScrollToTop />}
      {!isAdminRoute && <ChatBot />}
    </div>
  );
}

export default AppContent;
