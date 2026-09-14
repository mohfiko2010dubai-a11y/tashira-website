export const MAX_SUPPORTING_DOCUMENTS = 6;
export const MAX_ADDITIONAL_NOTES_LENGTH = 5000;
export function mayAddSupportingDocument(existingCount: number, alreadyLinked: boolean): boolean {
  return alreadyLinked || existingCount < MAX_SUPPORTING_DOCUMENTS;
}
