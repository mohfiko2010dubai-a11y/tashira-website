import { describe, expect, it, vi } from "vitest";
import type { PoolConnection } from "mysql2/promise";
import { assertNationalityCheckoutAvailable, nationalityAvailability } from "./nationality-availability";
import { nationalityUnavailableCopy, unavailableNationalities } from "../../contracts/nationality-availability";

const config = ["IR", "SS", "UG", "CD"];
function connection(nationalities: string[]) {
  const execute = vi.fn(async (sql: string) => [sql.includes("nationality_availability_config") ? [{ unavailable_codes: JSON.stringify(config), version: 1 }] : nationalities.map(nationality => ({ nationality })), []]);
  return { execute } as unknown as PoolConnection;
}
describe("owner-configured nationality availability", () => {
  it.each(config)("blocks %s in any position of a family before intent issuance", async nationality => {
    await expect(assertNationalityCheckoutAvailable(connection(["EG", nationality]), 1)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
  it("allows other nationalities and deduplicates the notice", async () => {
    await expect(assertNationalityCheckoutAvailable(connection(["EG", "PK"]), 1)).resolves.toBeUndefined();
    expect(unavailableNationalities(config, [null, "IR", "IR", "EG"])).toEqual(["IR"]);
  });
  it("takes the configurable row lock while issuing checkout", async () => {
    const db = connection(["EG"]);await assertNationalityCheckoutAvailable(db, 1);
    expect(db.execute).toHaveBeenCalledWith(expect.stringContaining("LOCK IN SHARE MODE"));
  });
  it("fails closed if the configuration is absent", async () => {
    const db = { execute: vi.fn(async () => [[], []]) } as unknown as PoolConnection;
    await expect(nationalityAvailability(db)).rejects.toThrow("availability is unavailable");
  });
  it("states service availability and offers contact without claiming a government ban", () => {
    expect(nationalityUnavailableCopy(["IR"], false)).toBe("Applications are not currently available for nationals of Iran. Contact us for assistance.");
    expect(nationalityUnavailableCopy(["IR"], true)).toContain("التقديم غير متاح حاليًا لمواطني");
    expect(nationalityUnavailableCopy(config, false)).not.toMatch(/banned|authority/i);
  });
});
