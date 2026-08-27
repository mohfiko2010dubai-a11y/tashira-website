import { randomUUID } from "node:crypto";
import { describe,expect,it,vi } from "vitest";
import type { TrpcContext } from "./context";
import { createPassportProfileGovernanceRouter } from "./passport-profile-governance-router";
import type { AuthorizationActor } from "./lib/authorization/policy";
import type { FeatureFlagRecord } from "./lib/feature-flags/feature-flags";

const actor:AuthorizationActor={id:"staff:7",permissions:new Set(["rule.read","rule.propose","rule.review","rule.activate"]),scopes:["ALL"],teamIds:new Set(),departmentIds:new Set()};
const flag:FeatureFlagRecord={flagKey:"DOCUMENT_INTELLIGENCE",environment:"STAGING",enabled:true,scopeType:"GLOBAL",scopeReference:""};
const ctx=():TrpcContext=>({req:new Request("https://internal.invalid"),resHeaders:new Headers(),isAdmin:false,staffId:7,customerApplicationReferences:new Set()});
const profile={version:1,issuingCountry:"XTS",passportType:"P",layoutVersion:"SYNTHETIC",expectedVisibleFields:["visual_full_name"],optionalVisibleFields:[],
  labelAliases:{visual_full_name:["Synthetic Name"]},mrzType:"TD3" as const,expectedMrzFields:["passport_number"],languages:["synthetic"],nameStructure:"FULL_NAME" as const,
  legitimatelyAbsentFields:[],extractionStrategy:"SYNTHETIC_ONLY",validationRules:["MRZ_CHECK_DIGITS"],confidenceThreshold:0.9,
  sourceEvidenceReferences:["STAGING_TEST_SYNTHETIC_NOT_REGULATORY"],effectiveFrom:"2026-01-01T00:00:00.000Z",effectiveTo:null,stagingTestOnly:true};
function setup(flags:readonly FeatureFlagRecord[]=[flag]){const repository={list:vi.fn(async()=>[]),importDraft:vi.fn(async()=>({profileId:"p",profileCode:"STAGING_TEST",version:1,state:"DRAFT" as const,eventId:"e",entityVersion:1})),transition:vi.fn(async()=>({profileId:"p",profileCode:"STAGING_TEST",version:1,state:"ACTIVE" as const,eventId:"e",entityVersion:4}))};
  return{repository,caller:createPassportProfileGovernanceRouter({actorForContext:async()=>actor,flagContextForContext:()=>({environment:"STAGING"}),flagsForContext:async()=>flags,repository,now:()=>new Date("2026-08-27T00:00:00Z")}).createCaller(ctx())};}
describe("Passport Profile governance API",()=>{
  it("does not reach persistence while the feature is closed",async()=>{const{caller,repository}=setup([]);await expect(caller.list({})).rejects.toMatchObject({code:"FORBIDDEN"});expect(repository.list).not.toHaveBeenCalled();});
  it("passes server-derived actor and environment",async()=>{const{caller,repository}=setup();const commandId=randomUUID();await caller.importDraft({profileCode:"STAGING_TEST",profile,commandId});expect(repository.importDraft).toHaveBeenCalledWith(expect.objectContaining({profileCode:"STAGING_TEST"}),commandId,actor,new Date("2026-08-27T00:00:00Z"));
    await caller.transition({profileId:randomUUID(),expectedState:"APPROVED",expectedEntityVersion:3,action:"ACTIVATE",reason:"Synthetic activation",commandId:randomUUID()});expect(repository.transition).toHaveBeenCalledWith(expect.objectContaining({environment:"STAGING"}),actor);});
  it("rejects unknown client authority fields",async()=>{const{caller}=setup();await expect(caller.importDraft({...({profileCode:"STAGING_TEST",profile,commandId:randomUUID(),role:"OWNER"})})).rejects.toMatchObject({code:"BAD_REQUEST"});});
});
