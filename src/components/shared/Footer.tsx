import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Phone, Mail, MapPin } from 'lucide-react';

export default function Footer() {
  const { t } = useTranslation('common');

  return (
    <footer className="bg-[#1A2332] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Company Info */}
          <div>
            <div className="mb-4">
              <span className="text-xl font-bold text-[#C9A04C]">{t('brand.name')}</span>
              <span className="block text-[9px] font-semibold text-gray-400 uppercase tracking-[0.15em] -mt-0.5">
                {t('brand.subtitle')}
              </span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed mb-5">
              {t('footer.description')}
            </p>
            <div className="flex gap-2">
              {['FB', 'IG', 'LI'].map((social) => (
                <a
                  key={social}
                  href="#"
                  className="w-8 h-8 flex items-center justify-center rounded-full border border-white/20 text-[10px] text-gray-400 hover:text-white hover:border-[#C9A04C] transition-all"
                >
                  {social}
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white mb-4">
              {t('footer.quickLinks')}
            </h3>
            <ul className="space-y-2.5">
              {[
                { label: 'Home', path: '/' },
                { label: 'UAE Visa Prices', path: '/visa-prices' },
                { label: 'How to Apply', path: '/how-to-apply' },
                { label: 'Track Application', path: '#' },
              ].map((link) => (
                <li key={link.path}>
                  <Link to={link.path} className="text-sm text-gray-400 hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Center */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white mb-4">
              {t('footer.legalCenter')}
            </h3>
            <ul className="space-y-2.5">
              {[
                { label: t('footer.terms'), path: '/terms' },
                { label: t('footer.privacy'), path: '/privacy' },
                { label: t('footer.refund'), path: '/refund' },
                { label: t('footer.cookies'), path: '/cookies' },
              ].map((link) => (
                <li key={link.path}>
                  <Link to={link.path} className="text-sm text-gray-400 hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support Center */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white mb-4">
              {t('footer.supportCenter')}
            </h3>
            <ul className="space-y-3">
              <li className="flex items-center gap-2.5 text-sm text-gray-400">
                <Phone size={13} className="text-[#C9A04C] shrink-0" />
                <span>+971 4494 6106</span>
              </li>
              <li className="flex items-center gap-2.5 text-sm text-gray-400">
                <Phone size={13} className="text-[#C9A04C] shrink-0" />
                <span>+971 5081 07710</span>
              </li>
              <li className="flex items-center gap-2.5 text-sm text-gray-400">
                <Mail size={13} className="text-[#C9A04C] shrink-0" />
                <span>info@tashira.me</span>
              </li>
              <li className="flex items-start gap-2.5 text-sm text-gray-400">
                <MapPin size={13} className="text-[#C9A04C] shrink-0 mt-0.5" />
                <span>Burjuman Tower, Dubai, UAE</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-gray-500">
            {t('footer.copyright')}
          </p>
          <p className="text-xs text-gray-500 tracking-widest uppercase">
            {t('footer.paymentMethods')}
          </p>
        </div>
      </div>
    </footer>
  );
}
