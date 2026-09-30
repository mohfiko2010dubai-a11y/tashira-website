import { TRPCError } from "@trpc/server";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { defaultOperationsPool } from "./operations/mysql-query-client";
import { NATIONALITY_CATALOG } from "./requirements/nationality-catalog";
import { nationalityUnavailableCopy, unavailableNationalities } from "../../contracts/nationality-availability";

export async function nationalityAvailability(connection?: PoolConnection, lock = false) {
  const [rows] = await (connection ?? defaultOperationsPool()).execute<RowDataPacket[]>(
    "SELECT unavailable_codes,version FROM nationality_availability_config WHERE id=1" + (lock ? " LOCK IN SHARE MODE" : ""));
  if (!rows[0]) throw new Error("Nationality availability is unavailable. Retry before payment.");
  const parsed: unknown = typeof rows[0].unavailable_codes === "string" ? JSON.parse(rows[0].unavailable_codes) : rows[0].unavailable_codes;
  if (!Array.isArray(parsed) || !parsed.every(code => typeof code === "string" && NATIONALITY_CATALOG.some(country => country.code === code))) throw new Error("Nationality availability configuration is invalid");
  return { codes: parsed as string[], version: Number(rows[0].version) };
}
export async function updateNationalityAvailability(input: { codes: string[]; expectedVersion: number }, actor: string) {
  if (!input.codes.every(code => NATIONALITY_CATALOG.some(country => country.code === code))) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose nationalities from the country list." });
  const connection = await defaultOperationsPool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<RowDataPacket[]>("SELECT version FROM nationality_availability_config WHERE id=1 FOR UPDATE");
    if (Number(rows[0]?.version) !== input.expectedVersion) throw new TRPCError({ code: "CONFLICT", message: "Configuration changed. Refresh and try again." });
    const codes = JSON.stringify([...new Set(input.codes)].sort());
    await connection.execute("UPDATE nationality_availability_config SET unavailable_codes=?,version=version+1,updated_at=NOW(3) WHERE id=1", [codes]);
    await connection.execute("INSERT INTO nationality_availability_audit (unavailable_codes,actor) VALUES (?,?)", [codes, actor]);
    await connection.commit();return { updated: true };
  } catch (error) { await connection.rollback();throw error; } finally { connection.release(); }
}
/** Called under the application checkout lock, before either retrieving or creating an intent. */
export async function assertNationalityCheckoutAvailable(connection: PoolConnection, applicationId: number) {
  const config = await nationalityAvailability(connection, true);
  const [rows] = await connection.execute<RowDataPacket[]>("SELECT nationality FROM applicants WHERE application_id=?", [applicationId]);
  const blocked = unavailableNationalities(config.codes, rows.map(row => row.nationality ? String(row.nationality) : null));
  if (blocked.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: nationalityUnavailableCopy(blocked, false) + " / " + nationalityUnavailableCopy(blocked, true) });
}
