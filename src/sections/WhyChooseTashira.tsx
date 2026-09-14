import { useTranslation } from "react-i18next";
import { marketingClaims } from "@contracts/marketing-claims";
import { Shield, Clock, FileCheck, Headphones, Globe, ChevronRight } from 'lucide-react';


const features = [
  { icon: Shield, key: 'license' },
  { icon: FileCheck, key: 'documentReview' },
  { icon: Clock, key: 'responseTime' },
  { icon: Headphones, key: 'languages' },
] as const;

export default function WhyChooseTashira() {


  const { i18n } = useTranslation();
  const isAr = i18n.language.startsWith("ar");
  const copy = marketingClaims(i18n.language);

  return (
    <section className="relative overflow-hidden">
      <div className="relative bg-[#1A2332]">
        {/* Background image overlay */}
        <div
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage: 'url(/images/dubai-skyline.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1A2332] via-[#1A2332]/95 to-[#1A2332]/85" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">

            {/* LEFT: Title + Description + CTA */}
            <div className="lg:col-span-5">
              {/* Label */}
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-px bg-[#C9A04C]" />
                <span className="text-[10px] text-[#C9A04C] tracking-[0.25em] uppercase font-semibold">
                  {isAr ? 'لماذا نحن' : 'Why TASHIRA'}
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight mb-4">
                {isAr
                  ? 'شريكك الموثوق لتأشيرة الإمارات'
                  : 'Your Trusted Partner for UAE Visa'}
              </h2>

              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                {isAr
                  ? 'تأشيرة شركة خاصة مرخصة في منطقة ميدان الحرة بدبي، تقدم خدمات مراجعة طلبات التأشيرة. نحن لسنا الجهة الحكومية التي تتخذ قرار التأشيرة ولا نضمن الموافقة.'
                  : 'TASHIRA is a private company licensed in Meydan Free Zone, Dubai, providing visa-application review services. We are not the government decision authority and do not guarantee approval.'}
              </p>

              {/* CTA */}
              <a
                href="https://wa.me/971589896644"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#C9A04C] to-[#DDBB7A] text-white text-sm font-semibold rounded-lg hover:shadow-lg hover:shadow-[#C9A04C]/20 transition-all"
              >
                {isAr ? 'تحدث معنا على واتساب' : 'Chat on WhatsApp'}
                <ChevronRight size={14} />
              </a>
            </div>

            {/* RIGHT: Feature list */}
            <div className="lg:col-span-7">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {features.map((feature, idx) => (
                  <div
                    key={idx}
                    className="feature-item group flex items-center gap-4 p-4 rounded-xl bg-white/[0.04] border border-white/10 hover:border-[#C9A04C]/30 hover:bg-white/[0.06] transition-all duration-300"
                  >
                    {/* Icon */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#C9A04C]/10 border border-[#C9A04C]/20 flex items-center justify-center group-hover:bg-[#C9A04C]/20 transition-colors">
                      <feature.icon size={18} className="text-[#C9A04C]" />
                    </div>

                    {/* Title */}
                    <p className="text-sm font-semibold text-white group-hover:text-[#C9A04C] transition-colors">
                      {copy[feature.key]}
                    </p>
                  </div>
                ))}
                <a href="#eligibility" className="feature-item flex items-center gap-4 rounded-xl border border-[#C9A04C]/40 p-4 text-sm font-semibold text-[#DDBB7A] underline underline-offset-4 focus:outline-none focus:ring-2 focus:ring-[#DDBB7A] sm:col-span-2">
                  <Globe size={20} aria-hidden="true" className="shrink-0" />{copy.eligibility}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
