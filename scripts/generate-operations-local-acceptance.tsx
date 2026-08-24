import { mkdir, writeFile } from "node:fs/promises";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildLocalAcceptanceModel, LOCAL_ACCEPTANCE_APPLICATION_ID } from "./fixtures/operations-local-acceptance";
import OperationsCaseWorkspace from "../src/components/operations/OperationsCaseWorkspace";
import { OperationsControlledWritePanel } from "../src/components/operations/OperationsControlledWritePanel";

Object.assign(globalThis, { React });

const model = buildLocalAcceptanceModel("BLOCKED");
const capabilities = {
  applicationId: LOCAL_ACCEPTANCE_APPLICATION_ID, version: 0, status: "documents_received" as const,
  currentActorId: "staff:7001", assignedActorId: "staff:7001", teamId: 77,
  humanReview: true, documentReview: true, assignmentModes: ["REASSIGN" as const],
  validStatusTransitions: ["under_review" as const, "documents_pending" as const],
  reevaluationApplicantIds: [91011, 91012, 91013, 91014],
  documents: [91011, 91012, 91013, 91014].map((id) => ({ documentId: id + 1000, applicantId: id, version: 0 })),
  permittedAssignees: [{ actorId: "staff:7002", displayName: "Synthetic Operations Manager" }],
};

function page(title: string, content: string): string {
  return `<section class="evidence"><h1>${title}</h1>${content}</section>`;
}

const evidence = [
  page("1. Mixed-family blocking state", renderToStaticMarkup(<OperationsCaseWorkspace enabled model={model} />)),
  page("2. Controlled actions — local flag only", renderToStaticMarkup(<OperationsControlledWritePanel enabled model={model} capabilities={capabilities} execute={async () => undefined} />)),
  page("3. Document replacement required", renderToStaticMarkup(<OperationsCaseWorkspace enabled model={buildLocalAcceptanceModel("REPLACEMENT_REQUIRED")} />)),
  page("4. Recovered family — ready for submission", renderToStaticMarkup(<OperationsCaseWorkspace enabled model={buildLocalAcceptanceModel("RECOVERED")} />)),
  page("5. Immutable re-evaluation history", renderToStaticMarkup(<OperationsCaseWorkspace enabled model={buildLocalAcceptanceModel("REEVALUATED")} />)),
  page("6. Legacy compatibility", renderToStaticMarkup(<OperationsCaseWorkspace enabled model={buildLocalAcceptanceModel("LEGACY")} />)),
].join("\n");

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TASHIRA Operations OS Local Acceptance</title><style>
*{box-sizing:border-box}body{margin:0;background:#f1f5f9;color:#0f172a;font-family:Inter,Arial,sans-serif}.cover{padding:32px;background:#020617;color:white}.cover h1{margin:0 0 8px;color:#f3c65f}.cover p{margin:4px 0;color:#cbd5e1}.evidence{margin:28px auto;max-width:1280px;padding:20px;background:white;border:1px solid #cbd5e1;border-radius:18px;box-shadow:0 8px 24px #0f172a12}.evidence>h1{border-bottom:3px solid #d4a646;padding-bottom:12px}main{min-height:auto!important;background:white!important;padding:0!important}section section,article,aside,header,nav{margin:12px 0;padding:14px;border:1px solid #e2e8f0;border-radius:12px}header{background:#0f172a;color:white}nav{display:flex;flex-wrap:wrap;gap:8px}nav a{color:#8a5c00}h2{color:#1e293b}h3{margin-bottom:6px}ul,ol{padding-left:24px}li{margin:5px 0}label{display:block;margin:10px 0;font-weight:600}select,textarea{display:block;width:100%;max-width:700px;padding:8px;margin-top:5px}button{padding:10px 16px;border:0;border-radius:8px;background:#d4a646;font-weight:700}dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}dt{color:#64748b;font-size:12px}dd{margin:2px 0 0}@media(max-width:700px){.evidence{margin:10px;padding:12px}.cover{padding:20px}}
</style></head><body><header class="cover"><h1>TASHIRA Visa Operations OS V1</h1><p>Final local acceptance evidence — synthetic data only</p><p>Environment: disposable local MySQL / local feature flags · Production modified: NO</p><p>Generated: 2026-08-24 · Reference: TSH-LOCAL-FAMILY-91001</p></header>${evidence}</body></html>`;

await mkdir("docs/test-evidence", { recursive: true });
await writeFile("docs/test-evidence/operations-local-acceptance.html", html, "utf8");
console.log("Generated docs/test-evidence/operations-local-acceptance.html with synthetic evidence only.");
