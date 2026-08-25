import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CustomerOperationsPortal as Model } from "../../../api/lib/customer/customer-operations-portal";
import CustomerOperationsPortal from "./CustomerOperationsPortal";

const model: Model = {
  applicationReference: "TSH-1", currentStatus: { code: "DOCUMENTS_REQUIRED", message: "Documents are required to continue your application.", occurredAt: "2026-08-25T10:00:00Z" },
  applicants: [{ applicantId: 1, label: "Applicant 1", requirementSummary: { complete: 1, total: 2, outstandingLabels: ["Passport"] } }],
  timeline: [{ eventId: "e1", status: "APPLICATION_RECEIVED", message: "Your application has been received.", occurredAt: "2026-08-25T09:00:00Z" }],
  travel: [], requiredCustomerActions: ["Applicant 1: Passport"],
};

describe("CustomerOperationsPortal", () => {
  it("renders nothing while closed", () => expect(renderToStaticMarkup(<CustomerOperationsPortal enabled={false} model={model} />)).toBe(""));
  it("renders safe applicant progress, actions and timeline", () => {
    const html = renderToStaticMarkup(<CustomerOperationsPortal enabled model={model} />);
    expect(html).toContain("DOCUMENTS REQUIRED");
    expect(html).toContain("Applicant 1: Passport");
    expect(html).toContain("APPLICATION RECEIVED");
  });
});
