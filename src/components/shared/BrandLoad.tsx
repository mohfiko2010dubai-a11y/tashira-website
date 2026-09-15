import { useEffect, useRef } from 'react';
import Logo from './Logo';

/** SSR is complete and visible. Only a non-header marketing logo can opt in. */
export default function BrandLoad() {
  const host = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = host.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let observer: PerformanceObserver | undefined;
    let visibility: IntersectionObserver | undefined;
    const start = () => {
      try {
        if (sessionStorage.getItem('tashira-brand-seen')) return;
        sessionStorage.setItem('tashira-brand-seen', '1');
      } catch { return; }
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) element?.classList.add('brand-play');
    };
    const afterPaint = () => {
      if (!element) return;
      // Consume the session only when the public introduction is visible.
      visibility = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          visibility?.disconnect();
          start();
        }
      });
      visibility.observe(element);
    };
    if (performance.getEntriesByType('paint').length) timer = setTimeout(afterPaint, 0);
    else if (typeof PerformanceObserver !== 'undefined') {
      observer = new PerformanceObserver(() => { observer?.disconnect(); timer = setTimeout(afterPaint, 0); });
      observer.observe({ type: 'paint', buffered: true });
    }
    return () => { clearTimeout(timer); observer?.disconnect(); visibility?.disconnect(); element?.classList.remove('brand-play'); };
  }, []);
  return <span ref={host} className="brand-intro"><Logo theme="dark" size={26} className="brand-intro-logo" /></span>;
}
