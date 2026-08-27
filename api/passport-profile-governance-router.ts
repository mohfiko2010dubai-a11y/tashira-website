import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { TrpcContext } from "./context";
import type { FeatureFlagContext, FeatureFlagRecord } from "./lib/feature-flags/feature-flags";
import { isOperationsFlagEnabled } from "./lib/feature-flags/feature-flags";
import { MysqlOperationsAccessProvider, OperationsAccessError } from "./lib/operations/mysql-access-provider";
import { defaultOperationsPool, defaultOperationsSqlClient } from "./lib/operations/mysql-query-client";
import { MysqlPassportProfileGovernanceRepository } from "./lib/document-intelligence/mysql-passport-profile-governance-repository";
import type { AuthorizationActor } from "./lib/authorization/policy";
import type { PassportProfileAction, PassportProfileState } from "./lib/document-intelligence/passport-profile-governance";
import { createRouter, staffOrAdminQuery } from "./middleware";

const text=z.string().trim().min(1).max(500);const iso=z.string().datetime();
const profile=z.object({version:z.number().int().positive(),issuingCountry:z.string().regex(/^[A-Z]{3}$/),passportType:z.string().trim().min(1).max(30),
  layoutVersion:z.string().trim().min(1).max(100),expectedVisibleFields:z.array(text).min(1).max(100),optionalVisibleFields:z.array(text).max(100),
  labelAliases:z.record(z.string(),z.array(text).min(1).max(20)),mrzType:z.enum(["TD1","TD2","TD3","NONE"]),expectedMrzFields:z.array(text).max(50),
  languages:z.array(text).min(1).max(20),nameStructure:z.enum(["FULL_NAME","SURNAME_GIVEN_NAMES","PROFILE_DEFINED"]),legitimatelyAbsentFields:z.array(text).max(100),
  extractionStrategy:text,validationRules:z.array(text).min(1).max(100),confidenceThreshold:z.number().positive().max(1),sourceEvidenceReferences:z.array(text).min(1).max(50),
  effectiveFrom:iso,effectiveTo:iso.nullable(),stagingTestOnly:z.boolean()}).strict();
const states=z.enum(["DRAFT","UNDER_REVIEW","APPROVED","ACTIVE","SUPERSEDED","RETIRED"] satisfies readonly PassportProfileState[]);
const actions=z.enum(["SUBMIT_FOR_REVIEW","APPROVE","ACTIVATE","SUPERSEDE","RETIRE"] satisfies readonly PassportProfileAction[]);
type Repository=Pick<MysqlPassportProfileGovernanceRepository,"list"|"importDraft"|"transition">;
type Dependencies={actorForContext(ctx:TrpcContext):Promise<AuthorizationActor>;flagContextForContext(ctx:TrpcContext):FeatureFlagContext|Promise<FeatureFlagContext>;
  flagsForContext(ctx:TrpcContext):Promise<readonly FeatureFlagRecord[]>;repository:Repository;now():Date};
async function gate(deps:Dependencies,ctx:TrpcContext){try{const [actor,flagContext,flags]=await Promise.all([deps.actorForContext(ctx),deps.flagContextForContext(ctx),deps.flagsForContext(ctx)]);
  if(!isOperationsFlagEnabled("DOCUMENT_INTELLIGENCE",flagContext,flags))throw new Error("PASSPORT_PROFILE_GOVERNANCE_DISABLED");return{actor,flagContext};}
catch(error){if(error instanceof OperationsAccessError||error instanceof Error&&["PASSPORT_PROFILE_GOVERNANCE_DISABLED","PASSPORT_PROFILE_GOVERNANCE_ACCESS_DENIED"].includes(error.message))throw new TRPCError({code:"FORBIDDEN",message:"Passport Profile governance access denied"});throw error;}}
function safe(error:unknown):never{if(error instanceof TRPCError)throw error;const message=error instanceof Error?error.message:"";
  if(["PASSPORT_PROFILE_GOVERNANCE_ACCESS_DENIED","PASSPORT_PROFILE_STAGING_TEST_PRODUCTION_FORBIDDEN"].includes(message))throw new TRPCError({code:"FORBIDDEN",message:"Passport Profile governance access denied"});
  if(["PASSPORT_PROFILE_VERSION_CONFLICT","PASSPORT_PROFILE_IDEMPOTENCY_CONFLICT","PASSPORT_PROFILE_ACTIVE_CONFLICT","PASSPORT_PROFILE_VERSION_EXISTS"].includes(message))throw new TRPCError({code:"CONFLICT",message:"Passport Profile changed; refresh and retry"});
  if(message==="PASSPORT_PROFILE_NOT_FOUND")throw new TRPCError({code:"NOT_FOUND",message:"Passport Profile not found"});throw new TRPCError({code:"BAD_REQUEST",message:"Passport Profile governance action rejected"});}
export function createPassportProfileGovernanceRouter(deps:Dependencies){return createRouter({
  list:staffOrAdminQuery.input(z.object({}).strict()).query(async({ctx})=>{try{const{actor}=await gate(deps,ctx);return await deps.repository.list(actor);}catch(error){safe(error);}}),
  importDraft:staffOrAdminQuery.input(z.object({profileCode:z.string().trim().min(3).max(128),profile,commandId:z.string().uuid()}).strict()).mutation(async({ctx,input})=>{try{const{actor}=await gate(deps,ctx);return await deps.repository.importDraft(input,input.commandId,actor,deps.now());}catch(error){safe(error);}}),
  transition:staffOrAdminQuery.input(z.object({profileId:z.string().uuid(),expectedState:states,expectedEntityVersion:z.number().int().positive(),action:actions,reason:z.string().trim().min(3).max(1000),commandId:z.string().uuid()}).strict()).mutation(async({ctx,input})=>{try{const{actor,flagContext}=await gate(deps,ctx);return await deps.repository.transition({...input,environment:flagContext.environment,occurredAt:deps.now()},actor);}catch(error){safe(error);}})});}
let access:MysqlOperationsAccessProvider|undefined;function accessProvider(){access??=new MysqlOperationsAccessProvider(defaultOperationsSqlClient());return access;}
export const passportProfileGovernanceRouter=createPassportProfileGovernanceRouter({actorForContext:ctx=>accessProvider().actorForContext(ctx),flagContextForContext:ctx=>accessProvider().flagContextForContext(ctx),flagsForContext:()=>accessProvider().featureFlags(),repository:new MysqlPassportProfileGovernanceRepository(defaultOperationsPool()),now:()=>new Date()});
