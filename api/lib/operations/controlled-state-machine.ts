import type { ApplicationStatus } from "./controlled-write-repository";

export const CONTROLLED_STATUS_TRANSITIONS: Readonly<Record<ApplicationStatus, readonly ApplicationStatus[]>> = {
  submitted: ["payment_received", "cancelled", "rejected"],
  payment_received: ["documents_pending", "documents_received", "cancelled", "rejected"],
  documents_pending: ["documents_received", "cancelled", "rejected"],
  documents_received: ["under_review", "documents_pending", "cancelled", "rejected"],
  under_review: ["visa_processing", "documents_pending", "cancelled", "rejected"],
  visa_processing: ["visa_received", "cancelled", "rejected"],
  visa_received: ["completed"],
  completed: [],
  rejected: [],
  cancelled: [],
};

export function assertControlledTransition(from: ApplicationStatus, to: ApplicationStatus): void {
  if (!CONTROLLED_STATUS_TRANSITIONS[from].includes(to)) throw new Error("INVALID_STATUS_TRANSITION");
}
