import MarketingBackdrop from "./MarketingBackdrop";
import Footer from "./Footer";
import BrandLoad from "./BrandLoad";
import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

/** Only marketing routes opt in. Application and back-office layouts never mount this. */
export default function MarketingLayout() {
  const { pathname } = useLocation();
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const visibility = () => setPaused(document.hidden);
    visibility();
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, []);
  return <div className="marketing-layout">
    <MarketingBackdrop paused={paused} />
    <div className="marketing-content">
      {pathname !== '/' && <div className="marketing-brand-intro"><BrandLoad /></div>}
      <Outlet /><Footer />
    </div>
  </div>;
}
