import { describe, expect, it } from "vitest";
import { abandonedReminderStage } from "./abandoned-reminder-decision";
import type { ApplicationReadiness } from "./application-readiness";

const readiness = (codes: string[], status: ApplicationReadiness["status"] = "INCOMPLETE"): ApplicationReadiness => ({
  status,
  message: "review-only",
  applicationMissing: codes.filter((code) => code.startsWith("application.")).map((code) => ({ code, label: code })),
  applicants: [{ applicantId: 1, applicantIndex: 0, label: "Applicant 1", missing: codes.filter((code) => !code.startsWith("application.")).map((code) => ({ code, label: code })) }],
});

describe("abandoned application reminder eligibility", () => {
  it("stops every reminder immediately after payment", () => {
    expect(abandonedReminderStage({ paymentStatus: "paid", emailKnown: true, checkoutReached: true, readiness: readiness([]) })).toBeNull();
  });

  it("requires a known email", () => {
    expect(abandonedReminderStage({ paymentStatus: "pending", emailKnown: false, checkoutReached: false, readiness: readiness(["application.phone"]) })).toBeNull();
  });

  it("selects one highest-priority stage", () => {
    expect(abandonedReminderStage({ paymentStatus: "pending", emailKnown: true, checkoutReached: true, readiness: readiness([]) })).toBe("PAYMENT");
    expect(abandonedReminderStage({ paymentStatus: "pending", emailKnown: true, checkoutReached: false, readiness: readiness(["document.passport"]) })).toBe("DOCUMENTS");
    expect(abandonedReminderStage({ paymentStatus: "pending", emailKnown: true, checkoutReached: false, readiness: readiness(["application.phone"]) })).toBe("APPLICATION");
    expect(abandonedReminderStage({ paymentStatus: "pending", emailKnown: true, checkoutReached: false, readiness: readiness([], "READY") })).toBeNull();
  });
});
