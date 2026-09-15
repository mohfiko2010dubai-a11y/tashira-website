/** Old generated labels are presentation, never an applicant's legal name. */
export function applicantName(value: string | null | undefined): string {
  const name = value?.trim() ?? "";
  return /^Applicant\s+\d+$/i.test(name) ? "" : name;
}
