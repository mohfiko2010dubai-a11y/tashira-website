import type { Pool } from "mysql2/promise";
import { createPool } from "mysql2/promise";
import { env } from "../env";
import type { OperationsSqlClient, OperationsSqlParameter } from "./mysql-access-provider";

export class MysqlOperationsSqlClient implements OperationsSqlClient {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async query(sql: string, parameters: readonly OperationsSqlParameter[] = []): Promise<readonly object[]> {
    const [rows] = await this.pool.execute(sql, [...parameters]);
    if (!Array.isArray(rows)) return [];
    const result: object[] = [];
    for (const row of rows) if (typeof row === "object" && row !== null) result.push(row);
    return result;
  }
}

let defaultPool: Pool | undefined;

export function defaultOperationsPool(): Pool {
  defaultPool ??= createPool({
    uri: env.databaseUrl,
    connectionLimit: 5,
    enableKeepAlive: true,
  });
  return defaultPool;
}

export function defaultOperationsSqlClient(): OperationsSqlClient {
  return new MysqlOperationsSqlClient(defaultOperationsPool());
}
