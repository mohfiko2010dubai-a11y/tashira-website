import { authorize, type AuthorizationActor } from "../authorization/policy";
import { isOperationsFlagEnabled, type FeatureFlagContext, type FeatureFlagRecord } from "../feature-flags/feature-flags";
import type { SupplierSlaCommand, SupplierSlaResource, SupplierSlaStart, SupplierSlaStartContext } from "./mysql-supplier-sla-repository";

export type SupplierSlaRepository = {
  list(evaluatedAt: string): Promise<readonly SupplierSlaResource[]>;
  get(slaId: string, evaluatedAt: string): Promise<SupplierSlaResource | null>;
  apply(slaId: string, command: SupplierSlaCommand): Promise<SupplierSlaResource>;
  startContext(applicationReference: string): Promise<SupplierSlaStartContext | null>;
  start(input: SupplierSlaStart): Promise<SupplierSlaResource>;
};
type Context = { actor: AuthorizationActor; flagContext: FeatureFlagContext; flags: readonly FeatureFlagRecord[]; repository: SupplierSlaRepository };
function enabled(input: Context): void { if(!isOperationsFlagEnabled("SUPPLIER_SLA",input.flagContext,input.flags))throw new Error("SUPPLIER_SLA_DISABLED"); }
function resource(item:SupplierSlaResource){return {teamId:item.teamId,departmentId:item.departmentId};}
function staffId(actor:AuthorizationActor):number{const match=/^staff:([1-9]\d*)$/.exec(actor.id);if(!match)throw new Error("SUPPLIER_SLA_STAFF_REQUIRED");return Number(match[1]);}

export async function listSupplierSla(input:Context&{now:Date}):Promise<readonly SupplierSlaResource[]>{enabled(input);if(!input.actor.permissions.has("supplier.read_operational"))throw new Error("SUPPLIER_SLA_ACCESS_DENIED");const items=await input.repository.list(input.now.toISOString());return items.filter((item)=>authorize(input.actor,"supplier.read_operational",resource(item)).allowed);}
export async function executeSupplierSlaCommand(input:Context&{slaId:string;command:Omit<SupplierSlaCommand,"actorStaffId"|"occurredAt">;now:Date}):Promise<SupplierSlaResource>{enabled(input);const current=await input.repository.get(input.slaId,input.now.toISOString());if(!current||!authorize(input.actor,"case.transition",resource(current)).allowed)throw new Error("SUPPLIER_SLA_ACCESS_DENIED");return input.repository.apply(input.slaId,{...input.command,actorStaffId:staffId(input.actor),occurredAt:input.now.toISOString()});}
export async function startSupplierSla(input:Context&{applicationReference:string;commandId:string;reason:string;now:Date}):Promise<SupplierSlaResource>{enabled(input);const context=await input.repository.startContext(input.applicationReference);if(!context||!authorize(input.actor,"case.transition",{teamId:context.teamId,departmentId:context.departmentId}).allowed)throw new Error("SUPPLIER_SLA_ACCESS_DENIED");return input.repository.start({applicationReference:input.applicationReference,commandId:input.commandId,reason:input.reason,actorStaffId:staffId(input.actor),occurredAt:input.now.toISOString()});}
