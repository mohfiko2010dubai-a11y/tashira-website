import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { InterviewRequirementDocuments } from "./InterviewRequirementDocuments";
import { legacyDocumentType } from "./requirement-document-type";
vi.mock("react-i18next", () => ({ useTranslation: () => ({ i18n: { language: "en" } }) }));

const applicants = [
  { applicantId: 11, applicantIndex: 0, fullName: "Synthetic Father", nationality: "EG", residenceCountry: "AE", profileVersion: 2 },
  { applicantId: 12, applicantIndex: 1, fullName: "Synthetic Child", nationality: "PK", residenceCountry: "QA", profileVersion: 4 },
];

describe("InterviewRequirementDocuments", () => {
  it("keeps extra passport pages and residence reports as independent required uploads", () => {
    const html = renderToStaticMarkup(<InterviewRequirementDocuments applicants={[applicants[1]]} busy={false} error={false}
      onUpload={vi.fn(async () => undefined)} requirements={[
        { applicantId: 12, requirementCode: "PASSPORT", documentType: "PASSPORT", state: "UPLOADED" },
        { applicantId: 12, requirementCode: "PASSPORT_SECOND_PAGE", documentType: "PASSPORT", state: "MISSING" },
        { applicantId: 12, requirementCode: "SA_ABSHER_REPORT", documentType: "GCC_RESIDENCE", state: "MISSING" },
      ]} />);
    expect(html).toContain("Passport — second page");
    expect(html).toContain("Absher residence report (separate document)");
    expect(html.match(/type="file"/g)).toHaveLength(2);
  });
  it("maps canonical requirements onto the existing storage document classes", () => {
    expect(legacyDocumentType("PASSPORT")).toBe("passport");
    expect(legacyDocumentType("PERSONAL_PHOTO")).toBe("photo");
    expect(legacyDocumentType("NATIONAL_ID")).toBe("national_id");
    expect(legacyDocumentType("GCC_RESIDENCE_CARD")).toBe("gcc_residence");
    expect(legacyDocumentType("SPONSOR_ID")).toBe("sponsor_id");
    expect(legacyDocumentType("HOTEL_BOOKING")).toBe("supporting");
  });

  it("renders each requirement only inside its owning applicant section", () => {
    const html = renderToStaticMarkup(<InterviewRequirementDocuments applicants={applicants} busy={false} error={false}
      onUpload={vi.fn(async () => undefined)} requirements={[
        { applicantId: 11, requirementCode: "PASSPORT", documentType: "PASSPORT", state: "MISSING" },
        { applicantId: 12, requirementCode: "PERSONAL_PHOTO", documentType: "PERSONAL_PHOTO", state: "UPLOADED" },
      ]} />);
    const fatherStart = html.indexOf("Synthetic Father");
    const childStart = html.indexOf("Synthetic Child");
    expect(fatherStart).toBeGreaterThan(-1);
    expect(childStart).toBeGreaterThan(fatherStart);
    expect(html.slice(fatherStart, childStart)).toContain("Passport — complete, clear personal data page");
    expect(html.slice(fatherStart, childStart)).not.toContain("PERSONAL PHOTO");
    expect(html.slice(childStart)).toContain("PERSONAL PHOTO");
    expect(html.match(/type="file"/g)).toHaveLength(1);
  });

  it("does not expose finance or payment internals", () => {
    const html = renderToStaticMarkup(<InterviewRequirementDocuments applicants={applicants} busy={false} error={false}
      onUpload={vi.fn(async () => undefined)} requirements={[
        { applicantId: 11, requirementCode: "PASSPORT", documentType: "PASSPORT", state: "MISSING" },
      ]} />);
    expect(html).not.toMatch(/supplier cost|internal cost|margin|profit|stripe|payment intent/i);
  });
});
