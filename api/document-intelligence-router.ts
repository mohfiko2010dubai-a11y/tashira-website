import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { TrpcContext } from "./context";
import type { AuthorizationActor } from "./lib/authorization/policy";
import type { FeatureFlagContext, FeatureFlagRecord } from "./lib/feature-flags/feature-flags";
import { isOperationsFlagEnabled } from "./lib/feature-flags/feature-flags";
import { MysqlDocumentIntelligenceRepository, type DocumentIntelligenceApplicantReadModel, type ReviewApplicantFieldInput, type ReviewApplicantFieldResult } from "./lib/document-intelligence/mysql-repository";
import { MysqlOperationsAccessProvider, OperationsAccessError } from "./lib/operations/mysql-access-provider";
import { defaultOperationsPool, defaultOperationsSqlClient } from "./lib/operations/mysql-query-client";
import { createRouter, staffOrAdminQuery } from "./middleware";

type Repository = { readApplicant(applicationReference: string, applicantId: number, actor: AuthorizationActor): Promise<DocumentIntelligenceApplicantReadModel>;
  reviewField(input:ReviewApplicantFieldInput,actor:AuthorizationActor):Promise<ReviewApplicantFieldResult> };
type Dependencies = {
  actorForContext(ctx: TrpcContext): Promise<AuthorizationActor>;
  flagContextForContext(ctx: TrpcContext): FeatureFlagContext | Promise<FeatureFlagContext>;
  flagsForContext(ctx: TrpcContext): Promise<readonly FeatureFlagRecord[]>;
  repository: Repository;
};

async function authorize(deps: Dependencies, ctx: TrpcContext): Promise<AuthorizationActor> {
  const [flagContext, flags] = await Promise.all([deps.flagContextForContext(ctx), deps.flagsForContext(ctx)]);
  if (!isOperationsFlagEnabled("DOCUMENT_INTELLIGENCE", flagContext, flags)) throw new TRPCError({ code: "FORBIDDEN", message: "Document Intelligence is disabled" });
  try { return await deps.actorForContext(ctx); }
  catch (error) { if (error instanceof OperationsAccessError) throw new TRPCError({ code: "FORBIDDEN", message: "Document Intelligence access denied" }); throw error; }
}
async function authorizeWrite(deps:Dependencies,ctx:TrpcContext):Promise<AuthorizationActor>{const [flagContext,flags]=await Promise.all([deps.flagContextForContext(ctx),deps.flagsForContext(ctx)]);
  if(!isOperationsFlagEnabled("DOCUMENT_INTELLIGENCE",flagContext,flags)||!isOperationsFlagEnabled("OPERATIONS_CONTROLLED_WRITES",flagContext,flags))throw new TRPCError({code:"FORBIDDEN",message:"Document Intelligence review is disabled"});
  try{return await deps.actorForContext(ctx);}catch(error){if(error instanceof OperationsAccessError)throw new TRPCError({code:"FORBIDDEN",message:"Document Intelligence access denied"});throw error;}}

function safe(error: unknown): never {
  if (error instanceof TRPCError) throw error;
  if (error instanceof Error && ["DOCUMENT_INTELLIGENCE_ACCESS_DENIED", "DOCUMENT_INTELLIGENCE_OWNERSHIP_INVALID"].includes(error.message)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Document Intelligence access denied" });
  }
  if(error instanceof Error&&["DOCUMENT_INTELLIGENCE_REVIEW_CONFLICT","DOCUMENT_INTELLIGENCE_IDEMPOTENCY_CONFLICT"].includes(error.message))throw new TRPCError({code:"CONFLICT",message:"Document Intelligence review changed; refresh and retry"});
  if(error instanceof Error&&error.message==="DOCUMENT_INTELLIGENCE_REVIEW_EVIDENCE_INVALID")throw new TRPCError({code:"PRECONDITION_FAILED",message:"Document Intelligence evidence is unavailable"});
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Document Intelligence could not be loaded" });
}

export function createDocumentIntelligenceRouter(deps: Dependencies) {
  return createRouter({ applicant: staffOrAdminQuery.input(z.object({ applicationReference: z.string().trim().min(3).max(40), applicantId: z.number().int().positive() }).strict())
    .query(async ({ ctx, input }) => { try { return await deps.repository.readApplicant(input.applicationReference, input.applicantId, await authorize(deps, ctx)); } catch (error) { safe(error); } }),
    reviewField:staffOrAdminQuery.input(z.object({applicationReference:z.string().trim().min(3).max(40),applicantId:z.number().int().positive(),fieldCode:z.string().trim().min(1).max(128),
      selectedEvidenceId:z.string().uuid(),expectedSelectionId:z.string().uuid(),commandId:z.string().uuid(),reason:z.string().trim().min(3).max(500)}).strict()).mutation(async({ctx,input})=>{
        try{return await deps.repository.reviewField({...input,occurredAt:new Date().toISOString()},await authorizeWrite(deps,ctx));}catch(error){safe(error);}}) });
}

let access: MysqlOperationsAccessProvider | undefined;
function accessProvider(): MysqlOperationsAccessProvider { access ??= new MysqlOperationsAccessProvider(defaultOperationsSqlClient()); return access; }
export const documentIntelligenceRouter = createDocumentIntelligenceRouter({
  actorForContext: (ctx) => accessProvider().actorForContext(ctx), flagContextForContext: (ctx) => accessProvider().flagContextForContext(ctx),
  flagsForContext: () => accessProvider().featureFlags(), repository: new MysqlDocumentIntelligenceRepository(defaultOperationsPool()),
});
