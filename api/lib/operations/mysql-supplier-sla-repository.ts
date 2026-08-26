import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { deriveSupplierSlaState, type SupplierSlaPolicySnapshot, type SupplierSlaState } from "./supplier-sla";

type SqlValue = string | number | Date | null;
type CommandAction = "ACKNOWLEDGE" | "ESCALATE" | "COMPLETE";
export type SupplierSlaResource = {
  slaId: string; applicationId: number; applicationReference: string; supplierId: number; supplierName: string;
  routeCode: string | null; state: SupplierSlaState; escalationLevel: number; version: number;
  startedAt: string; acknowledgementDueAt: string; completionDueAt: string; teamId: number; departmentId: number;
};
export type SupplierSlaCommand = { commandId: string; expectedVersion: number; action: CommandAction; actorStaffId: number; reason: string; occurredAt: string };
export type SupplierSlaStartContext = { applicationId: number; applicationReference: string; teamId: number; departmentId: number };
export type SupplierSlaStart = { applicationReference: string; commandId: string; actorStaffId: number; reason: string; occurredAt: string };

function value(row: object, key: string): unknown { return Reflect.get(row, key); }
function text(row: object, key: string): string { const item=value(row,key); if(typeof item!=="string") throw new Error(`SUPPLIER_SLA_ROW_INVALID:${key}`); return item; }
function integer(row: object, key: string): number { const item=Number(value(row,key)); if(!Number.isSafeInteger(item)) throw new Error(`SUPPLIER_SLA_ROW_INVALID:${key}`); return item; }
function dateTime(row: object,key:string):string { const item=value(row,key); if(item instanceof Date)return item.toISOString(); if(typeof item==="string"&&!Number.isNaN(Date.parse(item)))return new Date(item).toISOString(); throw new Error(`SUPPLIER_SLA_ROW_INVALID:${key}`); }
function json<T>(row: object,key:string):T { const item=value(row,key); if(typeof item==="string")return JSON.parse(item) as T;if(Buffer.isBuffer(item))return JSON.parse(item.toString("utf8")) as T;return item as T; }
async function rows(connection:PoolConnection,sql:string,parameters:readonly SqlValue[]=[]):Promise<RowDataPacket[]> { const [result]=await connection.execute<RowDataPacket[]>(sql,[...parameters]); return result; }

function fromRow(row: object, evaluatedAt: string): SupplierSlaResource {
  const policy=json<SupplierSlaPolicySnapshot>(row,"policySnapshot");
  const persisted=text(row,"currentState");
  const derived=persisted==="COMPLETED"?"COMPLETED":deriveSupplierSlaState({
    slaId:text(row,"slaId"),applicationId:integer(row,"applicationId"),supplierId:integer(row,"supplierId"),policy,
    startedAt:dateTime(row,"startedAt"),acknowledgementDueAt:dateTime(row,"acknowledgementDueAt"),completionDueAt:dateTime(row,"completionDueAt"),
    events:persisted==="WAITING_FOR_ACKNOWLEDGEMENT"||persisted==="ACKNOWLEDGEMENT_OVERDUE"?[]:[{eventId:"persisted-ack",eventType:"ACKNOWLEDGED",actorReference:"system",reason:"Persisted acknowledgement",occurredAt:dateTime(row,"startedAt"),idempotencyKey:"persisted-ack"}],evidenceIntegrityReference:`sha256:${text(row,"evidenceSha256")}`,
  },evaluatedAt);
  return { slaId:text(row,"slaId"),applicationId:integer(row,"applicationId"),applicationReference:text(row,"applicationReference"),supplierId:integer(row,"supplierId"),supplierName:text(row,"supplierName"),routeCode:policy.routeCode,
    state:derived,escalationLevel:integer(row,"escalationLevel"),version:integer(row,"version"),startedAt:dateTime(row,"startedAt"),acknowledgementDueAt:dateTime(row,"acknowledgementDueAt"),completionDueAt:dateTime(row,"completionDueAt"),teamId:integer(row,"teamId"),departmentId:integer(row,"departmentId") };
}

