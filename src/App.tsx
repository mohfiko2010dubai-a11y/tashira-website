import { Navigate, Routes, Route, useLocation } from 'react-router-dom';
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
import ChunkLoadErrorBoundary from '@/components/shared/ChunkLoadErrorBoundary';
import { importWithStaleChunkRecovery } from '@/lib/lazy-import';

const Home = lazy(() => importWithStaleChunkRecovery(() => import('@/pages/Home')));
const Pricing = lazy(() => importWithStaleChunkRecovery(() => import('@/pages/Pricing')));
const HowToApply = lazy(() => importWithStaleChunkRecovery(() => import('@/pages/HowToApply')));
const Track = lazy(() => importWithStaleChunkRecovery(() => import('@/pages/Track')));
const Legal = lazy(() => importWithStaleChunkRecovery(() => import('@/pages/Legal')));
const Contact = lazy(() => importWithStaleChunkRecovery(() => import('@/pages/Contact')));
const PaymentPage = lazy(() => importWithStaleChunkRecovery(() => import('@/pages/PaymentPage')));
const Recovery = lazy(() => importWithStaleChunkRecovery(() => import('@/pages/Recovery')));
const SecurityDepositPage = lazy(() => importWithStaleChunkRecovery(() => import('@/pages/SecurityDepositPage')));
const Dashboard = lazy(() => importWithStaleChunkRecovery(() => import('@/pages/Dashboard')));
const Login = lazy(() => importWithStaleChunkRecovery(() => import('./pages/Login')));
const NotFound = lazy(() => importWithStaleChunkRecovery(() => import('./pages/NotFound')));
const AdminLogin = lazy(() => importWithStaleChunkRecovery(() => import('@/pages/admin/AdminLogin')));
const AdminApplications = lazy(() => importWithStaleChunkRecovery(() => import('@/pages/admin/AdminApplications')));
const AdminApplicationDetail = lazy(() => importWithStaleChunkRecovery(() => import('@/pages/admin/AdminApplicationDetail')));
const AdminSuppliers = lazy(() => importWithStaleChunkRecovery(() => import('@/pages/admin/AdminSuppliers')));
const AdminStaff = lazy(() => importWithStaleChunkRecovery(() => import('@/pages/admin/AdminStaff')));
const AdminInvoices = lazy(() => importWithStaleChunkRecovery(() => import('@/pages/admin/AdminInvoices')));
const AdminSupplierDashboard = lazy(() => importWithStaleChunkRecovery(() => import('@/pages/admin/AdminSupplierDashboard')));
const AdminVat = lazy(() => importWithStaleChunkRecovery(() => import('@/pages/admin/AdminVat')));
const AdminChat = lazy(() => importWithStaleChunkRecovery(() => import('@/pages/admin/AdminChat')));
const StaffLogin = lazy(() => importWithStaleChunkRecovery(() => import('@/pages/admin/StaffLogin')));
const StaffDashboard = lazy(() => importWithStaleChunkRecovery(() => import('@/pages/admin/StaffDashboard')));
const StaffApplicationDetail = lazy(() => importWithStaleChunkRecovery(() => import('@/pages/admin/StaffApplicationDetail')));
const StaffOperationsCase = lazy(() => importWithStaleChunkRecovery(() => import('@/pages/admin/StaffOperationsCase')));
const StaffUpcomingSubmissions = lazy(() => importWithStaleChunkRecovery(() => import('@/pages/admin/StaffUpcomingSubmissions')));
const StaffOperationsDashboard = lazy(() => importWithStaleChunkRecovery(() => import('@/pages/admin/StaffOperationsDashboard')));
const StaffSupportInbox = lazy(() => importWithStaleChunkRecovery(() => import('@/pages/admin/StaffSupportInbox')));
const StaffSupplierSla = lazy(() => importWithStaleChunkRecovery(() => import('@/pages/admin/StaffSupplierSla')));
const StaffRegulatoryChanges = lazy(() => importWithStaleChunkRecovery(() => import('@/pages/admin/StaffRegulatoryChanges')));
const StaffOperationalPolicies = lazy(() => importWithStaleChunkRecovery(() => import('@/pages/admin/StaffOperationalPolicies')));
const AdminFinanceCockpit = lazy(() => importWithStaleChunkRecovery(() => import('@/pages/admin/AdminFinanceCockpit')));
const DynamicApplication = lazy(() => importWithStaleChunkRecovery(() => import('@/pages/DynamicApplication')));
const CustomerApplicationPortal = lazy(() => importWithStaleChunkRecovery(() => import('@/pages/CustomerApplicationPortal')));
const CustomerPrecheck = lazy(() => importWithStaleChunkRecovery(() => import('@/pages/CustomerPrecheck')));

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
        <ChunkLoadErrorBoundary>
          <Suspense fallback={<div className="min-h-[40vh]" aria-label="Loading page" />}>
          <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/visa-prices" element={<Pricing />} />
          <Route path="/how-to-apply" element={<HowToApply />} />
          <Route path="/track" element={<Track />} />
          <Route path="/pay/:referenceNumber" element={<PaymentPage />} />
          <Route path="/apply/:referenceNumber/interview" element={<DynamicApplication />} />
          <Route path="/applications/:referenceNumber/status" element={<CustomerApplicationPortal />} />
          <Route path="/visa-pre-check" element={<CustomerPrecheck />} />
          <Route path="/recover" element={<Recovery />} />
          <Route path="/deposit/:token" element={<SecurityDepositPage />} />
          <Route path="/terms" element={<Legal page="terms" />} />
          <Route path="/privacy" element={<Legal page="privacy" />} />
          <Route path="/refund" element={<Legal page="refund" />} />
          <Route path="/cookies" element={<Legal page="cookies" />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/dashboard" element={<AdminGuard><Dashboard /></AdminGuard>} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<Navigate to="/admin/applications" replace />} />
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
          <Route path="/staff/operations/:referenceNumber" element={<StaffGuard><StaffOperationsCase /></StaffGuard>} />
          <Route path="/staff/operations" element={<StaffGuard><StaffUpcomingSubmissions /></StaffGuard>} />
          <Route path="/staff/operations/dashboard" element={<StaffGuard><StaffOperationsDashboard /></StaffGuard>} />
          <Route path="/staff/operations/support" element={<StaffGuard><StaffSupportInbox /></StaffGuard>} />
          <Route path="/staff/operations/supplier-sla" element={<StaffGuard><StaffSupplierSla /></StaffGuard>} />
          <Route path="/staff/operations/regulatory-changes" element={<StaffGuard><StaffRegulatoryChanges /></StaffGuard>} />
          <Route path="/staff/operations/policies" element={<StaffGuard><StaffOperationalPolicies /></StaffGuard>} />
          <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </ChunkLoadErrorBoundary>
      </main>
      {!isAdminRoute && <Footer />}
      {!isAdminRoute && <ScrollToTop />}
      {!isAdminRoute && <ChatBot key={new URLSearchParams(location.search).get('resume') === '1' ? 'resume' : 'default'} />}
    </div>
    </HelmetProvider>
  );
}

export default AppContent;
