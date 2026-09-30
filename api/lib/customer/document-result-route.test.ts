import { describe, expect, it } from "vitest";
import { documentResultContext, documentResultSearch } from "../../../contracts/document-result-route";
import { requiredDocuments } from "../../../contracts/document-requirement-engine";
import { fixedMetadata } from "../../../contracts/ssr-pages";
import { renderPageTemplate } from "../ssr-html";

describe("shareable document results", () => {
  const search = "nat=PK&res=SA&type=30d&purpose=tourism&companion=0";
  it("round trips public inputs and produces the approved eight-file Saudi/Pakistani set", () => {
    const context = documentResultContext(new URLSearchParams(search));expect(context).not.toBeNull();
    expect(documentResultSearch(context!)).toBe(search);expect(requiredDocuments(context!)).toHaveLength(8);
  });
  it.each(["nat=XX&res=SA&type=30d&purpose=tourism", "nat=PK&res=ZZ&type=30d&purpose=tourism", search + "&email=private%40example.invalid", search + "&nat=EG", "nat=EG&res=EG&type=30d&purpose=tourism&companion=1", search.replace("type=30d", "type=unknown")])("returns the empty state for invalid or extra input %s", value => {
    expect(documentResultContext(new URLSearchParams(value))).toBeNull();
  });
  it("renders reciprocal language canonicals with only the validated public inputs", () => {
    const meta = fixedMetadata("/ar/documents", "ar", "?" + search);
    const html = renderPageTemplate('<html><head><!--PAGE_METADATA--></head><body><div id="root"></div></body></html>', meta);
    expect(html).toContain('<html lang="ar" dir="rtl">');
    expect(html).toContain('rel="canonical" href="https://www.tashiraev.com/ar/documents?nat=PK&amp;res=SA');
    expect(html).toContain('hreflang="en" href="https://www.tashiraev.com/en/documents?nat=PK&amp;res=SA');
    expect(fixedMetadata('/ar/documents', 'ar', '?email=private@example.invalid')?.canonicalPath).toBe('/ar/documents');
  });
});
