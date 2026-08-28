import { describe, expect, it } from "vitest";
import { applicantProfileProjection, parseStoredInterviewAnswer } from "./mysql-interview-answer-repository";

describe("stored Dynamic Interview answer decoding", () => {
  it("accepts MySQL-decoded text and quoted JSON text without parsing plain text twice", () => {
    expect(parseStoredInterviewAnswer("EG", "TEXT")).toBe("EG");
    expect(parseStoredInterviewAnswer('"PK"', "SELECT")).toBe("PK");
    expect(parseStoredInterviewAnswer("2027-01-20", "DATE")).toBe("2027-01-20");
  });

  it("decodes typed boolean and number values deterministically", () => {
    expect(parseStoredInterviewAnswer("true", "BOOLEAN")).toBe(true);
    expect(parseStoredInterviewAnswer("0", "BOOLEAN")).toBe(false);
    expect(parseStoredInterviewAnswer("42", "NUMBER")).toBe(42);
    expect(() => parseStoredInterviewAnswer("not-a-number", "NUMBER")).toThrow("INTERVIEW_STORED_ANSWER_INVALID");
  });
});

describe("applicant profile projection", () => {
  it("projects only explicit applicant-scoped operational profile answers", () => {
    expect(applicantProfileProjection("NATIONALITY", " EG ")).toEqual({ column: "nationality", value: "EG" });
    expect(applicantProfileProjection("RESIDENCE_COUNTRY", "AE")).toEqual({ column: "gcc_residence_country", value: "AE" });
    expect(applicantProfileProjection("GCC_COUNTRY", "SA")).toEqual({ column: "gcc_residence_country", value: "SA" });
    expect(applicantProfileProjection("PROFESSION", "Engineer")).toEqual({ column: "profession", value: "Engineer" });
  });

  it("does not project unrelated, empty, or boolean answers", () => {
    expect(applicantProfileProjection("TRAVELLING_TOGETHER", true)).toBeNull();
    expect(applicantProfileProjection("PASSPORT_COUNTRY", "EG")).toBeNull();
    expect(applicantProfileProjection("NATIONALITY", "  ")).toBeNull();
  });
});
