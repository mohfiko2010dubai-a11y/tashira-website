export type Td3MrzResult = {
  documentCode: string;
  issuingCountry: string;
  mrzSurname: string;
  mrzGivenNames: string;
  passportNumber: string;
  nationality: string;
  dateOfBirth: string;
  sex: string;
  expiryDate: string;
  personalNumber: string;
  checkDigitsValid: boolean;
  validationErrors: readonly string[];
};

const weights = [7, 3, 1] as const;
function value(character: string): number {
  if (character === "<") return 0;
  if (/^[0-9]$/.test(character)) return Number(character);
  if (/^[A-Z]$/.test(character)) return character.charCodeAt(0) - 55;
  throw new Error("MRZ_CHARACTER_INVALID");
}
function check(source: string, digit: string): boolean {
  if (!/^[0-9]$/.test(digit)) return false;
  const total = [...source].reduce((sum, character, index) => sum + value(character) * weights[index % 3], 0);
  return total % 10 === Number(digit);
}
function date(value: string): string {
  if (!/^\d{6}$/.test(value)) throw new Error("MRZ_DATE_INVALID");
  return value;
}
function names(value: string): { surname: string; givenNames: string } {
  const [surname = "", given = ""] = value.split("<<", 2);
  return { surname: surname.replaceAll("<", " ").trim(), givenNames: given.replaceAll("<", " ").replace(/\s+/gu, " ").trim() };
}

export function parseTd3Mrz(lines: readonly string[]): Td3MrzResult {
  if (lines.length !== 2 || lines.some((line) => line.length !== 44 || line !== line.toUpperCase())) throw new Error("MRZ_TD3_LAYOUT_INVALID");
  const [first, second] = lines;
  if (!first || !second) throw new Error("MRZ_TD3_LAYOUT_INVALID");
  const parsedNames = names(first.slice(5));
  const errors: string[] = [];
  if (!check(second.slice(0, 9), second[9] ?? "")) errors.push("PASSPORT_NUMBER_CHECK_DIGIT_INVALID");
  if (!check(second.slice(13, 19), second[19] ?? "")) errors.push("DATE_OF_BIRTH_CHECK_DIGIT_INVALID");
  if (!check(second.slice(21, 27), second[27] ?? "")) errors.push("EXPIRY_DATE_CHECK_DIGIT_INVALID");
  if (!check(second.slice(28, 42), second[42] ?? "")) errors.push("PERSONAL_NUMBER_CHECK_DIGIT_INVALID");
  const composite = second.slice(0, 10) + second.slice(13, 20) + second.slice(21, 43);
  if (!check(composite, second[43] ?? "")) errors.push("COMPOSITE_CHECK_DIGIT_INVALID");
  return { documentCode: first.slice(0, 2).replaceAll("<", ""), issuingCountry: first.slice(2, 5),
    mrzSurname: parsedNames.surname, mrzGivenNames: parsedNames.givenNames, passportNumber: second.slice(0, 9).replaceAll("<", ""),
    nationality: second.slice(10, 13), dateOfBirth: date(second.slice(13, 19)), sex: second.slice(20, 21),
    expiryDate: date(second.slice(21, 27)), personalNumber: second.slice(28, 42).replaceAll("<", ""),
    checkDigitsValid: errors.length === 0, validationErrors: errors };
}

