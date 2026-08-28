import { useRef, useState } from "react";
import type { OperationsCaseReadModel } from "../../../api/lib/operations/case-read-model";
import type { DocumentReviewOutcome, HumanReviewOutcome } from "../../../api/lib/operations/controlled-write-repository";
import type { OperationsWriteCapabilities } from "../../../api/lib/operations/mysql-controlled-write-executor";
import { trpc } from "@/providers/trpc-client";
import { controlledWriteErrorMessage, resolveControlledWriteKey, type ControlledWriteCommand } from "./controlled-write-ui";

const HUMAN_OUTCOMES: readonly HumanReviewOutcome[] = ["APPROVED_FOR_NEXT_STEP", "NEEDS_CORRECTION", "MANUAL_REVIEW_REQUIRED", "REJECTED_OPERATIONALLY"];
const DOCUMENT_OUTCOMES: readonly DocumentReviewOutcome[] = ["ACCEPTED", "REJECTED", "NEEDS_REPLACEMENT", "UNREADABLE", "MISMATCH", "MANUAL_REVIEW"];

function isAssignmentMode(value: string): value is "ASSIGN" | "CLAIM" | "REASSIGN" {
  return value === "ASSIGN" || value === "CLAIM" || value === "REASSIGN";
}

type ActionFormProps<Option extends string> = {
  title: string;
  description: string;
  target: string;
  options: readonly Option[];
  optionLabel?: (option: Option) => string;
  submitLabel: string;
  onSubmit(option: Option, reason: string, idempotencyKey: string): Promise<void>;
  onRefresh?: () => Promise<void>;
};

function ActionForm<Option extends string>({ title, description, target, options, optionLabel, submitLabel, onSubmit, onRefresh }: ActionFormProps<Option>) {
  const [option, setOption] = useState<Option | "">("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const key = useRef<string | null>(null);
  if (options.length === 0) return null;
  return <form className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" onSubmit={async (event) => {
    event.preventDefault();
    if (!option || reason.trim().length < 3 || !confirmed || pending) return;
    key.current = resolveControlledWriteKey(key.current);
    setPending(true); setMessage("");
    try {
      await onSubmit(option, reason.trim(), key.current);
      setMessage("Action recorded. The canonical case view has been refreshed.");
      setOption(""); setReason(""); setConfirmed(false); key.current=null;
    } catch (error) { setMessage(controlledWriteErrorMessage(error)); }
    finally { setPending(false); }
  }}>
    <div><h3 className="font-semibold text-slate-900">{title}</h3><p className="mt-1 text-sm text-slate-600">{description}</p></div>
    <p className="rounded-lg bg-slate-50 p-2 text-sm"><strong>Target:</strong> {target}</p>
    <label className="block text-sm font-medium">Action
      <select aria-label={`${title} action`} className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={option} onChange={(event)=>{setOption(event.target.value as Option);key.current=null}}>
        <option value="">Select an approved action</option>{options.map((item)=><option key={item} value={item}>{optionLabel?.(item) ?? item.replaceAll("_"," ")}</option>)}
      </select>
    </label>
    <label className="block text-sm font-medium">Reason
      <textarea aria-label={`${title} reason`} className="mt-1 w-full rounded-lg border border-slate-300 p-2" rows={3} value={reason} onChange={(event)=>{setReason(event.target.value);key.current=null}} />
    </label>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={(event)=>setConfirmed(event.target.checked)} />
      <span>I confirm this action for <strong>{target}</strong>. It will create immutable operational and audit evidence using the reason above.</span>
    </label>
    {message&&<div role="status" className="rounded-lg bg-blue-50 p-2 text-sm text-blue-900"><p>{message}</p>{onRefresh&&message!=="Action recorded. The canonical case view has been refreshed."&&<button type="button" className="mt-2 underline" onClick={()=>void onRefresh()}>Refresh latest case</button>}</div>}
    <button type="submit" disabled={!option||reason.trim().length<3||!confirmed||pending} className="rounded-lg bg-amber-500 px-4 py-2 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">{pending?"Recording…":submitLabel}</button>
  </form>;
}

type PanelProps = {
  enabled: boolean;
  model: OperationsCaseReadModel;
  capabilities: OperationsWriteCapabilities | null;
  execute(command: ControlledWriteCommand): Promise<void>;
  refresh?: () => Promise<void>;
};

