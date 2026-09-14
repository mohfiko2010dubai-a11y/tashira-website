import { describe, expect, it } from 'vitest';
import { fixedMetadata } from '../../contracts/ssr-pages';
import { notFoundHtml, renderPageTemplate } from './ssr-html';

const template = '<html><head><!--PAGE_METADATA--><link rel="stylesheet" href="/assets/example.css"></head><body><div id="root"></div></body></html>';

describe('motion layout boundaries in server fallback', () => {
  it('opts marketing into the backdrop while keeping application and private shells out', () => {
    const marketing = renderPageTemplate(template, fixedMetadata('/ar/visa-prices'));
    expect(marketing).toContain('marketing-ambient');
    expect(marketing).toContain('lang="ar" dir="rtl"');
    expect(marketing).toContain('width="64" height="64"');
    expect(renderPageTemplate(template, fixedMetadata('/ar/apply'))).not.toContain('marketing-ambient');
    expect(renderPageTemplate(template, null)).not.toContain('marketing-ambient');
  });
  it('includes the backdrop and existing CSS on the genuine 404 surface', () => {
    const html = notFoundHtml('ar', template);
    expect(html).toContain('marketing-ambient');
    expect(html).toContain('/assets/example.css');
    expect(html).toContain('الصفحة غير موجودة');
  });
});
