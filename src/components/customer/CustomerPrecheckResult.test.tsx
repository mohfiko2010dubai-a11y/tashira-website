import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import CustomerPrecheckResult from "./CustomerPrecheckResult";
import { InterviewRequirementDocuments } from "./InterviewRequirementDocuments";
import { requiredDocuments } from "@contracts/document-requirement-engine";
vi.mock("react-i18next", () => ({ useTranslation: () => ({ i18n: { language: "en" } }) }));

describe("CustomerPrecheckResult", () => {
  it("renders the same eight slots and six grouped cards as the wizard, with optional flight outside the count", () => {
    const context = { nationality: "PK", country_of_residence: "SA", visa_type: "30days-single", trip_purpose: "tourism" as const };
    const html = renderToStaticMarkup(<MemoryRouter><CustomerPrecheckResult context={context} /></MemoryRouter>);
    const wizard = renderToStaticMarkup(<InterviewRequirementDocuments busy={false} error={false} onUpload={vi.fn()}
      applicants={[{ applicantId: 1, applicantIndex: 0, fullName: "Synthetic", nationality: "PK", residenceCountry: "SA", profileVersion: 1 }]}
      requirements={requiredDocuments(context).map(rule => ({ applicantId: 1, requirementCode: rule.code, documentType: rule.document_type, state: "MISSING" }))} />);
    const attributes = (markup: string, name: string) => [...markup.matchAll(new RegExp(`${name}="([^"]+)"`, "g"))].map(match => match[1]);
    expect(attributes(html, "data-document-code")).toEqual(attributes(wizard, "data-document-code"));
    expect(attributes(html, "data-document-card")).toEqual(attributes(wizard, "data-document-card"));
    expect(html).toContain("Your documents: 8 files");
    expect(html).toContain("After payment, optional");
    expect(html).toContain("It is not a visa approval or a guarantee");
    expect(html).toContain("nationality=PK&amp;residence=SA&amp;residence_type=&amp;purpose=tourism");
    expect(attributes(html, "data-document-code")).not.toContain("RETURN_TICKET");
  });
  it("renders a meaningful empty state without a misleading result or CTA", () => {
    const html = renderToStaticMarkup(<CustomerPrecheckResult context={null} />);
    expect(html).toContain("Answer the questions to see your exact list — usually 6 to 9 files.");
    expect(html).toContain("data-document-skeleton");
    expect(html).not.toContain("href=");
  });
});
