import { describe, expect, it, vi } from "vitest";
import { focusInvalidField } from "./useValidationFeedback";
import { validStartContact, validStartEmail, validStartPhone } from "@/lib/wizard-validation";
import { minimumPassportExpiry, validPassportExpiry } from "@contracts/traveller-details";
import en from "@/i18n/locales/en/wizard.json";

describe("wizard validation feedback regression", () => {
  it("scrolls and focuses the first invalid control without a second scroll", () => {
    const control = { scrollIntoView: vi.fn(), focus: vi.fn() };
    const form = { querySelector: vi.fn(() => control) };
    focusInvalidField(form as unknown as HTMLElement);
    expect(form.querySelector).toHaveBeenCalledWith('[aria-invalid="true"]');
    expect(control.scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "smooth" });
    expect(control.focus).toHaveBeenCalledWith({ preventScroll: true });
  });
  it("keeps individual contact messages aligned with the existing combined gate", () => {
    for (const email of ["", "notanemail", " user@example.com ", "a@b.c", "a+b@example.com"]) {
      for (const phone of ["", "123", "+971 (50) 123-4567", "1234567", "+1234567890123456", "call me"]) {
        expect(validStartEmail(email) && validStartPhone(phone)).toBe(validStartContact(email, phone));
      }
    }
    expect(en.validation.emailRequired).toBe("Enter the email address where we should send your visa.");
    expect(en.validation.emailInvalid).toBe("This email address is not valid. Check for a typo.");
  });
  it("preserves the six-month boundary and required expiry copy", () => {
    const now = new Date("2026-09-13T12:00:00Z");
    const minimum = minimumPassportExpiry(null, now);
    expect(minimum).toBe("2027-03-13");
    expect(validPassportExpiry("2026-10-01", null, now)).toBe(false);
    expect(validPassportExpiry(minimum, null, now)).toBe(true);
    expect(validPassportExpiry("2030-01-15", null, now)).toBe(true);
    expect(en.validation.passportExpiry.replace("{{date}}", minimum)).toBe(`Passport must be valid until at least ${minimum}. Enter a passport with a later expiry date.`);
  });
});
