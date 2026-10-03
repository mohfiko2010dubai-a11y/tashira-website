import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ApplicantDataForm, type FormQuestion } from "./ApplicantDataForm";

vi.mock("@/providers/trpc-client", () => ({ trpc: { dynamicInterview: { nationalityCatalog: { useQuery: () => ({ data: { nationalities: [] } }) } } } }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }) }));
vi.mock("./NationalitySelect", () => ({ default: ({ value, label }: { value: string; label: string }) => createElement("button", { type: "button", "aria-label": label }, value) }));
const applicant = { applicantId: 11, applicantIndex: 0, fullName: "Synthetic Form", nationality: "EG", residenceCountry: "SA", profileVersion: 1 };
const questions: FormQuestion[] = [
  { code: "GCC_RESIDENT", applicantId: 11, label: "GCC residency", answerType: "BOOLEAN", allowedValues: null },
  { code: "GCC_COUNTRY", applicantId: 11, label: "GCC country", answerType: "TEXT", allowedValues: null },
  { code: "RESIDENCE_EXPIRY", applicantId: 11, label: "Expiry", answerType: "DATE", allowedValues: null },
];
const render = (answer: boolean, applicantId = 11) => renderToStaticMarkup(createElement(ApplicantDataForm, {
  applicant: { ...applicant, residenceCountry: answer ? "SA" : "EG" }, residenceType: answer ? "gcc-resident" : "non-gcc", questions, saved: [{ code: "GCC_RESIDENT", applicantId, answer }], onSave: async () => {},
}));
describe("Grouped applicant form", () => {
  it('does not repeat context or a non-actionable document preview', () => {
    const html = renderToStaticMarkup(<ApplicantDataForm applicant={applicant} questions={questions} saved={[]} onSave={vi.fn(async () => undefined)} />);
    expect(html).not.toContain('aria-label="Nationality"');
    expect(html).not.toContain('simple.fields.RESIDENCE_COUNTRY');
    expect(html).not.toContain('Passport main data page');
    expect(html).toContain('value="Synthetic Form"');
    expect(html).toContain('simple.passportNumber');
  });
  it("renders saved profile and all required fields together", () => {
    const html = render(true);
    expect(html).toContain('value="Synthetic Form"');
    expect(html).not.toContain('field-11:GCC_RESIDENT');
    expect(html).not.toContain('field-11:GCC_COUNTRY');
    expect(html).not.toContain('simple.fields.RESIDENCE_COUNTRY');
    expect(html).toContain('Residence permit expiry');
    expect(html).not.toContain('disabled=""');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('noValidate=""');
  });
  it("does not require removed GCC fields when residency is false", () => {
    const html = render(false);
    expect(html).not.toContain('field-11:GCC_COUNTRY');
    expect(html).not.toContain('Residence permit expiry');
    expect(html).not.toContain('disabled=""');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('noValidate=""');
    expect(html).not.toContain('aria-pressed');
    expect(html).toContain("simple.passportNumber");
    expect(html).toContain("simple.passportExpiry");
    expect(html).toContain("simple.profession");
  });
  it("never hydrates another traveller's answer", () => {
    const html = render(true, 12);
    expect(html).toContain('Residence permit expiry');
    expect(html).not.toContain('disabled=""');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('noValidate=""');
    expect(html).not.toContain('field-11:GCC_RESIDENT');
  });
});
