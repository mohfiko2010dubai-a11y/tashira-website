import { describe, expect, it } from "vitest";
import { renderPageTemplate } from "./ssr-html";
import { articleMetadata } from "../../contracts/ssr-pages";

describe("SSR metadata and serialized public state", () => {
  it("escapes metadata and prevents script-breakout in dehydrated content", () => {
    const template = '<html><head><!--PAGE_METADATA--></head><body><div id="root"></div></body></html>';
    const html = renderPageTemplate(template, { title: 'A "title" <test>', description: 'a&b', canonicalPath: '/guides/example' }, { html: '<h1>Article</h1>', state: { excerpt: '</script><script>alert(1)</script>' } });
    expect(html).toContain('A &quot;title&quot; &lt;test&gt;');
    expect(html).toContain('content="a&amp;b"');
    expect(html).not.toContain('<script>alert(1)');
    expect(html).toContain('lang="en" dir="ltr"');
    expect(html).toContain('<h1>Article</h1>');
  });
  it("derives article metadata only from its own title and excerpt", () => {
    const meta = articleMetadata({ title: 'Article title', excerpt: '  ' + 'x'.repeat(160) + '  ' }, '/guides/example');
    expect(meta.title).toBe('Article title | TASHIRA');
    expect(meta.description).toBe('x'.repeat(155));
    expect(articleMetadata({ title: 'Missing excerpt' }, '/guides/missing').description).toBe('');
  });
});
