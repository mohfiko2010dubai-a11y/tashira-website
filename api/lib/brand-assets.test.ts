import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import metadata from '../../contracts/public-page-metadata.json';
import { fixedMetadata } from '../../contracts/ssr-pages';
import { renderPageTemplate } from './ssr-html';

describe('Supplied route artwork', () => {
  it('serves all 32 real 1200x630 images through absolute SSR metadata, including fallback', async () => {
    for (const route of Object.keys(metadata)) for (const lang of ['en', 'ar']) {
      const meta = fixedMetadata(route, lang)!;
      const image = new URL(meta.image!, 'https://www.tashiraev.com');
      const dimensions = await sharp(readFileSync(`public${image.pathname}`)).metadata();
      expect([dimensions.width, dimensions.height]).toEqual([1200, 630]);
      const html = renderPageTemplate('<html><head><!--PAGE_METADATA--></head><body><div id="root"></div></body></html>', meta);
      expect(html).toContain(`property="og:image" content="${image.href}"`);
      expect(html).toContain(`name="twitter:image" content="${image.href}"`);
      expect(html).toContain('property="og:image:width" content="1200"');
      expect(html).toContain('/icons/mark-1024-transparent.png');
    }
  });
  it('uses the separate simplified favicon drawing and matching manifest icons', () => {
    const svg = readFileSync('public/icons/logo-mark-favicon.svg', 'utf8');
    expect(svg).not.toContain('<circle');
    const manifest = JSON.parse(readFileSync('public/site.webmanifest', 'utf8'));
    expect(manifest.theme_color).toBe('#0A1628');
    for (const icon of manifest.icons) expect(readFileSync(`public${icon.src}`).length).toBeGreaterThan(0);
  });
});
