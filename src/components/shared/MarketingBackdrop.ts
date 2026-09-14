import { createElement as h } from 'react';

/** No JSX: the same layout backdrop is also rendered by the API's TS-only build. */
export default function MarketingBackdrop({ paused = false }: { paused?: boolean }) {
  return h('div', { className: `marketing-ambient${paused ? ' paused' : ''}`, 'aria-hidden': true,
    style: { position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 } },
  h('div', { className: 'ambient-gold' }), h('div', { className: 'ambient-blue' }),
  h('svg', { className: 'ambient-gateway', viewBox: '30 2 140 180', fill: 'none', stroke: '#C9A04C', strokeWidth: 9, strokeLinecap: 'round', strokeLinejoin: 'round',
    style: { position: 'absolute', width: 'min(90vw,780px)', top: '50%', left: '50%', opacity: .04, transform: 'translate(-50%,-50%)' } },
  h('path', { d: 'M40 172 V104 C40 70 68 46 100 24 C132 46 160 70 160 104 V172 M55 172 V104 C55 79 77 61 100 42.75 C123 61 145 79 145 104 V172 M70 172 V104 C70 88 86 76 100 61.5 C114 76 130 88 130 104 V172' })));
}
