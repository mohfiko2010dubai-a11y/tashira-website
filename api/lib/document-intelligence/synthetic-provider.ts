import { validateProviderResult, type CanonicalDocumentIntelligenceAdapter, type CanonicalDocumentIntelligenceResult,
  type DocumentClassification, type DocumentReferenceInput, type TextExtraction } from "./provider";

export type SyntheticDocumentFixture={classification:DocumentClassification;text:TextExtraction;result:CanonicalDocumentIntelligenceResult};
export class SyntheticDocumentIntelligenceAdapter implements CanonicalDocumentIntelligenceAdapter{
  readonly providerCode="STAGING_TEST_SYNTHETIC_PROVIDER";readonly #fixtures:ReadonlyMap<string,SyntheticDocumentFixture>;
  constructor(fixtures:Readonly<Record<string,SyntheticDocumentFixture>>){this.#fixtures=new Map(Object.entries(fixtures));}
  #fixture(input:DocumentReferenceInput):SyntheticDocumentFixture{const fixture=this.#fixtures.get(input.documentReference);if(!fixture)throw new Error("SYNTHETIC_DOCUMENT_FIXTURE_NOT_FOUND");
    if(input.pageCount!==fixture.text.pageCount)throw new Error("SYNTHETIC_DOCUMENT_PAGE_COUNT_MISMATCH");return fixture;}
  async classifyDocument(input:DocumentReferenceInput){return structuredClone(this.#fixture(input).classification);}
  async extractText(input:DocumentReferenceInput){return structuredClone(this.#fixture(input).text);}
  async extractStructuredFields(input:DocumentReferenceInput&{expectedFieldCodes:readonly string[]}){const result=this.#result(input);const allowed=new Set(input.expectedFieldCodes);
    return{...result,fields:result.fields.filter(field=>allowed.has(field.fieldCode))};}
  async analyzePassport(input:DocumentReferenceInput&{passportProfileId:string|null}){const result=this.#result(input);if(result.documentType!=="PASSPORT")throw new Error("SYNTHETIC_DOCUMENT_TYPE_MISMATCH");
    if(input.passportProfileId!==result.passportProfileId)throw new Error("SYNTHETIC_PASSPORT_PROFILE_MISMATCH");return result;}
  async analyzeResidence(input:DocumentReferenceInput){return this.#typed(input,"RESIDENCE");}
  async analyzeNationalId(input:DocumentReferenceInput){return this.#typed(input,"NATIONAL_ID");}
  async analyzeTicket(input:DocumentReferenceInput){return this.#typed(input,"TICKET");}
  #typed(input:DocumentReferenceInput,type:string){const result=this.#result(input);if(result.documentType!==type)throw new Error("SYNTHETIC_DOCUMENT_TYPE_MISMATCH");return result;}
  #result(input:DocumentReferenceInput){return validateProviderResult(this.#fixture(input).result);}
}
