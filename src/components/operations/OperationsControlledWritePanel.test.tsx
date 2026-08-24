import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { OperationsCaseReadModel } from "../../../api/lib/operations/case-read-model";
import type { EvaluationEvidenceSnapshot } from "../../../api/lib/eligibility/evaluation-evidence";
import type { OperationsWriteCapabilities } from "../../../api/lib/operations/mysql-controlled-write-executor";
import { OperationsControlledWritePanel } from "./OperationsControlledWritePanel";
import { controlledWriteErrorMessage, resolveControlledWriteKey } from "./controlled-write-ui";

const execute = async () => undefined;

function fixture(legacy=false): OperationsCaseReadModel {
  const evaluation:EvaluationEvidenceSnapshot={evaluationId:"eval-11",applicationId:1,applicantId:11,engineVersion:"eligibility-v1",selectedRoute:"FAMILY",evaluatedAt:"2026-08-24T00:00:00.000Z",eligibilityState:"ELIGIBLE",reason:"Synthetic",reevaluationReason:null,supersedesEvaluationId:null,manualReviewReason:null,matchedRuleIds:["RULE"],matchedRuleVersions:[{ruleId:"RULE",version:2}],sourceAuthorities:["Authority"],matchedRules:[],requiredDocuments:["PASSPORT"],conditionalDocuments:[],warnings:[],precedenceTrace:[],evidenceSha256:"a".repeat(64),evidenceIntegrityReference:`sha256:${"a".repeat(64)}`};
  return {mode:legacy?"LEGACY_NOT_EVALUATED":"CURRENT",summary:{applicationId:1,reference:"TSH-SYNTHETIC",status:"documents_received",createdAt:"2026-08-24",assignedActorId:"staff:7",teamId:3,legacy},relationships:[],applicants:[
    {applicantId:11,applicantIndex:0,displayName:"Father",nationality:"Egypt",residenceCountry:"UAE",currentEvaluation:legacy?null:evaluation,previousEvaluations:legacy?[]:[{...evaluation,evaluationId:"eval-old",eligibilityState:"HUMAN_REVIEW_REQUIRED"}],evaluationChange:legacy?null:{previousEvaluationId:"eval-old",currentEvaluationId:"eval-11",changedFields:["eligibilityState"],reason:"Official rule changed"},currentRuleVersions:legacy?[]:[{ruleId:"RULE",version:2}],dynamicRequirements:legacy?[]:[{instance:{id:"req-11",applicationId:1,applicantId:11,evaluationId:"eval-11",catalogVersion:"v1",code:"PASSPORT",kind:"DOCUMENT",critical:true,conditional:false,createdAt:"2026-08-24"},currentState:"UPLOADED"}],documents:[{documentId:101,applicantId:11,code:"PASSPORT",readiness:"UPLOADED"}],manualReviewRequired:legacy},
    {applicantId:12,applicantIndex:1,displayName:"Child",nationality:"India",residenceCountry:"UAE",currentEvaluation:null,previousEvaluations:[],evaluationChange:null,currentRuleVersions:[],dynamicRequirements:[],documents:[{documentId:102,applicantId:12,code:"PHOTO",readiness:"UPLOADED"}],manualReviewRequired:true},
  ],familyReadiness:{family_readiness_state:"NOT_READY",blocking_applicant_ids:[12],blocking_reasons:[{applicant_id:12,code:"MANUAL_REVIEW_REQUIRED",reason:"Review child"}],member_states:[{applicant_id:11,evaluation_id:legacy?"":"eval-11",readiness_state:legacy?"MANUAL_REVIEW_REQUIRED":"READY"},{applicant_id:12,evaluation_id:"",readiness_state:"MANUAL_REVIEW_REQUIRED"}],required_customer_actions:[],manual_review_required:true,route_compatibility_warnings:[]},supplier:{id:5,name:"Synthetic Supplier",slaHours:24,reliabilityScore:95},operationalHistory:[{id:"event",event:"DOCUMENT_ACCEPTED",actorType:"STAFF",occurredAt:"2026-08-24"}],legacyWarnings:legacy?["LEGACY_NOT_EVALUATED"]:[]};
}

