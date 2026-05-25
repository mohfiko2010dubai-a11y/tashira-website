import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import gsap from 'gsap';

export default function HeroSection() {
  const { t, i18n } = useTranslation('home');
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(sectionRef.current, {
        opacity: 0,
        y: 20,
        duration: 0.6,
        ease: 'power3.out',
      });
    });
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative w-full pt-28 pb-8 text-center"
      style={{ background: 'linear-gradient(180deg, #FAFAF7 0%, #F0EDE8 100%)' }}
    >
      <div className="max-w-3xl mx-auto px-4">
        <div className="flex items-center justify-center gap-3 mb-3">
          <img
            src="https://flagcdn.com/w80/ae.png"
            alt="UAE Flag"
            className="w-8 h-auto rounded"
          />
          <p className="text-base font-normal text-gray-800">
            {t('hero.badge')}
          </p>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-wide uppercase">
          {i18n.language === 'ar' ? 'بوابة تأشيرة الإلكترونية' : 'TASHIRA E-VISA PORTAL'}
        </h1>
      </div>
    </section>
  );
}
