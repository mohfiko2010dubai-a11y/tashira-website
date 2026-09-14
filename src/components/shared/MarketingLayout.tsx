import MarketingBackdrop from "./MarketingBackdrop";
import Footer from "./Footer";
import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';

/** Only marketing routes opt in. Application and back-office layouts never mount this. */
export default function MarketingLayout() {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const visibility = () => setPaused(document.hidden);
    visibility();
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, []);
  return <div className="marketing-layout">
    <MarketingBackdrop paused={paused} />
    <div className="marketing-content"><Outlet /><Footer brandLoad /></div>
  </div>;
}