export function OperationsControlledWritePanel({ enabled, model, capabilities, execute, refresh }: PanelProps) {
  if (!enabled || !capabilities) return null;
  const assignOptions=capabilities.assignmentModes.flatMap((mode)=>mode==="CLAIM"?[`${mode}|${capabilities.currentActorId}`]:capabilities.permittedAssignees.map((assignee)=>`${mode}|${assignee.actorId}`));
  const humanContext=model.applicants.map((applicant)=>{
    const state=model.familyReadiness.member_states.find((item)=>item.applicant_id===applicant.applicantId)?.readiness_state??"NOT_EVALUATED";
    const blockers=model.familyReadiness.blocking_reasons.filter((item)=>item.applicant_id===applicant.applicantId).map((item)=>item.reason).join(", ")||"No blocking reason";
    const requirements=applicant.dynamicRequirements.map(({instance,currentState})=>`${instance.code} (${currentState??"NOT_RECORDED"})`).join(", ")||"No evaluated requirements";
    return `${applicant.displayName}: ${applicant.currentEvaluation?.eligibilityState??"NOT_EVALUATED"}; ${state}; ${blockers}; ${requirements}`;
  }).join(" | ");
  return <section aria-labelledby="controlled-write-title" className="space-y-5 rounded-2xl border border-amber-300 bg-amber-50/40 p-5" data-testid="operations-controlled-write-panel">
    <div><p className="text-xs font-semibold uppercase tracking-wider text-amber-800">Controlled write mode</p><h2 id="controlled-write-title" className="text-xl font-bold">Authorized Operations Actions</h2>
      <p className="text-sm text-slate-600">Server permissions, scope, ownership, prerequisites and version checks remain authoritative. Current entity version: <strong>{capabilities.version}</strong>.</p></div>
    {model.mode==="LEGACY_NOT_EVALUATED"&&<aside role="status" className="rounded-lg border border-amber-300 bg-amber-100 p-3 text-sm"><strong>LEGACY_NOT_EVALUATED:</strong> eligibility-based actions remain unavailable until the approved re-evaluation path creates real evidence.</aside>}
    {capabilities.humanReview&&<ActionForm title="Human Review" description={`Review the current family/applicant evidence and blockers. ${humanContext}`} target={`${model.summary.reference} · ${model.applicants.map((item)=>item.displayName).join(", ")}`} options={HUMAN_OUTCOMES} submitLabel="Record human review" onRefresh={refresh} onSubmit={(outcome,reason,idempotencyKey)=>execute({action:"HUMAN_REVIEW",outcome,reason,idempotencyKey})} />}
    {capabilities.documentReview&&model.applicants.flatMap((applicant)=>applicant.documents.map((document)=>{
      const control=capabilities.documents.find((item)=>item.documentId===document.documentId&&item.applicantId===applicant.applicantId);
      if(!control)return null;
      const requirement=applicant.dynamicRequirements.find(({instance})=>instance.code===document.code)?.instance;
      const warnings=applicant.currentEvaluation?.warnings.join(", ")||"No evaluation warning recorded";
      return <ActionForm key={`document-${document.documentId}`} title={`Document Review · ${applicant.displayName}`} description={`${document.code} · ${requirement?.critical?"Critical requirement":"Supporting requirement"} · Current state ${document.readiness}. Evidence warnings: ${warnings}.`} target={`${applicant.displayName} · ${document.code}`} options={DOCUMENT_OUTCOMES} submitLabel="Record document review" onRefresh={refresh} onSubmit={(outcome,reason,idempotencyKey)=>execute({action:"DOCUMENT_REVIEW",applicantId:applicant.applicantId,documentId:document.documentId,expectedDocumentVersion:control.version,outcome,reason,idempotencyKey})} />;
    }))}
    {assignOptions.length>0&&<ActionForm title="Assignment" description={`Current assignee: ${capabilities.assignedActorId??"Unassigned"}. Team: ${capabilities.teamId??"Not configured"}. Only server-approved staff are listed.`} target={model.summary.reference} options={assignOptions} optionLabel={(value)=>{const [mode,actorId]=value.split("|");return `${mode} · ${capabilities.permittedAssignees.find((item)=>item.actorId===actorId)?.displayName??"Myself"}`}} submitLabel="Confirm assignment" onRefresh={refresh} onSubmit={(value,reason,idempotencyKey)=>{const [mode,assigneeId]=value.split("|");if(!assigneeId||!isAssignmentMode(mode))return Promise.reject(new Error("PRECONDITION_FAILED"));return execute({action:"ASSIGNMENT",mode,assigneeId,reason,idempotencyKey})}} />}
    {capabilities.validStatusTransitions.length>0&&<ActionForm title="Status Transition" description={`Current state: ${capabilities.status}. Only transitions returned by the authoritative state machine are shown.`} target={model.summary.reference} options={capabilities.validStatusTransitions} submitLabel="Change controlled status" onRefresh={refresh} onSubmit={(to,reason,idempotencyKey)=>execute({action:"STATUS_TRANSITION",to,reason,idempotencyKey})} />}
    {model.mode==="CURRENT"&&model.applicants.filter((applicant)=>applicant.currentEvaluation&&capabilities.reevaluationApplicantIds.includes(applicant.applicantId)).map((applicant)=><ActionForm key={`reevaluate-${applicant.applicantId}`} title={`Re-evaluation · ${applicant.displayName}`} description={`Current ${applicant.currentEvaluation?.eligibilityState}; evaluation ${applicant.currentEvaluation?.evaluationId}; rules ${applicant.currentRuleVersions.map((rule)=>`${rule.ruleId} v${rule.version}`).join(", ")||"none"}. Re-evaluation creates a new immutable evaluation. Historical evaluations will not be modified.`} target={applicant.displayName} options={["REQUEST"]} optionLabel={()=>"Create a new immutable evaluation"} submitLabel="Request re-evaluation" onRefresh={refresh} onSubmit={(_option,reason,idempotencyKey)=>execute({action:"REEVALUATION_REQUEST",applicantId:applicant.applicantId,expectedCurrentEvaluationId:applicant.currentEvaluation?.evaluationId??"",reason,idempotencyKey})} />)}
  </section>;
}

