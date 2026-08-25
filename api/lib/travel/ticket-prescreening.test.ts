import { describe, expect, it } from "vitest";
import { prescreenTicket, type TicketExtraction } from "./ticket-prescreening";

const extraction = (passengerNames: readonly string[], confidence = 0.95): TicketExtraction => ({
  passengerNames, confidence, origin: "CAI", destination: "DXB", arrivalDate: "2026-12-01",
  departureDate: "2026-12-10", airline: "Synthetic Air", flightNumber: "SY100", bookingReference: "SYNTHETIC",
});

describe("AI ticket pre-screening boundary", () => {
  const applicants = [{ applicantId: 1, authoritativeName: "Fatima Ahmed" }, { applicantId: 2, authoritativeName: "Omar Ahmed" }];

  it("matches a shared family booking using authoritative applicant names", () => {
    expect(prescreenTicket({ extraction: extraction(["FATIMA AHMED", "Omar Ahmed"]), linkedApplicants: applicants }).state).toBe("PASS");
  });

  it("reports missing applicants without changing eligibility", () => {
    const result = prescreenTicket({ extraction: extraction(["Fatima Ahmed"]), linkedApplicants: applicants });
    expect(result).toMatchObject({ state: "MISSING_APPLICANT", unmatchedApplicantIds: [2] });
    expect(result).not.toHaveProperty("eligibilityState");
  });

  it("fails unreadable and low-confidence extraction safely", () => {
    expect(prescreenTicket({ extraction: extraction([]), linkedApplicants: applicants }).state).toBe("UNREADABLE");
    expect(prescreenTicket({ extraction: extraction(["Fatima Ahmed", "Omar Ahmed"], 0.6), linkedApplicants: applicants }).state).toBe("WARNING");
  });
});
