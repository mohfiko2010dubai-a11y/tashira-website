import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Logo from './Logo';

describe('Gateway lockup', () => {
  it('keeps each gradient private to its instance in one SSR document', () => {
    const html = renderToStaticMarkup(<><Logo /><Logo theme="dark" /></>);
    const ids = [...html.matchAll(/linearGradient id="([^"]+)"/g)].map(match => match[1]);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) expect(html).toContain(`url(#${id})`);
    expect(html.match(/UAE E-VISA SERVICES/g)).toHaveLength(2);
    expect(html).toContain('direction:ltr');
  });
  it('retains SERVICES at 26px and reserves wordmark width before fonts load', () => {
    expect(renderToStaticMarkup(<Logo size={26} />)).toContain('width:6.6em');
    expect(renderToStaticMarkup(<Logo size={26} />)).toContain('>UAE E-VISA SERVICES<');
    expect(renderToStaticMarkup(<Logo variant="mark-only" watermark />)).toContain('opacity:0.15');
  });
});