function capabilities(overrides:Partial<OperationsWriteCapabilities>={}):OperationsWriteCapabilities {
  return {applicationId:1,version:4,status:"documents_received",currentActorId:"staff:7",assignedActorId:"staff:7",teamId:3,humanReview:true,documentReview:true,assignmentModes:["REASSIGN","CLAIM"],validStatusTransitions:["under_review","documents_pending"],reevaluationApplicantIds:[11],documents:[{documentId:101,applicantId:11,version:2},{documentId:102,applicantId:12,version:0}],permittedAssignees:[{actorId:"staff:8",displayName:"Team Member"}],...overrides};
}

describe("Operations Controlled Write UI",()=>{
  it("renders no controls while the flag is off",()=>expect(renderToStaticMarkup(<OperationsControlledWritePanel enabled={false} model={fixture()} capabilities={capabilities()} execute={execute}/>)).toBe(""));

  it("renders only server-authorized actions and transitions",()=>{
    const html=renderToStaticMarkup(<OperationsControlledWritePanel enabled model={fixture()} capabilities={capabilities()} execute={execute}/>);
    expect(html).toContain("Human Review");expect(html).toContain("Document Review · Father");expect(html).toContain("Document Review · Child");expect(html).toContain("Assignment");expect(html).toContain("Status Transition");expect(html).toContain("Re-evaluation · Father");
    expect(html).toContain("under review");expect(html).toContain("documents pending");expect(html).not.toContain("visa processing");
  });

  it("hides unauthorized actions instead of treating the UI as authorization",()=>{
    const html=renderToStaticMarkup(<OperationsControlledWritePanel enabled model={fixture()} capabilities={capabilities({humanReview:false,documentReview:false,assignmentModes:[],validStatusTransitions:[],reevaluationApplicantIds:[]})} execute={execute}/>);
    expect(html).not.toContain("Human Review");expect(html).not.toContain("Document Review ·");expect(html).not.toContain("Status Transition");expect(html).not.toContain("Re-evaluation ·");
  });

  it("keeps document actions applicant scoped and requires reason plus confirmation",()=>{
    const html=renderToStaticMarkup(<OperationsControlledWritePanel enabled model={fixture()} capabilities={capabilities()} execute={execute}/>);
    expect(html).toContain("Father · PASSPORT");expect(html).toContain("Child · PHOTO");expect(html).toContain("Critical requirement");expect(html).toContain("NEEDS REPLACEMENT");expect(html).toContain("MANUAL REVIEW");expect(html).toContain("Reason");expect(html).toContain("I confirm this action");
  });

  it("lists only permitted assignees and supplier identity never finance",()=>{
    const financial={...fixture(),supplier:{id:5,name:"Synthetic Supplier",slaHours:24,reliabilityScore:95,internalCost:"SECRET",margin:"SECRET"}};
    const html=renderToStaticMarkup(<OperationsControlledWritePanel enabled model={financial} capabilities={capabilities()} execute={execute}/>);
    expect(html).toContain("Team Member");expect(html).not.toContain("Wrong Team");expect(html).not.toMatch(/internalCost|margin|SECRET|Stripe|payout/i);
  });

  it("keeps legacy evaluations explicit and disables fabricated re-evaluation",()=>{
    const html=renderToStaticMarkup(<OperationsControlledWritePanel enabled model={fixture(true)} capabilities={capabilities()} execute={execute}/>);
    expect(html).toContain("LEGACY_NOT_EVALUATED");expect(html).not.toContain("Re-evaluation ·");expect(html).not.toContain("eval-11");
  });

  it("maps safe API errors without raw server details",()=>{
    expect(controlledWriteErrorMessage(new Error("CONCURRENCY_CONFLICT"))).toContain("updated by another user");
    expect(controlledWriteErrorMessage(new Error("IDEMPOTENCY_CONFLICT"))).toContain("not retried");
    expect(controlledWriteErrorMessage(new Error("sql syntax near supplier_cost"))).not.toContain("sql");
  });

  it("reuses one idempotency key for a browser retry of the same intent",()=>{
    const first=resolveControlledWriteKey(null,()=>"intent-1");
    expect(resolveControlledWriteKey(first,()=>"intent-2")).toBe(first);
  });
});
