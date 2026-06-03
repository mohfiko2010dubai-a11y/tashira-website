import { authRouter } from "./auth-router";
import { applicationRouter } from "./application-router";
import { paymentRouter } from "./payment-router";
import { chatRouter } from "./chat-router";
import { driveRouter } from "./drive-router";
import { invoiceRouter } from "./invoice-router";
import { supplierRouter } from "./supplier-router";
import { staffRouter } from "./staff-router";
import { createRouter } from "./middleware";

export const appRouter = createRouter({
  auth: authRouter,
  application: applicationRouter,
  payment: paymentRouter,
  chat: chatRouter,
  drive: driveRouter,
  invoice: invoiceRouter,
  supplier: supplierRouter,
  staff: staffRouter,
});

export type AppRouter = typeof appRouter;
