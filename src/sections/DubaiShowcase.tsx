import { useRef, useEffect } from 'react';

const marqueeImages = [
  { src: '/images/dubai-landmarks.jpg', alt: 'Burj Al Arab, Dubai Frame & Palm Jumeirah' },
  { src: '/images/dubai-fountain.jpg', alt: 'Dubai Fountain & Burj Khalifa at Night' },
  { src: '/images/dubai-gold-souk.jpg', alt: 'Traditional Dubai Gold Souk' },
  { src: '/images/dubai-skyline.jpg', alt: 'Dubai Skyline at Golden Hour' },
];

export default function DubaiShowcase() {
  const parallaxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!parallaxRef.current) return;
      const scrolled = window.scrollY;
      const rect = parallaxRef.current.getBoundingClientRect();
      const rate = scrolled * 0.3;
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        parallaxRef.current.style.backgroundPositionY = `${-rate * 0.15}px`;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <section className="relative overflow-hidden">
      {/* ===== PARALLAX SKYLINE ===== */}
      <div
        ref={parallaxRef}
        className="relative h-[260px] sm:h-[320px] lg:h-[400px] overflow-hidden"
        style={{
          backgroundImage: 'url(/images/dubai-skyline.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center 30%',
          backgroundAttachment: 'fixed',
        }}
      >
        {/* Gold gradient overlay - top */}
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#FAFAF7] to-transparent z-10" />
        {/* Gold gradient overlay - bottom */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#F5F3EE] to-transparent z-10" />
        {/* Subtle gold tint overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#C9A04C]/10 via-transparent to-[#C9A04C]/10" />

        {/* Center tagline */}
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div className="text-center px-4">
            <p className="text-white/90 text-xs sm:text-sm font-medium tracking-[0.3em] uppercase mb-2 drop-shadow-lg">
              Your Gateway to
            </p>
            <h2 className="text-white text-2xl sm:text-4xl lg:text-5xl font-bold tracking-wide uppercase drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
              The City of Gold
            </h2>
            <div className="mt-3 mx-auto w-16 h-0.5 bg-gradient-to-r from-transparent via-[#C9A04C] to-transparent" />
          </div>
        </div>
      </div>

      {/* ===== MARQUEE GALLERY STRIP ===== */}
      <div className="relative py-6 bg-gradient-to-b from-[#F5F3EE] to-white overflow-hidden">
        {/* Decorative gold line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C9A04C]/40 to-transparent" />

        {/* Section label */}
        <div className="text-center mb-4">
          <p className="text-[10px] text-gray-400 tracking-[0.25em] uppercase font-medium">
            Discover Dubai
          </p>
        </div>

        {/* Scrolling marquee */}
        <div className="relative flex overflow-hidden">
          <div className="flex animate-marquee gap-4 pr-4">
            {[...marqueeImages, ...marqueeImages, ...marqueeImages].map((img, idx) => (
              <div
                key={idx}
                className="relative flex-shrink-0 w-[280px] sm:w-[340px] h-[160px] sm:h-[190px] rounded-xl overflow-hidden group shadow-lg"
              >
                <img
                  src={img.src}
                  alt={img.alt}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  loading="lazy"
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <p className="absolute bottom-3 left-3 right-3 text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 drop-shadow">
                  {img.alt}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom decorative gold line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C9A04C]/40 to-transparent" />
      </div>

      {/* ===== DECORATIVE GEOMETRIC DIVIDER ===== */}
      <div className="relative h-16 bg-white overflow-hidden">
        {/* Floating geometric shapes */}
        <div className="absolute inset-0 flex items-center justify-center gap-8 opacity-20">
          <div className="w-3 h-3 rotate-45 bg-[#C9A04C]" />
          <div className="w-2 h-2 rounded-full bg-[#C9A04C]" />
          <div className="w-4 h-4 border border-[#C9A04C] rotate-12" />
          <div className="w-16 h-px bg-gradient-to-r from-transparent via-[#C9A04C] to-transparent" />
          <div className="w-3 h-3 rotate-45 bg-[#C9A04C]" />
          <div className="w-2 h-2 rounded-full bg-[#C9A04C]" />
          <div className="w-4 h-4 border border-[#C9A04C] rotate-12" />
        </div>

        {/* Islamic geometric pattern line */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center gap-3">
          <div className="w-20 sm:w-40 h-px bg-gradient-to-l from-[#C9A04C]/50 to-transparent" />
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[#C9A04C]/60">
            <path d="M12 2L14.5 9.5H22L16 14L18.5 22L12 17.5L5.5 22L8 14L2 9.5H9.5L12 2Z" stroke="currentColor" strokeWidth="1" />
          </svg>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-[#C9A04C]/40">
            <path d="M12 2L14.5 9.5H22L16 14L18.5 22L12 17.5L5.5 22L8 14L2 9.5H9.5L12 2Z" stroke="currentColor" strokeWidth="1" />
          </svg>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[#C9A04C]/60">
            <path d="M12 2L14.5 9.5H22L16 14L18.5 22L12 17.5L5.5 22L8 14L2 9.5H9.5L12 2Z" stroke="currentColor" strokeWidth="1" />
          </svg>
          <div className="w-20 sm:w-40 h-px bg-gradient-to-r from-[#C9A04C]/50 to-transparent" />
        </div>
      </div>
    </section>
  );
}
