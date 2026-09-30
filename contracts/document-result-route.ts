import { NATIONALITY_CATALOG } from "../api/lib/requirements/nationality-catalog";
import { GCC_COUNTRIES, tripPurposeSchema, type DocumentRequirementContext } from "./document-requirement-engine";

const countries = new Set(NATIONALITY_CATALOG.map(country => country.code));
const products: Record<string, string> = { "14d": "14days-single", "30d": "30days-single", "60d": "60days-single", "90d": "90days-single",
  "14d-multiple": "14days-multiple", "30d-multiple": "30days-multiple", "60d-multiple": "60days-multiple", "96h": "96hours-transit" };
const keys = new Set(["nat", "res", "type", "purpose", "companion"]);
/** Only public rule inputs can enter a shared URL. Never serialize a form object. */
export function documentResultContext(params: URLSearchParams): DocumentRequirementContext | null {
  if ([...params.keys()].some(key => !keys.has(key) || params.getAll(key).length !== 1)) return null;
  const nat = params.get("nat") ?? "", res = params.get("res") ?? "", visa = products[params.get("type") ?? ""];
  const purpose = tripPurposeSchema.safeParse(params.get("purpose"));const companion = params.get("companion") ?? "0";
  if (!countries.has(nat) || !countries.has(res) || !visa || !purpose.success || !["0", "1"].includes(companion)) return null;
  const gcc = GCC_COUNTRIES.some(code => code === res);
  if (companion === "1" && !gcc) return null;
  return { nationality: nat, country_of_residence: res, visa_type: visa, trip_purpose: purpose.data,
    residence_type: companion === "1" ? "gcc-accompany" : gcc ? "gcc-resident" : "non-gcc" };
}
export function documentResultSearch(context: DocumentRequirementContext) {
  const type = Object.keys(products).find(key => products[key] === context.visa_type) ?? "";
  const result = new URLSearchParams({ nat: context.nationality ?? "", res: context.country_of_residence ?? "", type,
    purpose: context.trip_purpose ?? "tourism", companion: context.residence_type === "gcc-accompany" ? "1" : "0" });
  return documentResultContext(result) ? result.toString() : "";
}
