import { useState, useEffect } from 'react';
import { ChevronUp } from 'lucide-react';

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > 500);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <button
      onClick={scrollToTop}
      className={`fixed bottom-6 right-6 z-40 w-11 h-11 rounded-full bg-[#C9A04C] text-white shadow-lg flex items-center justify-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl ${
        visible ? 'opacity-100 scale-100' : 'opacity-0 scale-80 pointer-events-none'
      }`}
      aria-label="Scroll to top"
    >
      <ChevronUp size={20} />
    </button>
  );
}