export function OperationsControlledWritePanelLive({ enabled, model, onRefresh }: { enabled: boolean; model: OperationsCaseReadModel; onRefresh(): Promise<void> }) {
  const capabilities=trpc.operationsWrite.capabilities.useQuery({applicationId:model.summary.applicationId},{enabled,retry:false});
  const human=trpc.operationsWrite.humanReview.useMutation(),document=trpc.operationsWrite.documentReview.useMutation(),assignment=trpc.operationsWrite.assignment.useMutation(),status=trpc.operationsWrite.statusTransition.useMutation(),reevaluation=trpc.operationsWrite.requestReevaluation.useMutation();
  const execute=async(command:ControlledWriteCommand)=>{
    const common={applicationId:model.summary.applicationId,expectedVersion:capabilities.data?.version??-1,reason:command.reason,idempotencyKey:command.idempotencyKey};
    if(command.action==="HUMAN_REVIEW")await human.mutateAsync({...common,outcome:command.outcome});
    if(command.action==="DOCUMENT_REVIEW")await document.mutateAsync({...common,applicantId:command.applicantId,documentId:command.documentId,expectedDocumentVersion:command.expectedDocumentVersion,outcome:command.outcome});
    if(command.action==="ASSIGNMENT")await assignment.mutateAsync({...common,mode:command.mode,assigneeId:command.assigneeId});
    if(command.action==="STATUS_TRANSITION")await status.mutateAsync({...common,to:command.to});
    if(command.action==="REEVALUATION_REQUEST")await reevaluation.mutateAsync({...common,applicantId:command.applicantId,expectedCurrentEvaluationId:command.expectedCurrentEvaluationId});
    await Promise.all([capabilities.refetch(),onRefresh()]);
  };
  const refresh=async()=>{await Promise.all([capabilities.refetch(),onRefresh()]);};
  if (enabled && capabilities.isLoading) return <section id="actions" className="rounded-2xl border bg-white p-5 text-sm text-slate-600">Loading authorized Operations actions…</section>;
  if (enabled && capabilities.isError) return <section id="actions" role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
    <h2 className="font-semibold text-amber-950">Operations actions are not available for this case</h2>
    <p className="mt-1 text-sm text-amber-900">The current role, feature scope, or case prerequisites do not permit a write action. No hidden action has been performed.</p>
    <button type="button" className="mt-3 rounded-lg border border-amber-400 bg-white px-3 py-2 text-sm font-semibold" onClick={()=>void refresh()}>Retry permissions</button>
  </section>;
  return <div id="actions"><OperationsControlledWritePanel enabled={enabled&&capabilities.isSuccess} model={model} capabilities={capabilities.data??null} execute={execute} refresh={refresh} /></div>;
}
