import type { TrpcContext } from "../../context";
import { PERMISSIONS, RESOURCE_SCOPES, type Permission, type ResourceScope } from "../authorization/permissions";
import type { AuthorizationActor } from "../authorization/policy";
import {
  OPERATIONS_FLAGS,
  type FeatureFlagContext,
  type FeatureFlagRecord,
  type FlagEnvironment,
  type FlagScope,
  type OperationsFlag,
} from "../feature-flags/feature-flags";

export type OperationsSqlClient = {
  query(sql: string, parameters?: readonly OperationsSqlParameter[]): Promise<readonly object[]>;
};

export type OperationsSqlParameter = string | number | bigint | boolean | Date | null | Buffer | Uint8Array;

type PermissionRow = { code: string };
type ScopeRow = {
  scopeType: string;
  teamId: number | string | null;
  departmentId: number | string | null;
};
type FlagRow = {
  flagKey: string;
  environment: string;
  enabled: string;
  scopeType: string;
  scopeReference: string;
};

function stringField(row: object, key: string): string | null {
  const value = Reflect.get(row, key);
  return typeof value === "string" ? value : null;
}

function nullableIdField(row: object, key: string): number | string | null {
  const value = Reflect.get(row, key);
  return typeof value === "number" || typeof value === "string" ? value : null;
}

const permissionSet = new Set<string>(PERMISSIONS);
const scopeSet = new Set<string>(RESOURCE_SCOPES);
const flagSet = new Set<string>(OPERATIONS_FLAGS);
const environments = new Set<string>(["DEVELOPMENT", "TEST", "STAGING", "PRODUCTION"] satisfies FlagEnvironment[]);
const flagScopes = new Set<string>(["GLOBAL", "TEAM", "STAFF", "APPLICATION"] satisfies FlagScope[]);

function isFlagEnvironment(value: string): value is FlagEnvironment {
  return environments.has(value);
}

function isOperationsFlag(value: string): value is OperationsFlag {
  return flagSet.has(value);
}

function isFlagScope(value: string): value is FlagScope {
  return flagScopes.has(value);
}

export class OperationsAccessError extends Error {
  readonly code: "ACTOR_REQUIRED" | "ACTOR_ACCESS_DENIED" | "ACCESS_PROVIDER_UNAVAILABLE";

  constructor(code: "ACTOR_REQUIRED" | "ACTOR_ACCESS_DENIED" | "ACCESS_PROVIDER_UNAVAILABLE") {
    super(code);
    this.name = "OperationsAccessError";
    this.code = code;
  }
}

