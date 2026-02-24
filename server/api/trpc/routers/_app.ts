import { router } from "../init";
import { authRouter } from "./auth";
import { tenantRouter } from "./tenant";
import { backtesterRouter } from "./backtester";
import { strategiesRouter } from "./strategies";

export const appRouter = router({
  auth: authRouter,
  tenant: tenantRouter,
  backtester: backtesterRouter,
  strategies: strategiesRouter,
});

export type AppRouter = typeof appRouter;
