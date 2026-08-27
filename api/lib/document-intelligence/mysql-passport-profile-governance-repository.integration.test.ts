import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, type Pool } from "mysql2/promise";
import type { AuthorizationActor } from "../authorization/policy";
import type { PassportProfile } from "./contracts";
import { MysqlPassportProfileGovernanceRepository } from "./mysql-passport-profile-governance-repository";

const enabled=process.env.RUN_DOCUMENT_INTELLIGENCE_MYSQL_INTEGRATION==="1";
const actor=(permission:"rule.propose"|"rule.review"|"rule.activate"|"rule.read"):AuthorizationActor=>({id:`staff:${permission}`,permissions:new Set([permission]),scopes:["ALL"],teamIds:new Set(),departmentIds:new Set()});

describe.skipIf(!enabled)("MySQL Passport Profile governance",()=>{
  let pool:Pool;let repository:MysqlPassportProfileGovernanceRepository;let profileId="";const code=`STAGING_TEST_${randomUUID().slice(0,8)}`;
  const profile:Omit<PassportProfile,"profileId"|"lifecycle">={version:1,issuingCountry:"XTS",passportType:"P",layoutVersion:"SYNTHETIC_V1",
    expectedVisibleFields:["visual_full_name","passport_number"],optionalVisibleFields:["father_name"],labelAliases:{visual_full_name:["Synthetic Full Name"]},
    mrzType:"TD3",expectedMrzFields:["passport_number","date_of_birth","expiry_date"],languages:["synthetic"],nameStructure:"FULL_NAME",
    legitimatelyAbsentFields:[],extractionStrategy:"MRZ_THEN_SYNTHETIC_VISUAL",validationRules:["MRZ_CHECK_DIGITS"],confidenceThreshold:0.9,
    sourceEvidenceReferences:["STAGING_TEST_SYNTHETIC_NOT_REGULATORY"],effectiveFrom:"2026-01-01T00:00:00.000Z",effectiveTo:null,stagingTestOnly:true};
  beforeAll(async()=>{const uri=process.env.DOCUMENT_INTELLIGENCE_MYSQL_URL;if(!uri)throw new Error("DOCUMENT_INTELLIGENCE_MYSQL_URL_REQUIRED");pool=createPool({uri,connectionLimit:3});repository=new MysqlPassportProfileGovernanceRepository(pool);});
  afterAll(async()=>{await pool?.end();});

  it("persists an immutable, replay-safe lifecycle with separated actors",async()=>{
    const importCommand=randomUUID();const draft=await repository.importDraft({profileCode:code,profile},importCommand,actor("rule.propose"),new Date());profileId=draft.profileId;
    expect(draft).toMatchObject({state:"DRAFT",entityVersion:1});expect(await repository.importDraft({profileCode:code,profile},importCommand,actor("rule.propose"),new Date(draft.eventId.length?Date.now():0))).toMatchObject({profileId,state:"DRAFT"});
    await expect(repository.transition({profileId,expectedState:"DRAFT",expectedEntityVersion:1,action:"SUBMIT_FOR_REVIEW",reason:"Synthetic review",commandId:randomUUID(),environment:"STAGING",occurredAt:new Date()},actor("rule.review"))).rejects.toThrow("PASSPORT_PROFILE_GOVERNANCE_ACCESS_DENIED");
    const review=await repository.transition({profileId,expectedState:"DRAFT",expectedEntityVersion:1,action:"SUBMIT_FOR_REVIEW",reason:"Synthetic review",commandId:randomUUID(),environment:"STAGING",occurredAt:new Date()},actor("rule.propose"));
    const approved=await repository.transition({profileId,expectedState:"UNDER_REVIEW",expectedEntityVersion:2,action:"APPROVE",reason:"Synthetic evidence approved",commandId:randomUUID(),environment:"STAGING",occurredAt:new Date()},actor("rule.review"));
    expect(review.entityVersion).toBe(2);expect(approved.state).toBe("APPROVED");
    await expect(repository.transition({profileId,expectedState:"UNDER_REVIEW",expectedEntityVersion:2,action:"APPROVE",reason:"Stale",commandId:randomUUID(),environment:"STAGING",occurredAt:new Date()},actor("rule.review"))).rejects.toThrow("PASSPORT_PROFILE_VERSION_CONFLICT");
    const active=await repository.transition({profileId,expectedState:"APPROVED",expectedEntityVersion:3,action:"ACTIVATE",reason:"Synthetic staging activation",commandId:randomUUID(),environment:"STAGING",occurredAt:new Date()},actor("rule.activate"));
    expect(active).toMatchObject({state:"ACTIVE",entityVersion:4});
  });

  it("loads synthetic ACTIVE profiles in Staging but never Production",async()=>{
    expect(await repository.activeProfiles({evaluatedAt:new Date(),environment:"STAGING"})).toContainEqual(expect.objectContaining({profileId,lifecycle:"ACTIVE",stagingTestOnly:true}));
    expect((await repository.activeProfiles({evaluatedAt:new Date(),environment:"PRODUCTION"})).some(item=>item.profileId===profileId)).toBe(false);
    const history=await repository.list(actor("rule.read"));expect(history.filter(item=>item.profileId===profileId).map(item=>item.state)).toEqual(["ACTIVE","APPROVED","UNDER_REVIEW","DRAFT"]);
  });
});
