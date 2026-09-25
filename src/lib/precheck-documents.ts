import { GCC_COUNTRIES, requiredDocuments, tripPurposeSchema, type DocumentRequirementContext } from "../../contracts/document-requirement-engine";
import { documentCardGroups } from "../components/customer/document-card-groups";

/** The same approved union and presentation used by the application wizard. */
export function precheckDocuments(context: DocumentRequirementContext) {
  const rules = requiredDocuments(context);
  const groups = documentCardGroups(rules.map(rule => ({ ...rule, requirementCode: rule.code, state: "MISSING" })));
  return { rules, groups };
}

export function precheckApplicationSearch(context: DocumentRequirementContext) {
  return new URLSearchParams({ visa: context.visa_type, nationality: context.nationality ?? "",
    residence: context.country_of_residence ?? "", purpose: context.trip_purpose ?? "tourism" }).toString();
}

/** Route data only: no storage, browser globals or customer/session data. */
export function precheckPrefill(params: URLSearchParams) {
  const code = (key: string) => /^[A-Z]{2}$/.test(params.get(key) ?? "") ? params.get(key)! : "";
  const country = code("residence");
  return { nationality: code("nationality"), country,
    residenceType: GCC_COUNTRIES.some(item => item === country) ? params.get("residence_type") === "gcc-accompany" ? "gcc-accompany" as const : "gcc-resident" as const : "non-gcc" as const,
    purpose: tripPurposeSchema.safeParse(params.get("purpose")).data ?? "tourism" as const };
}
