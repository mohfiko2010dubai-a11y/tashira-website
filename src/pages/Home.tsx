import { useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import RHero from '@/sections/redesign/RHero';
import RStats from '@/sections/redesign/RStats';
import RVisaTypes from '@/sections/redesign/RVisaTypes';
import RHowItWorks from '@/sections/redesign/RHowItWorks';
import WhyChooseTashira from '@/sections/WhyChooseTashira';
import DubaiShowcase from '@/sections/DubaiShowcase';
import CountriesSection from '@/sections/CountriesSection';
import RTestimonials from '@/sections/redesign/RTestimonials';
import FAQSection from '@/sections/FAQSection';
import RCTA from '@/sections/redesign/RCTA';

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
        <meta name="description" content="Apply for UAE visa services online with TASHIRA, a private application service provider. Processing estimates depend on complete documents and authority review." />
        <link rel="canonical" href="https://tashiraev.com/" />
        <meta property="og:title" content="UAE Visa Online | Apply for Dubai & Abu Dhabi Visa | Tashira" />
        <meta property="og:description" content="Private UAE visa-application support with estimated processing subject to authority review; approval is not guaranteed." />
        <meta property="og:url" content="https://tashiraev.com/" />
      </Helmet>
      <div className="min-h-screen bg-[#FAFAF7]">
        <RHero />
        <RStats />
        <RVisaTypes />
        <RHowItWorks />
        <WhyChooseTashira />
        <DubaiShowcase />
        <div ref={countriesRef}>
          <CountriesSection />
        </div>
        <RTestimonials />
        <div ref={faqRef}>
          <FAQSection />
        </div>
        <RCTA />
      </div>
    </>
  );
}
