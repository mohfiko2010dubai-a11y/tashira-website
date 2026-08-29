import { useTranslation } from 'react-i18next';
import { FileEdit, UploadCloud, MailCheck } from 'lucide-react';

const STEPS = [
  { icon: FileEdit, num: '01', titleKey: 'howItWorks.step1.title', descKey: 'howItWorks.step1.desc' },
  { icon: UploadCloud, num: '02', titleKey: 'howItWorks.step2.title', descKey: 'howItWorks.step2.desc' },
  { icon: MailCheck, num: '03', titleKey: 'howItWorks.step3.title', descKey: 'howItWorks.step3.desc' },
];

export default function RHowItWorks() {
  const { t } = useTranslation('home');
  return (
    <section className="py-20 lg:py-28 bg-[#0A1628] relative overflow-hidden">
      <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_30%_50%,#C9A04C,transparent_60%)]" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-sm font-bold tracking-[0.25em] text-[#C9A04C] mb-3">TASHIRA</p>
          <h2 className="text-3xl lg:text-4xl font-extrabold text-white">{t('howItWorks.title')}</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-10">
          {STEPS.map(({ icon: Icon, num, titleKey, descKey }, i) => (
            <div key={num} className="relative text-center group">
              {i < STEPS.length - 1 && (
                <div className="hidden md:block absolute top-12 left-[calc(50%+56px)] w-[calc(100%-112px)] border-t-2 border-dashed border-[#C9A04C]/30" />
              )}
              <div className="relative inline-flex">
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#C9A04C]/20 to-[#C9A04C]/5 border border-[#C9A04C]/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Icon size={40} className="text-[#C9A04C]" />
                </div>
                <span className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-gradient-to-r from-[#C9A04C] to-[#DDBB7A] text-white text-sm font-extrabold flex items-center justify-center">
                  {num}
                </span>
              </div>
              <h3 className="mt-6 text-xl font-bold text-white">{t(titleKey)}</h3>
              <p className="mt-3 text-sm text-gray-400 leading-relaxed max-w-xs mx-auto">{t(descKey)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
