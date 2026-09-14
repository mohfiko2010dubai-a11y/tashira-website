import { useEffect, useRef } from 'react';
import Logo from './Logo';

/** SSR is complete and visible. Only a non-header marketing logo can opt in. */
export default function BrandLoad() {
  const host = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = host.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let observer: PerformanceObserver | undefined;
    const start = () => {
      try {
        if (sessionStorage.getItem('tashira-brand-seen')) return;
        sessionStorage.setItem('tashira-brand-seen', '1');
      } catch { return; }
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) element?.classList.add('brand-play');
    };
    if (performance.getEntriesByType('paint').length) timer = setTimeout(start, 0);
    else if (typeof PerformanceObserver !== 'undefined') {
      observer = new PerformanceObserver(() => { observer?.disconnect(); timer = setTimeout(start, 0); });
      observer.observe({ type: 'paint', buffered: true });
    }
    return () => { clearTimeout(timer); observer?.disconnect(); element?.classList.remove('brand-play'); };
  }, []);
  return <span ref={host}><Logo theme="dark" size={26} /></span>;
}
