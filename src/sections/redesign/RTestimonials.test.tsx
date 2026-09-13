import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import RTestimonials from "./RTestimonials";
import { publishedTestimonials, type Testimonial } from "@/data/testimonials";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }) }));
const record: Testimonial = { id: "synthetic", name: "Synthetic Reviewer", country: "Test", textEn: "Synthetic test record only", status: "published" };
describe("Testimonials publication", () => {
  it("renders nothing by default and for an empty source", () => {
    expect(renderToStaticMarkup(createElement(RTestimonials))).toBe("");
    expect(renderToStaticMarkup(createElement(RTestimonials, { records: [] }))).toBe("");
  });
  it("excludes drafts and malformed records", () => {
    expect(publishedTestimonials([{ ...record, status: "draft" }, { ...record, textEn: "" }, null])).toEqual([]);
    expect(renderToStaticMarkup(createElement(RTestimonials, { records: [{ ...record, status: "draft" }] }))).toBe("");
  });
  it("renders published text without inventing a star rating", () => {
    const html = renderToStaticMarkup(createElement(RTestimonials, { records: [record] }));
    expect(html).toContain(record.textEn);
    expect(html).not.toContain("testimonials.rating");
    expect(html).not.toContain("lucide-star");
    const rated = renderToStaticMarkup(createElement(RTestimonials, { records: [{ ...record, rating: 3 }] }));
    expect(rated.match(/lucide-star/g)).toHaveLength(3);
  });
});
