import { TRPCError } from "@trpc/server";
import { sql, type SQL } from "drizzle-orm";
import type { TrpcContext } from "../context";
import { authorize, type AuthorizationActor, type AuthorizationResource } from "./authorization/policy";
import type { Permission } from "./authorization/permissions";
import { MysqlOperationsAccessProvider } from "./operations/mysql-access-provider";
import { defaultOperationsSqlClient } from "./operations/mysql-query-client";

export function needsStaffScope(ctx: TrpcContext): boolean {
  return Boolean(ctx.staffId && !ctx.isAdmin && ctx.user?.role !== "admin");
}

export function assertStaffCaseScope(actor: AuthorizationActor, resource: AuthorizationResource, document: boolean, mutation: boolean): void {
  const permissions: Permission[] = [actor.permissions.has("case.read") ? "case.read" : "case.read_assigned"];
  if (document) permissions.push(mutation ? "document.review" : "document.read");
  else if (mutation) permissions.push("case.transition");
  if (permissions.some(permission => !authorize(actor, permission, resource).allowed)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Application access denied" });
  }
}

export function staffResourceTargets(path: string, input: unknown): { kind: "application" | "document" | "reference"; value: string | number }[] {
  if (!/^(application|document|storage|wizard|timeline|invoice|risk|payment|refund|securityDeposit|emailOperations|dynamicInterview|customerOperations|customerPrecheck|customerVisaAssistant)\./.test(path) || !input || typeof input !== "object") return [];
  const targets: ReturnType<typeof staffResourceTargets> = [];
  for (const key of ["referenceNumber", "applicationId", "documentId", "id"] as const) {
    const value: unknown = Reflect.get(input, key);
    if (key === "referenceNumber" && typeof value === "string") targets.push({ kind: "reference", value });
    else if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
      if (key === "applicationId") targets.push({ kind: "application", value });
      if (key === "documentId" || key === "id" && path.startsWith("document.")) targets.push({ kind: "document", value });
      if (key === "id" && path.startsWith("application.")) targets.push({ kind: "application", value });
    }
  }
  return targets;
}

async function staffActor(ctx: TrpcContext): Promise<AuthorizationActor> {
  try { return await new MysqlOperationsAccessProvider(defaultOperationsSqlClient()).actorForContext(ctx); }
  catch { throw new TRPCError({ code: "FORBIDDEN", message: "Application access denied" }); }
}

export async function assertStaffSupplierAccess(ctx: TrpcContext): Promise<void> {
  if (needsStaffScope(ctx) && !(await staffActor(ctx)).permissions.has('supplier.read_operational')) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'صلاحية الموردين غير مفعلة لحسابك. راجع المدير.' });
  }
}

export async function enforceStaffApplicationScope(ctx: TrpcContext, path: string, input: unknown, mutation: boolean): Promise<void> {
  if (!needsStaffScope(ctx)) return;
  const targets = staffResourceTargets(path, input);
  if (!targets.length) return;
  const actor = await staffActor(ctx);
  const client = defaultOperationsSqlClient();
  for (const target of targets) {
    const selector = target.kind === "reference" ? "a.reference_number=?" : target.kind === "document" ? "a.id=(SELECT application_id FROM documents WHERE id=?)" : "a.id=?";
    const rows = await client.query(`SELECT c.assigned_staff_user_id AS assignedStaffId,c.team_id AS teamId,t.department_id AS departmentId FROM applications a LEFT JOIN operations_case_controls c ON c.application_id=a.id LEFT JOIN operations_teams t ON t.id=c.team_id WHERE ${selector}`, [target.value]);
    if (!rows[0]) throw new TRPCError({ code: "FORBIDDEN", message: "Application access denied" });
    const row = rows[0];
    const id = (key: string): number | undefined => { const value = Number(Reflect.get(row, key)); return Number.isSafeInteger(value) && value > 0 ? value : undefined; };
    const assignedId = id("assignedStaffId");
    assertStaffCaseScope(actor, { assignedActorId: assignedId ? `staff:${assignedId}` : undefined, teamId: id("teamId"), departmentId: id("departmentId") }, /^(document|storage)\./.test(path), mutation);
  }
}

export async function staffApplicationListCondition(ctx: TrpcContext): Promise<SQL | undefined> {
  if (!needsStaffScope(ctx)) return undefined;
  const actor = await staffActor(ctx);
  if (!actor.permissions.has("case.read") && !actor.permissions.has("case.read_assigned")) return sql`FALSE`;
  if (actor.scopes.includes("ALL")) return undefined;
  const clauses: SQL[] = [];
  if (actor.scopes.includes("ASSIGNED")) clauses.push(sql`c.assigned_staff_user_id=${ctx.staffId}`);
  if (actor.scopes.includes("TEAM")) for (const id of actor.teamIds) clauses.push(sql`c.team_id=${id}`);
  if (actor.scopes.includes("DEPARTMENT")) for (const id of actor.departmentIds) clauses.push(sql`t.department_id=${id}`);
  if (!clauses.length) return sql`FALSE`;
  return sql`EXISTS (SELECT 1 FROM operations_case_controls c LEFT JOIN operations_teams t ON t.id=c.team_id WHERE c.application_id=applications.id AND (${sql.join(clauses, sql` OR `)}))`;
}
