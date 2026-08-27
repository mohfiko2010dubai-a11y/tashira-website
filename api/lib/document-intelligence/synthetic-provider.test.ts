import {describe,expect,it}from"vitest";import{SyntheticDocumentIntelligenceAdapter,type SyntheticDocumentFixture}from"./synthetic-provider";
const fixture:SyntheticDocumentFixture={classification:{documentType:"PASSPORT",confidence:0.99,detectedCountry:"XTS"},text:{rawTextReference:"secure:synthetic/raw",confidence:0.99,pageCount:1},
  result:{documentType:"PASSPORT",detectedCountry:"XTS",passportProfileId:"synthetic-profile",passportProfileVersion:1,fields:[
    {fieldCode:"visual_full_name",value:"SYNTHETIC PERSON",sourceType:"PASSPORT_VISUAL",confidence:0.99,rawLabel:"Synthetic Name",rawValue:"SYNTHETIC PERSON",boundingReference:"page:1:box:1"},
    {fieldCode:"passport_number",value:"SYN123",sourceType:"PASSPORT_MRZ",confidence:1}],rawTextReference:"secure:synthetic/raw",confidence:0.99,warnings:[],mismatches:[],provider:"STAGING_TEST_SYNTHETIC_PROVIDER",modelVersion:"v1",processingCost:0,processingCurrency:"USD",escalationReason:null,processingTimestamp:"2026-08-27T00:00:00Z"}};
const input={documentReference:"fixture-a",mimeType:"application/pdf",pageCount:1};
describe("provider-independent synthetic adapter",()=>{it("implements classification, text, profile analysis and profile-driven fields",async()=>{const adapter=new SyntheticDocumentIntelligenceAdapter({"fixture-a":fixture});
  expect(await adapter.classifyDocument(input)).toEqual(fixture.classification);expect(await adapter.extractText(input)).toEqual(fixture.text);
  expect((await adapter.analyzePassport({...input,passportProfileId:"synthetic-profile"})).fields).toHaveLength(2);
  expect((await adapter.extractStructuredFields({...input,expectedFieldCodes:["visual_full_name"]})).fields).toEqual([expect.objectContaining({fieldCode:"visual_full_name",rawLabel:"Synthetic Name"})]);});
  it("fails closed for unknown documents and profile mismatch",async()=>{const adapter=new SyntheticDocumentIntelligenceAdapter({"fixture-a":fixture});await expect(adapter.classifyDocument({...input,documentReference:"missing"})).rejects.toThrow("SYNTHETIC_DOCUMENT_FIXTURE_NOT_FOUND");await expect(adapter.analyzePassport({...input,passportProfileId:"wrong"})).rejects.toThrow("SYNTHETIC_PASSPORT_PROFILE_MISMATCH");});});