const select = `SELECT i.id slaId,i.application_id applicationId,a.reference_number applicationReference,i.supplier_id supplierId,s.name supplierName,
  i.policy_snapshot_json policySnapshot,i.started_at startedAt,i.acknowledgement_due_at acknowledgementDueAt,i.completion_due_at completionDueAt,
  i.current_state currentState,i.current_escalation_level escalationLevel,i.version,i.evidence_sha256 evidenceSha256,c.team_id teamId,t.department_id departmentId
  FROM operations_supplier_sla_instances i JOIN applications a ON a.id=i.application_id JOIN suppliers s ON s.id=i.supplier_id
  JOIN operations_case_controls c ON c.application_id=i.application_id JOIN operations_teams t ON t.id=c.team_id`;

export class MysqlSupplierSlaRepository {
  private readonly pool: Pool;
  constructor(pool: Pool) { this.pool = pool; }
  async list(evaluatedAt: string): Promise<readonly SupplierSlaResource[]> { const connection=await this.pool.getConnection(); try{return (await rows(connection,`${select} ORDER BY i.completion_due_at,i.id`)).map((row)=>fromRow(row,evaluatedAt));}finally{connection.release();} }
  async get(slaId:string,evaluatedAt:string):Promise<SupplierSlaResource|null>{const connection=await this.pool.getConnection();try{const found=await rows(connection,`${select} WHERE i.id=?`,[slaId]);return found[0]?fromRow(found[0],evaluatedAt):null;}finally{connection.release();}}
  async startContext(applicationReference:string):Promise<SupplierSlaStartContext|null>{const connection=await this.pool.getConnection();try{const found=await rows(connection,`SELECT a.id applicationId,a.reference_number applicationReference,c.team_id teamId,t.department_id departmentId FROM applications a JOIN operations_case_controls c ON c.application_id=a.id JOIN operations_teams t ON t.id=c.team_id WHERE a.reference_number=? LIMIT 1`,[applicationReference]);return found[0]?{applicationId:integer(found[0],"applicationId"),applicationReference:text(found[0],"applicationReference"),teamId:integer(found[0],"teamId"),departmentId:integer(found[0],"departmentId")}:null;}finally{connection.release();}}
  async start(input:SupplierSlaStart):Promise<SupplierSlaResource>{const connection=await this.pool.getConnection();try{
    await connection.beginTransaction();
    const applications=await rows(connection,`SELECT a.id applicationId,a.reference_number applicationReference,a.supplier_id supplierId,s.name supplierName,c.team_id teamId,t.department_id departmentId,
      r.route_code routeCode FROM applications a JOIN suppliers s ON s.id=a.supplier_id AND s.is_active='active' JOIN operations_case_controls c ON c.application_id=a.id JOIN operations_teams t ON t.id=c.team_id
      JOIN applicants ap ON ap.application_id=a.id AND ap.applicant_index=0 JOIN visa_rule_evaluation_selections sel ON sel.application_id=a.id AND sel.applicant_id=ap.id
      JOIN visa_rule_evaluation_runs r ON r.id=sel.evaluation_id WHERE a.reference_number=? ORDER BY sel.selected_at DESC,sel.id DESC LIMIT 1 FOR UPDATE`,[input.applicationReference]);
    if(!applications[0])throw new Error("SUPPLIER_SLA_START_PREREQUISITES_MISSING");const application=applications[0];const applicationId=integer(application,"applicationId");
    const existing=await rows(connection,`${select} WHERE i.application_id=?`,[applicationId]);if(existing[0]){const replay=await rows(connection,"SELECT metadata_json metadata FROM operations_supplier_sla_events WHERE sla_instance_id=? AND event_type='STARTED' AND idempotency_key=?",[text(existing[0],"slaId"),input.commandId]);if(!replay[0])throw new Error("SUPPLIER_SLA_ALREADY_STARTED");const metadata=json<{command:{actorStaffId:number;reason:string};result:SupplierSlaResource}>(replay[0],"metadata");if(Number(metadata.command?.actorStaffId)!==input.actorStaffId||metadata.command?.reason!==input.reason)throw new Error("SUPPLIER_SLA_IDEMPOTENCY_CONFLICT");await connection.commit();return metadata.result;}
    const supplierId=integer(application,"supplierId"),routeCode=text(application,"routeCode");const policies=await rows(connection,`SELECT id policyId,version,supplier_id supplierId,route_code routeCode,acknowledgement_minutes acknowledgementMinutes,completion_minutes completionMinutes,
      warning_minutes_before_completion warningMinutesBeforeCompletion,source_reference sourceReference FROM operations_supplier_sla_policies WHERE supplier_id=? AND lifecycle_state='ACTIVE' AND effective_from<=? AND (effective_to IS NULL OR effective_to>?) AND (route_code=? OR route_code IS NULL)
      ORDER BY (route_code IS NOT NULL) DESC,version DESC`,[supplierId,new Date(input.occurredAt),new Date(input.occurredAt),routeCode]);if(policies.length===0)throw new Error("SUPPLIER_SLA_POLICY_MISSING");const exact=policies.filter((row)=>value(row,"routeCode")!==null);const candidates=exact.length?exact:policies.filter((row)=>value(row,"routeCode")===null);if(candidates.length!==1)throw new Error("SUPPLIER_SLA_POLICY_CONFLICT");const row=candidates[0];const policy:SupplierSlaPolicySnapshot={policyId:text(row,"policyId"),policyVersion:integer(row,"version"),supplierId,routeCode:value(row,"routeCode")===null?null:text(row,"routeCode"),acknowledgementMinutes:integer(row,"acknowledgementMinutes"),completionMinutes:integer(row,"completionMinutes"),warningMinutesBeforeCompletion:integer(row,"warningMinutesBeforeCompletion"),sourceReference:text(row,"sourceReference")};
    const started=new Date(input.occurredAt);if(Number.isNaN(started.getTime()))throw new Error("SUPPLIER_SLA_INVALID_START_TIME");const acknowledgementDueAt=new Date(started.getTime()+policy.acknowledgementMinutes*60_000);const completionDueAt=new Date(started.getTime()+policy.completionMinutes*60_000);const slaId=randomUUID();const evidenceSha256=createHash("sha256").update(JSON.stringify({applicationId,supplierId,policy,startedAt:started.toISOString(),acknowledgementDueAt:acknowledgementDueAt.toISOString(),completionDueAt:completionDueAt.toISOString()})).digest("hex");
    await connection.execute(`INSERT INTO operations_supplier_sla_instances (id,application_id,supplier_id,policy_id,policy_snapshot_json,started_at,acknowledgement_due_at,completion_due_at,current_state,version,evidence_sha256) VALUES (?,?,?,?,?,?,?,?,'WAITING_FOR_ACKNOWLEDGEMENT',1,?)`,[slaId,applicationId,supplierId,policy.policyId,JSON.stringify(policy),started,acknowledgementDueAt,completionDueAt,evidenceSha256]);
    const result:SupplierSlaResource={slaId,applicationId,applicationReference:text(application,"applicationReference"),supplierId,supplierName:text(application,"supplierName"),routeCode:policy.routeCode,state:"WAITING_FOR_ACKNOWLEDGEMENT",escalationLevel:0,version:1,startedAt:started.toISOString(),acknowledgementDueAt:acknowledgementDueAt.toISOString(),completionDueAt:completionDueAt.toISOString(),teamId:integer(application,"teamId"),departmentId:integer(application,"departmentId")};
    await connection.execute(`INSERT INTO operations_supplier_sla_events (id,sla_instance_id,event_type,version_before,version_after,actor_type,actor_reference,reason,idempotency_key,metadata_json,occurred_at) VALUES (?,?,'STARTED',0,1,'STAFF',?,?,?,?,?)`,[randomUUID(),slaId,`staff:${input.actorStaffId}`,input.reason,input.commandId,JSON.stringify({command:{actorStaffId:input.actorStaffId,reason:input.reason},result}),started]);
    await connection.execute(`INSERT INTO operations_audit_events (id,event_type,actor_type,actor_reference,resource_type,resource_reference,outcome,reason_code,metadata_json) VALUES (?,'SUPPLIER_SLA_STARTED','STAFF',?,'SUPPLIER_SLA',?,'SUCCESS','STARTED',?)`,[randomUUID(),`staff:${input.actorStaffId}`,slaId,JSON.stringify({applicationId,policyId:policy.policyId,policyVersion:policy.policyVersion})]);
    await connection.commit();return result;
  }catch(error){await connection.rollback();throw error;}finally{connection.release();}}
  async apply(slaId:string,command:SupplierSlaCommand):Promise<SupplierSlaResource>{const connection=await this.pool.getConnection();try{
    await connection.beginTransaction(); const found=await rows(connection,`${select} WHERE i.id=? FOR UPDATE`,[slaId]); if(!found[0])throw new Error("SUPPLIER_SLA_NOT_FOUND");
    const replay=await rows(connection,"SELECT metadata_json metadata FROM operations_supplier_sla_events WHERE sla_instance_id=? AND idempotency_key=?",[slaId,command.commandId]);
    if(replay[0]){const metadata=json<{command:{action:string;expectedVersion:number;actorStaffId:number;reason:string};result:SupplierSlaResource}>(replay[0],"metadata");const prior=metadata.command;if(prior?.action!==command.action||Number(prior?.expectedVersion)!==command.expectedVersion||Number(prior?.actorStaffId)!==command.actorStaffId||prior?.reason!==command.reason)throw new Error("SUPPLIER_SLA_IDEMPOTENCY_CONFLICT");await connection.commit();return metadata.result;}
    const current=fromRow(found[0],command.occurredAt); if(current.version!==command.expectedVersion)throw new Error("SUPPLIER_SLA_VERSION_CONFLICT"); if(!command.reason.trim())throw new Error("SUPPLIER_SLA_REASON_REQUIRED");
    let state:SupplierSlaState=current.state;let level=current.escalationLevel;let eventType:"ACKNOWLEDGED"|"ESCALATED"|"COMPLETED";
    if(command.action==="ACKNOWLEDGE"){if(!["WAITING_FOR_ACKNOWLEDGEMENT","ACKNOWLEDGEMENT_OVERDUE"].includes(current.state))throw new Error("SUPPLIER_SLA_INVALID_TRANSITION");state="IN_PROGRESS";eventType="ACKNOWLEDGED";}
    else if(command.action==="ESCALATE"){if(!["ACKNOWLEDGEMENT_OVERDUE","COMPLETION_WARNING","COMPLETION_OVERDUE"].includes(current.state))throw new Error("SUPPLIER_SLA_INVALID_TRANSITION");level++;eventType="ESCALATED";}
    else {if(current.state==="COMPLETED")throw new Error("SUPPLIER_SLA_INVALID_TRANSITION");state="COMPLETED";eventType="COMPLETED";}
    const nextVersion=current.version+1; const [updated]=await connection.execute<ResultSetHeader>("UPDATE operations_supplier_sla_instances SET current_state=?,current_escalation_level=?,version=? WHERE id=? AND version=?",[state,level,nextVersion,slaId,current.version]);if(updated.affectedRows!==1)throw new Error("SUPPLIER_SLA_VERSION_CONFLICT");
    const result={...current,state,escalationLevel:level,version:nextVersion};const commandEvidence={action:command.action,expectedVersion:command.expectedVersion,actorStaffId:command.actorStaffId,reason:command.reason};
    await connection.execute(`INSERT INTO operations_supplier_sla_events (id,sla_instance_id,event_type,version_before,version_after,actor_type,actor_reference,reason,idempotency_key,metadata_json,occurred_at)
      VALUES (?,?,?,?,?,'STAFF',?,?,?,?,?)`,[randomUUID(),slaId,eventType,current.version,nextVersion,`staff:${command.actorStaffId}`,command.reason,command.commandId,JSON.stringify({command:commandEvidence,result}),new Date(command.occurredAt)]);
    await connection.execute(`INSERT INTO operations_audit_events (id,event_type,actor_type,actor_reference,resource_type,resource_reference,outcome,reason_code,metadata_json)
      VALUES (?,'SUPPLIER_SLA_COMMAND','STAFF',?,'SUPPLIER_SLA',?,'SUCCESS',?,?)`,[randomUUID(),`staff:${command.actorStaffId}`,slaId,command.action,JSON.stringify({versionBefore:current.version,versionAfter:nextVersion,applicationId:current.applicationId})]);
    await connection.commit();return result;
  }catch(error){await connection.rollback();throw error;}finally{connection.release();}}
}
