import { describe, expect, it } from "vitest";
import { requiredDocuments } from "../../../contracts/document-requirement-engine";
import { applicantName } from "../../../contracts/applicant-name";
import { customerMoney } from "../../../contracts/customer-money";
import { interviewTitle } from "../../../contracts/private-page-title";
import { renderPageTemplate } from "../ssr-html";
import { canonicalInvoiceCustomerName } from "../invoice-customer-identity";

describe("TASK17 family document and identity boundaries", () => {
  const rules = (nationality?: string) => requiredDocuments({ nationality,
    country_of_residence: "SA", residence_type: "gcc-resident", visa_type: "30days-single", trip_purpose: "tourism" });
  it("recomputes the second traveller's checklist without changing the first", () => {
    const egypt = rules("EG").map(rule => rule.code);
    const pending = rules().map(rule => rule.code);
    const pakistan = rules("PK").map(rule => rule.code);
    expect(egypt).toHaveLength(6);
    expect(pending).not.toContain("PK_PASSPORT_PAGE_2");
    expect(pakistan).toContain("PK_PASSPORT_PAGE_2");
    expect(pakistan).toContain("HOME_NATIONAL_ID");
    expect(pakistan).toEqual(expect.arrayContaining(egypt));
    expect(rules("EG").map(rule => rule.code)).toEqual(egypt);
  });
  it("keeps generated names out of legal identity and invoices", () => {
    expect(applicantName(" Applicant 2 ")).toBe("");
    expect(applicantName("O'BRIEN-SMITH")).toBe("O'BRIEN-SMITH");
    expect(() => canonicalInvoiceCustomerName([{ applicantIndex: 0, fullName: "Applicant 2",
      nationality: "EG", passportNumber: "SYNTHETIC", passportExpiry: "2030-01-01" }])).toThrow("Canonical applicant name is unavailable");
  });
  it.each(["en", "ar"] as const)("titles the private %s shell without indexing identifiers", language => {
    const html = renderPageTemplate('<html><head><!--PAGE_METADATA--></head><body><div id="root"></div></body></html>', null, undefined, language, interviewTitle(language));
    expect(html).toContain(`<title>${interviewTitle(language).replaceAll("&", "&amp;")}</title>`);
    expect(html).toContain('content="noindex, nofollow"');
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain('hreflang');
  });
  it("spells out the Arabic currency without a reordered US$ suffix", () => {
    expect(customerMoney(185, "ar")).toBe("185.00 دولار");
    expect(customerMoney(30, "ar-AE")).toBe("30.00 دولار");
    expect(customerMoney(185, "en")).toBe("$185.00");
  });
});
