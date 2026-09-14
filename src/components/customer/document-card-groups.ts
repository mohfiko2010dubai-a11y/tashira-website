type DocumentFile = { requirementCode: string; state: string };
export type DocumentCard<T extends DocumentFile> = { key: string; pair?: "passport" | "residence"; files: T[] };
export type DocumentGroup<T extends DocumentFile> = { key: "identity" | "residence" | "supporting"; cards: DocumentCard<T>[] };
const identity = new Set(["PASSPORT", "PK_PASSPORT_PAGE_2", "IN_PASSPORT_PAGE_LAST", "SY_PASSPORT_PAGE_LAST", "PERSONAL_PHOTO", "HOME_NATIONAL_ID"]);
const residence = new Set(["KSA_IQAMA_FRONT", "KSA_IQAMA_BACK", "KSA_RESIDENCE_PROOF", "SA_ABSHER_REPORT", "KWT_IQAMA_FRONT", "KWT_IQAMA_BACK", "KW_MOBILE_ID", "BH_RESIDENCE_REPORT", "QA_RESIDENCE_CARD", "OMN_ID_CARD", "QAT_RESIDENCE_FRONT", "QAT_RESIDENCE_BACK", "OMN_RESIDENCE_FRONT", "OMN_RESIDENCE_BACK"]);
export const documentComplete = (file: DocumentFile) => ["UPLOADED", "VALIDATED", "WAIVED"].includes(file.state);

/** Presentation only: every source requirement retains its own identity and evidence. */
export function documentCardGroups<T extends DocumentFile>(files: readonly T[]): DocumentGroup<T>[] {
  const consumed = new Set<string>();
  const cards: DocumentCard<T>[] = [];
  for (const file of files) {
    if (consumed.has(file.requirementCode)) continue;
    const pairCode = file.requirementCode === "PASSPORT" ? ["PK_PASSPORT_PAGE_2", "IN_PASSPORT_PAGE_LAST", "SY_PASSPORT_PAGE_LAST"]
      : file.requirementCode === "KSA_IQAMA_FRONT" ? ["KSA_IQAMA_BACK"] : file.requirementCode === "KWT_IQAMA_FRONT" ? ["KWT_IQAMA_BACK"]
      : file.requirementCode === "QAT_RESIDENCE_FRONT" ? ["QAT_RESIDENCE_BACK"] : file.requirementCode === "OMN_RESIDENCE_FRONT" ? ["OMN_RESIDENCE_BACK"] : [];
    const second = files.find(item => pairCode.includes(item.requirementCode));
    const pair = second ? file.requirementCode === "PASSPORT" ? "passport" : "residence" : undefined;
    const members = second ? [file, second] : [file];
    members.forEach(item => consumed.add(item.requirementCode));
    cards.push({ key: file.requirementCode, pair, files: members });
  }
  return (["identity", "residence", "supporting"] as const).map(key => ({ key, cards: cards.filter(card => {
    const code = card.files[0].requirementCode;
    return key === "identity" ? identity.has(code) : key === "residence" ? residence.has(code) : !identity.has(code) && !residence.has(code);
  }) })).filter(group => group.cards.length > 0);
}
