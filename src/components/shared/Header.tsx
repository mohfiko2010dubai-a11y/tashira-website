import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, X } from 'lucide-react';

const navLinks = [
  { key: 'home', label: 'HOME', path: '/' },
  { key: 'pricing', label: 'UAE VISAS', path: '/visa-prices' },
  { key: 'howToApply', label: 'HOW TO APPLY', path: '/how-to-apply' },
];

export default function Header() {
  const { t, i18n } = useTranslation('common');
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar');
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <img src="/tashira-logo.png" alt="TASHIRA" className="h-14 w-auto" />
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

          {/* Language Toggle + Mobile Menu */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleLang}
              className="hidden sm:flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-[#C9A04C] transition-colors uppercase tracking-wide"
            >
              {i18n.language === 'ar' ? 'ENGLISH' : 'ARABIC'}
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="ml-1">
                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

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
          <button
            onClick={toggleLang}
            className="mt-4 px-4 py-3 text-base font-medium text-gray-700 uppercase tracking-wide w-full text-left hover:bg-gray-50 rounded-lg"
          >
            {i18n.language === 'ar' ? 'ENGLISH' : 'ARABIC'}
          </button>
        </div>
      )}
    </header>
  );
}
