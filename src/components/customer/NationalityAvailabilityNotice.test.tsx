import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import NationalityAvailabilityNotice from "./NationalityAvailabilityNotice";
vi.mock("react-i18next", () => ({ useTranslation: () => ({ i18n: { language: "ar" } }) }));
vi.mock("@/providers/trpc-client", () => ({ trpc: { catalog: { nationalityAvailability: { useQuery: () => ({ data: { codes: ["IR", "SS", "UG", "CD"] } }) } } } }));
describe("customer availability guidance", () => {
  it("shows Arabic guidance and an actionable contact route for a restricted family member", () => {
    const html = renderToStaticMarkup(<MemoryRouter><NationalityAvailabilityNotice nationalities={["EG", "IR"]} /></MemoryRouter>);
    expect(html).toContain("التقديم غير متاح حاليًا لمواطني");expect(html).toContain('href="/contact"');expect(html).toContain("تواصل معنا");
  });
  it("does not show a notice for an available nationality", () => {
    expect(renderToStaticMarkup(<NationalityAvailabilityNotice nationalities={["PK"]} />)).toBe("");
  });
});
