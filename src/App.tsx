import { Routes, Route, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { HelmetProvider } from 'react-helmet-async';
import './i18n';
import Header from '@/components/shared/Header';
import Footer from '@/components/shared/Footer';
import ScrollToTop from '@/components/shared/ScrollToTop';
import ChatBot from '@/components/shared/ChatBot';
import AdminGuard from '@/components/shared/AdminGuard';
import StaffGuard from '@/components/shared/StaffGuard';

const Home = lazy(() => import('@/pages/Home'));
const Pricing = lazy(() => import('@/pages/Pricing'));
const HowToApply = lazy(() => import('@/pages/HowToApply'));
const Track = lazy(() => import('@/pages/Track'));
const Legal = lazy(() => import('@/pages/Legal'));
const PaymentPage = lazy(() => import('@/pages/PaymentPage'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Login = lazy(() => import('./pages/Login'));
const NotFound = lazy(() => import('./pages/NotFound'));
const AdminLogin = lazy(() => import('@/pages/admin/AdminLogin'));
const AdminApplications = lazy(() => import('@/pages/admin/AdminApplications'));
const AdminApplicationDetail = lazy(() => import('@/pages/admin/AdminApplicationDetail'));
const AdminSuppliers = lazy(() => import('@/pages/admin/AdminSuppliers'));
const AdminStaff = lazy(() => import('@/pages/admin/AdminStaff'));
const AdminInvoices = lazy(() => import('@/pages/admin/AdminInvoices'));
const AdminSupplierDashboard = lazy(() => import('@/pages/admin/AdminSupplierDashboard'));
const AdminVat = lazy(() => import('@/pages/admin/AdminVat'));
const AdminChat = lazy(() => import('@/pages/admin/AdminChat'));
const StaffLogin = lazy(() => import('@/pages/admin/StaffLogin'));
const StaffDashboard = lazy(() => import('@/pages/admin/StaffDashboard'));
const StaffApplicationDetail = lazy(() => import('@/pages/admin/StaffApplicationDetail'));
const AdminFinanceCockpit = lazy(() => import('@/pages/admin/AdminFinanceCockpit'));

function AppContent() {
  const { i18n } = useTranslation();
  const location = useLocation();

  useEffect(() => {
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <HelmetProvider>
    <div className={`min-h-screen bg-white ${i18n.language === 'ar' ? 'font-tajawal' : 'font-inter'}`}>
      {!isAdminRoute && <Header />}
      <main>
        <Suspense fallback={<div className="min-h-[40vh]" aria-label="Loading page" />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/visa-prices" element={<Pricing />} />
          <Route path="/how-to-apply" element={<HowToApply />} />
          <Route path="/track" element={<Track />} />
          <Route path="/pay/:referenceNumber" element={<PaymentPage />} />
          <Route path="/terms" element={<Legal page="terms" />} />
          <Route path="/privacy" element={<Legal page="privacy" />} />
          <Route path="/refund" element={<Legal page="refund" />} />
          <Route path="/cookies" element={<Legal page="cookies" />} />
          <Route path="/dashboard" element={<AdminGuard><Dashboard /></AdminGuard>} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/applications" element={<AdminGuard><AdminApplications /></AdminGuard>} />
          <Route path="/admin/applications/:referenceNumber" element={<AdminGuard><AdminApplicationDetail /></AdminGuard>} />
          <Route path="/admin/suppliers" element={<AdminGuard><AdminSuppliers /></AdminGuard>} />
          <Route path="/admin/staff" element={<AdminGuard><AdminStaff /></AdminGuard>} />
          <Route path="/admin/invoices" element={<AdminGuard><AdminInvoices /></AdminGuard>} />
          <Route path="/admin/supplier-dashboard" element={<AdminGuard><AdminSupplierDashboard /></AdminGuard>} />
          <Route path="/admin/vat" element={<AdminGuard><AdminVat /></AdminGuard>} />
          <Route path="/admin/finance" element={<AdminGuard><AdminFinanceCockpit /></AdminGuard>} />
          <Route path="/admin/chat" element={<AdminGuard><AdminChat /></AdminGuard>} />
          <Route path="/staff/login" element={<StaffLogin />} />
          <Route path="/staff/dashboard" element={<StaffGuard><StaffDashboard /></StaffGuard>} />
          <Route path="/staff/applications/:referenceNumber" element={<StaffGuard><StaffApplicationDetail /></StaffGuard>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </main>
      {!isAdminRoute && <Footer />}
      {!isAdminRoute && <ScrollToTop />}
      {!isAdminRoute && <ChatBot />}
    </div>
    </HelmetProvider>
  );
}

export default AppContent;
