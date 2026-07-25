import { useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import HeroSection from '@/sections/HeroSection';
import DubaiShowcase from '@/sections/DubaiShowcase';
import VisaApplicationForm from '@/sections/VisaApplicationForm';
import WhyChooseTashira from '@/sections/WhyChooseTashira';
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
    <>
      <Helmet>
        <title>UAE Visa Online | Apply for Dubai & Abu Dhabi Visa | Tashira</title>
        <meta name="description" content="Apply for UAE visa online with Tashira. Tourist visas, transit visas, GCC resident visas. Fast processing in 24-48 hours, secure payment, 24/7 support." />
        <link rel="canonical" href="https://tashiraev.com/" />
        <meta property="og:title" content="UAE Visa Online | Apply for Dubai & Abu Dhabi Visa | Tashira" />
        <meta property="og:description" content="Apply for UAE visa online. Tourist, transit, GCC resident visas. Fast 24-48 hour processing." />
        <meta property="og:url" content="https://tashiraev.com/" />
      </Helmet>
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #FAFAF7 0%, #F5F3EE 15%, #FFFFFF 30%)' }}>
      <HeroSection />
      <DubaiShowcase />
      <VisaApplicationForm />
      <WhyChooseTashira />
      <div ref={countriesRef}>
        <CountriesSection />
      </div>
      <div ref={faqRef}>
        <FAQSection />
      </div>
    </div>
    </>
  );
}
