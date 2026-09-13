import { describe, expect, it } from "vitest";
import { languageRoute, languagePath, preferredLanguage } from "../../contracts/language-routes";
import { fixedMetadata } from "../../contracts/ssr-pages";
import { renderPageTemplate } from "./ssr-html";

describe("route-owned language", () => {
  it.each([['/ar/visa-prices','ar','/visa-prices'],['/en','en','/'],['/ar','ar','/'],['/apply/REF/interview','en','/apply/REF/interview']])('parses %s', (path,language,pathname) => expect(languageRoute(path)).toMatchObject({language,pathname}));
  it("does not double-prefix or change a saved application path", () => {
    expect(languagePath('/en/apply/REF/interview','ar')).toBe('/ar/apply/REF/interview');
    expect(languagePath('/','ar')).toBe('/ar');
  });
  it.each([['ar-AE, en;q=0.8','ar'],['ar;q=0.1,en;q=0.9','en'],['ar;q=0,en;q=1','en'],['fr','en']])('negotiates %s', (header,wanted) => expect(preferredLanguage(header)).toBe(wanted));
  it("sets Arabic language, direction, exact metadata and reciprocal URLs in server HTML", () => {
    const html=renderPageTemplate('<html><head><!--PAGE_METADATA--></head><body><div id="root"></div></body></html>',fixedMetadata('/ar/visa-prices'));
    expect(html).toContain('<html lang="ar" dir="rtl">');
    expect(html).toContain(fixedMetadata('/visa-prices','ar')!.title);
    expect(html).toContain('rel="canonical" href="https://www.tashiraev.com/ar/visa-prices"');
    expect(html).toContain('hreflang="en" href="https://www.tashiraev.com/en/visa-prices"');
    expect(html).toContain('hreflang="ar" href="https://www.tashiraev.com/ar/visa-prices"');
    expect(html).toContain('hreflang="x-default" href="https://www.tashiraev.com/en/visa-prices"');
  });
});
