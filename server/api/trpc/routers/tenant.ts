import { z } from "zod";
import { procedure, router } from "../init";

export const tenantRouter = router({
  hello: procedure
    .input(z.object({ name: z.string() }))
    .query(({ input }) => {
      return { greeting: `Hello ${input.name}!` };
    }),
});
