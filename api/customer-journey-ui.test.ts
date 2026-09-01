import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("integrated staging customer and Operations journey", () => {
  it("starts the dynamic journey and preserves applicant-scoped continuation", async () => {
    const [start, application, interview] = await Promise.all([
      readFile(new URL("../src/pages/DynamicApplicationStart.tsx", import.meta.url), "utf8"),
      readFile(new URL("./application-router.ts", import.meta.url), "utf8"),
      readFile(new URL("../src/pages/DynamicApplication.tsx", import.meta.url), "utf8"),
    ]);
    expect(start).toContain('t("step1.start")');
    expect(start).toContain("WizardShell");
    expect(start).toContain('t("step1.family")');
    expect(start).toContain('journeyMode: "DYNAMIC"');
    expect(application).toContain("runtimeFlagEnvironment() !== \"STAGING\"");
    expect(application).toContain("'APPLICATION'");
    expect(application).toContain('if (input.journeyMode === "LEGACY")');
    expect(application).toContain('input.journeyMode === "DYNAMIC"');
    expect(interview).toContain('t("step2.continueToPay")');
    expect(interview).toContain('t("step2.saveView")');
  });

  it("exposes scoped staff documents, notes, controlled status and visa delivery", async () => {
    const [casePage, writes, documents, visa, notes] = await Promise.all([
      readFile(new URL("../src/pages/admin/StaffOperationsCase.tsx", import.meta.url), "utf8"),
      readFile(new URL("../src/components/operations/OperationsControlledWritePanel.tsx", import.meta.url), "utf8"),
      readFile(new URL("../src/components/shared/DocumentManager.tsx", import.meta.url), "utf8"),
      readFile(new URL("../src/components/operations/VisaDeliveryPanel.tsx", import.meta.url), "utf8"),
      readFile(new URL("../src/components/operations/CaseNotePanel.tsx", import.meta.url), "utf8"),
    ]);
    expect(casePage).toContain("OperationsControlledWritePanelLive");
    expect(writes).toContain("Status Transition");
    expect(documents).toContain("Upload to selected applicant");
    expect(visa).toContain("Approve & prepare secure delivery");
    expect(notes).toContain("Add internal note");
  });

  it("initializes missing case concurrency state before controlled capabilities", async () => {
    const executor = await readFile(new URL("./lib/operations/mysql-controlled-write-executor.ts", import.meta.url), "utf8");
    expect(executor).toContain("INSERT IGNORE INTO operations_case_controls");
    expect(executor).toContain("does not assign staff, change status, or mutate financial values");
  });
});
