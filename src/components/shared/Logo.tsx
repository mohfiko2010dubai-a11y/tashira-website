import { useId, type CSSProperties } from 'react';

type LogoProps = {
  variant?: 'full' | 'mark-only';
  theme?: 'light' | 'dark';
  size?: number;
  watermark?: boolean;
  className?: string;
};

/** Port of the owner-supplied brandkit/logo-lockup.html. Never mirror the mark. */
export default function Logo({ variant = 'full', theme = 'light', size = 26, watermark = false, className }: LogoProps) {
  const gradient = `tsh-${useId().replace(/:/g, '')}`;
  const gold = `url(#${gradient})`;
  const navy = '#0A1628';
  const dark = theme === 'dark';
  const style = {
    '--tsh-ink': dark ? '#FFFFFF' : navy, '--tsh-gold': dark ? '#DDBB7A' : '#C9A04C',
    display: 'inline-flex', alignItems: 'center', gap: '.62em', direction: 'ltr', textAlign: 'left',
    lineHeight: 1, fontSize: Math.max(size, 24 / 1.28), padding: '.37em',
    flexShrink: 0, opacity: watermark ? .15 : undefined,
  } as CSSProperties;
  return <span className={className} style={style} data-tashira-logo={variant} data-theme={theme} role="img" aria-label="TASHIRA — UAE E-Visa Services">
    <svg viewBox="30 2 140 180" width=".996em" height="1.28em" style={{ display: 'block', flex: 'none' }} aria-hidden="true" focusable="false">
      <defs><linearGradient id={gradient} x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#C9A04C"/><stop offset="1" stopColor="#DDBB7A"/></linearGradient></defs>
      <path className="brand-arc brand-a1" pathLength="1" d="M40 172 V104 C40 70 68 46 100 24 C132 46 160 70 160 104 V172" fill="none" stroke={watermark ? navy : '#00843D'} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/>
      <path className="brand-arc brand-a2" pathLength="1" d="M55 172 V104 C55 79 76.6 61 100 42.75 C123.4 61 145 79 145 104 V172" fill="none" stroke={watermark ? navy : dark ? '#FFFFFF' : '#D4D4D4'} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/>
      {dark && !watermark && <path className="brand-arc brand-a3" pathLength="1" d="M70 172 V104 C70 88 85.2 76 100 61.5 C114.8 76 130 88 130 104 V172" fill="none" stroke={gold} strokeWidth="13" strokeLinecap="round" strokeLinejoin="round"/>}
      <path className="brand-arc brand-a3" pathLength="1" d="M70 172 V104 C70 88 85.2 76 100 61.5 C114.8 76 130 88 130 104 V172" fill="none" stroke={watermark ? navy : '#111111'} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/>
      <path className="brand-star" d="M100 6 l4 7 -4 7 -4 -7z" fill={watermark ? navy : gold}/>
      <rect className="brand-bar" x="75" y="98" width="50" height="9" rx="4.5" fill={watermark ? navy : '#EF3340'}/>
      <rect className="brand-stem" x="95.5" y="98" width="9" height="62" rx="4.5" fill={watermark ? navy : '#EF3340'}/>
      <circle className="brand-dot" cx="100" cy="174" r="6.5" fill={watermark ? navy : gold}/>
    </svg>
    {variant === 'full' && <span className="brand-wordmark" style={{ display: 'flex', flexDirection: 'column', gap: '.19em', width: '6.6em', fontFamily: 'Tajawal,"IBM Plex Sans Arabic",Cairo,Arial,sans-serif' }}>
      <span style={{ fontWeight: 900, fontSize: '1em', letterSpacing: '.235em', color: 'var(--tsh-ink)', whiteSpace: 'nowrap', marginInlineEnd: '-.235em' }}>TASHIRA</span>
      {size >= 26 && <span style={{ fontWeight: 700, fontSize: '.235em', letterSpacing: '.42em', color: 'var(--tsh-gold)', whiteSpace: 'nowrap', marginInlineEnd: '-.42em' }}>UAE E-VISA SERVICES</span>}
    </span>}
  </span>;
}
