import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, X } from 'lucide-react';
import LanguageSelector from './LanguageSelector';

const navLinks = [
  { key: 'home', label: 'HOME', path: '/' },
  { key: 'pricing', label: 'UAE VISAS', path: '/visa-prices' },
  { key: 'saudiVisa', label: 'SAUDI VISA', path: '/saudi-visa' },
  { key: 'travelDeals', label: 'TRAVEL DEALS', path: '/travel-deals' },
  { key: 'howToApply', label: 'HOW TO APPLY', path: '/how-to-apply' },
];

export default function Header() {
  const { t, i18n } = useTranslation('common');
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex flex-col items-start leading-tight">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-[#C9A04C] tracking-wide">{t('brand.name')}</span>
              <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[9px] font-bold rounded-full border border-emerald-200 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> LIVE
              </span>
            </div>
            <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-[0.15em] -mt-0.5">
              {t('brand.subtitle')}
            </span>
          </Link>

          {/* Desktop Nav - Center */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.key}
                to={link.path}
                className={`text-sm font-semibold tracking-wide transition-colors duration-200 ${
                  isActive(link.path)
                    ? 'text-[#C9A04C] border-b-2 border-[#C9A04C] pb-5 pt-5'
                    : 'text-gray-700 hover:text-[#C9A04C]'
                }`}
              >
                {i18n.language === 'ar' ? t(`nav.${link.key}`) : link.label}
              </Link>
            ))}
          </nav>

          {/* Language + Mobile Menu */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <LanguageSelector />
            </div>

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 text-gray-700 hover:text-[#C9A04C]"
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-white/98 backdrop-blur-lg pt-20 px-6 md:hidden">
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.key}
                to={link.path}
                className={`px-4 py-3 text-base font-medium uppercase tracking-wide rounded-lg transition-colors ${
                  isActive(link.path)
                    ? 'text-[#C9A04C] bg-[#C9A04C]/5'
                    : 'text-gray-700 hover:text-[#C9A04C] hover:bg-gray-50'
                }`}
              >
                {i18n.language === 'ar' ? t(`nav.${link.key}`) : link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 px-4">
            <LanguageSelector />
          </div>
        </div>
      )}
    </header>
  );
}