function numericId(value: number | string | null): number | null {
  if (value === null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function isAdminContext(ctx: TrpcContext): boolean {
  return ctx.isAdmin || ctx.user?.role === "admin";
}

export function runtimeFlagEnvironment(nodeEnvironment = process.env.NODE_ENV, appEnvironment = process.env.APP_ENV): FlagEnvironment {
  const candidate = (appEnvironment || nodeEnvironment || "DEVELOPMENT").toUpperCase();
  return isFlagEnvironment(candidate) ? candidate : "DEVELOPMENT";
}

export class MysqlOperationsAccessProvider {
  private readonly sql: OperationsSqlClient;

  constructor(sql: OperationsSqlClient) {
    this.sql = sql;
  }

  async actorForContext(ctx: TrpcContext): Promise<AuthorizationActor> {
    if (isAdminContext(ctx)) {
      return this.adminActor();
    }
    if (!ctx.staffId) throw new OperationsAccessError("ACTOR_REQUIRED");
    return this.staffActor(ctx.staffId);
  }

  async refreshTrustedActor(actorId: string): Promise<AuthorizationActor> {
    if (actorId === "admin") return this.adminActor();
    const match = /^staff:([1-9]\d*)$/.exec(actorId);
    if (!match) throw new OperationsAccessError("ACTOR_REQUIRED");
    const staffId = Number(match[1]);
    if (!Number.isSafeInteger(staffId)) throw new OperationsAccessError("ACTOR_REQUIRED");
    return this.staffActor(staffId);
  }

  private adminActor(): AuthorizationActor {
    return {
      id: "admin",
      permissions: new Set(PERMISSIONS),
      scopes: ["ALL"],
      teamIds: new Set(),
      departmentIds: new Set(),
    };
  }

  private async staffActor(staffId: number): Promise<AuthorizationActor> {
    try {
      const [permissions, scopes] = await Promise.all([
        this.sql.query(
          `SELECT DISTINCT p.code
             FROM operations_staff_roles sr
             JOIN operations_roles r ON r.id = sr.role_id AND r.is_active = 'ACTIVE'
             JOIN operations_role_permissions rp ON rp.role_id = r.id
             JOIN operations_permissions p ON p.id = rp.permission_id
            WHERE sr.staff_user_id = ?
              AND sr.revoked_at IS NULL
              AND sr.valid_from <= UTC_TIMESTAMP()
              AND (sr.valid_to IS NULL OR sr.valid_to > UTC_TIMESTAMP())`,
          [staffId],
        ),
        this.sql.query(
          `SELECT scope_type AS scopeType, team_id AS teamId, department_id AS departmentId
             FROM operations_scope_grants
            WHERE staff_user_id = ? AND revoked_at IS NULL`,
          [staffId],
        ),
      ]);

      const permissionRows: PermissionRow[] = permissions.flatMap((row) => {
        const code = stringField(row, "code");
        return code === null ? [] : [{ code }];
      });
      const scopeRows: ScopeRow[] = scopes.flatMap((row) => {
        const scopeType = stringField(row, "scopeType");
        return scopeType === null ? [] : [{
          scopeType,
          teamId: nullableIdField(row, "teamId"),
          departmentId: nullableIdField(row, "departmentId"),
        }];
      });
      const validPermissions = permissionRows
        .map((row) => row.code)
        .filter((code): code is Permission => permissionSet.has(code));
      const validScopes = scopeRows
        .map((row) => row.scopeType)
        .filter((scope): scope is ResourceScope => scopeSet.has(scope));
      if (validPermissions.length === 0 || validScopes.length === 0) {
        throw new OperationsAccessError("ACTOR_ACCESS_DENIED");
      }
      return {
        id: `staff:${staffId}`,
        permissions: new Set(validPermissions),
        scopes: [...new Set(validScopes)],
        teamIds: new Set(scopeRows.map((row) => numericId(row.teamId)).filter((id): id is number => id !== null)),
        departmentIds: new Set(scopeRows.map((row) => numericId(row.departmentId)).filter((id): id is number => id !== null)),
      };
    } catch (error) {
      if (error instanceof OperationsAccessError) throw error;
      throw new OperationsAccessError("ACCESS_PROVIDER_UNAVAILABLE");
    }
  }

  async featureFlags(): Promise<readonly FeatureFlagRecord[]> {
    try {
      const records = await this.sql.query(
        `SELECT flag_key AS flagKey, environment, enabled,
                scope_type AS scopeType, scope_reference AS scopeReference
           FROM operations_feature_flags`,
      );
      const rows: FlagRow[] = records.flatMap((row) => {
        const flagKey = stringField(row, "flagKey");
        const environment = stringField(row, "environment");
        const enabled = stringField(row, "enabled");
        const scopeType = stringField(row, "scopeType");
        const scopeReference = stringField(row, "scopeReference");
        return flagKey === null || environment === null || enabled === null || scopeType === null || scopeReference === null
          ? [] : [{ flagKey, environment, enabled, scopeType, scopeReference }];
      });
      return rows.flatMap((row): FeatureFlagRecord[] => {
        if (!isOperationsFlag(row.flagKey) || !isFlagEnvironment(row.environment) || !isFlagScope(row.scopeType)) return [];
        if (row.enabled !== "YES" && row.enabled !== "NO") return [];
        if ((row.scopeType === "GLOBAL") !== (row.scopeReference === "")) return [];
        return [{
          flagKey: row.flagKey,
          environment: row.environment,
          enabled: row.enabled === "YES",
          scopeType: row.scopeType,
          scopeReference: row.scopeReference,
        }];
      });
    } catch {
      return [];
    }
  }

  async flagContextForContext(ctx: TrpcContext): Promise<FeatureFlagContext> {
    if (!ctx.staffId) return this.flagContext(ctx);
    try {
      const rows = await this.sql.query(
        `SELECT team_id AS teamId
           FROM operations_scope_grants
          WHERE staff_user_id = ? AND revoked_at IS NULL AND team_id IS NOT NULL`,
        [ctx.staffId],
      );
      const teamIds = new Set(rows
        .map((row) => numericId(nullableIdField(row, "teamId")))
        .filter((id): id is number => id !== null));
      return this.flagContext(ctx, teamIds);
    } catch {
      return this.flagContext(ctx);
    }
  }

  private flagContext(ctx: TrpcContext, teamIds?: ReadonlySet<number>): FeatureFlagContext {
    return {
      environment: runtimeFlagEnvironment(),
      staffId: ctx.staffId,
      teamIds,
    };
  }
}
