import { z } from "zod";
import { procedure, router } from "../init";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";

export const authRouter = router({
  me: procedure.query(async () => {
    // Este procedimiento retornará información del usuario autenticado
    return { message: "Not implemented yet" };
  }),
});
