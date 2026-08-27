import { describe, expect, it } from "vitest";
import { parseMysqlClientScript, validateRehearsalTarget } from "./mysql-rehearsal-runner";

describe("MySQL rehearsal runner safety", () => {
  it("accepts only the explicit localhost disposable identity", () => {
    expect(validateRehearsalTarget("mysql://synthetic:hidden@127.0.0.1:33306/tashira_ops_rehearsal_v1"))
      .toEqual({ host: "127.0.0.1", port: 33306, database: "tashira_ops_rehearsal_v1" });
  });

  it.each([
    "mysql://synthetic:hidden@168.231.85.149:33306/tashira_ops_rehearsal_v1",
    "mysql://synthetic:hidden@127.0.0.1:3306/tashira_ops_rehearsal_v1",
    "mysql://synthetic:hidden@127.0.0.1:33306/tashira_staging",
    "https://127.0.0.1:33306/tashira_ops_rehearsal_v1",
  ])("rejects unsafe target %s", (url) => expect(() => validateRehearsalTarget(url)).toThrow(/OPS_REHEARSAL_/));

  it("parses MySQL client delimiter blocks without splitting trigger bodies", () => {
    const statements = parseMysqlClientScript("CREATE TABLE sample(id INT);\n-- trigger section\nDELIMITER $$\nCREATE TRIGGER sample_guard BEFORE UPDATE ON sample FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000'; END$$\nDELIMITER ;\n-- complete\n");
    expect(statements).toHaveLength(2);
    expect(statements[1]).toContain("SIGNAL SQLSTATE '45000'; END");
  });

  it("fails closed on incomplete SQL", () => expect(() => parseMysqlClientScript("CREATE TABLE sample(id INT)"))
    .toThrow("OPS_REHEARSAL_SQL_INCOMPLETE"));

});
