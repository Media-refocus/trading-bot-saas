import { router } from "../init";
import { authRouter } from "./auth";
import { tenantRouter } from "./tenant";

export const appRouter = router({
  auth: authRouter,
  tenant: tenantRouter,
});

export type AppRouter = typeof appRouter;
