import { describe, expect, it } from "vitest";
import { parseStoredInterviewAnswer } from "./mysql-interview-answer-repository";

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
