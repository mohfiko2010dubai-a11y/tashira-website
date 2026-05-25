import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import HeroSection from '@/sections/HeroSection';
import DubaiShowcase from '@/sections/DubaiShowcase';
import VisaApplicationForm from '@/sections/VisaApplicationForm';
import CountriesSection from '@/sections/CountriesSection';
import FAQSection from '@/sections/FAQSection';

gsap.registerPlugin(ScrollTrigger);

export default function Home() {
  const countriesRef = useRef<HTMLDivElement>(null);
  const faqRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      [countriesRef, faqRef].forEach((ref) => {
        if (ref.current) {
          gsap.from(ref.current, {
            opacity: 0,
            y: 40,
            duration: 0.7,
            ease: 'power3.out',
            scrollTrigger: { trigger: ref.current, start: 'top 85%' },
          });
        }
      });
    });
    return () => ctx.revert();
  }, []);

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #FAFAF7 0%, #F5F3EE 15%, #FFFFFF 30%)' }}>
      <HeroSection />
      <DubaiShowcase />
      <VisaApplicationForm />
      <div ref={countriesRef}>
        <CountriesSection />
      </div>
      <div ref={faqRef}>
        <FAQSection />
      </div>
    </div>
  );
}
