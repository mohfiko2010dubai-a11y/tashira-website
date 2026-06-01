import { authRouter } from "./auth-router";
import { applicationRouter } from "./application-router";
import { paymentRouter } from "./payment-router";
import { chatRouter } from "./chat-router";
import { driveRouter } from "./drive-router";
import { createRouter } from "./middleware";

/**
 * App router — aggregates all tRPC sub-routers.
 */
export const appRouter = createRouter({
  auth: authRouter,
  application: applicationRouter,
  payment: paymentRouter,
  chat: chatRouter,
  drive: driveRouter,
});

// Export the type for tRPC client inference.
export type AppRouter = typeof appRouter;
