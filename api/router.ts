import { authRouter } from "./auth-router";
import { applicationRouter } from "./application-router";
import { paymentRouter } from "./payment-router";
import { chatRouter } from "./chat-router";
import { driveRouter } from "./drive-router";
import { invoiceRouter } from "./invoice-router";
import { supplierRouter } from "./supplier-router";
import { staffRouter } from "./staff-router";
import { storageRouter } from "./storage-router";
import { documentRouter } from "./document-router";
import { wizardRouter } from "./wizard-router";
import { timelineRouter } from "./timeline-router";
import { businessRouter } from "./business-router";
import { retentionRouter } from "./retention-router";
import { riskRouter } from "./risk-router";
import { createRouter } from "./middleware";
import { recoveryRouter } from "./recovery-router";
import { refundRouter } from "./refund-router";
import { securityDepositRouter } from "./security-deposit-router";
import { operationsWriteRouter } from "./operations-write-router";
import { operationsReadRouter } from "./operations-read-router";
import { operationsAlertRouter } from "./operations-alert-router";
import { customerOperationsRouter } from "./customer-operations-router";

export const appRouter = createRouter({
  auth: authRouter,
  application: applicationRouter,
  payment: paymentRouter,
  chat: chatRouter,
  wizard: wizardRouter,
  drive: driveRouter,
  invoice: invoiceRouter,
  supplier: supplierRouter,
  staff: staffRouter,
  storage: storageRouter,
  document: documentRouter,
  timeline: timelineRouter,
  business: businessRouter,
  retention: retentionRouter,
  risk: riskRouter,
  recovery: recoveryRouter,
  refund: refundRouter,
  securityDeposit: securityDepositRouter,
  operationsWrite: operationsWriteRouter,
  operationsRead: operationsReadRouter,
  operationsAlerts: operationsAlertRouter,
  customerOperations: customerOperationsRouter,
});

export type AppRouter = typeof appRouter;
