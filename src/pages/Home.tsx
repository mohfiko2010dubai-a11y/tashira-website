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
import ContentHighlights from '@/sections/ContentHighlights';


export default function Home() {


  return (
    <>
      <div className="min-h-screen bg-[#FAFAF7]">
        <RHero />
        <RStats />
        <RVisaTypes />
        <RHowItWorks />
        <WhyChooseTashira />
        <DubaiShowcase />
        <div>
          <CountriesSection />
        </div>
        <RTestimonials />
        <ContentHighlights />
        <div>
          <FAQSection />
        </div>
        <RCTA />
      </div>
    </>
  );
}
