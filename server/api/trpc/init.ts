import { initTRPC, TRPCError } from "@trpc/server";
import { type NextRequest } from "next/server";
import superjson from "superjson";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface CreateContextOptions {
  headers: Headers;
}

export const createContext = async ({ headers }: CreateContextOptions) => {
  // Obtener sesion de NextAuth
  const session = await auth();

  // Si hay usuario autenticado, obtener datos completos
  let user = null;
  if (session?.user?.id) {
    user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        tenantId: true,
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  return {
    headers,
    session,
    user,
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof Error ? error.cause.message : null,
      },
    };
  },
});

export const router = t.router;
export const procedure = t.procedure;
export const middleware = t.middleware;
export const mergeRouters = t.mergeRouters;

// Middleware para verificar autenticacion
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Debes iniciar sesion para acceder a este recurso",
    });
  }

  return next({
    ctx: {
      // Infieren que ctx.user no es null
      user: ctx.user,
      session: ctx.session,
    },
  });
});

// Procedimiento protegido que requiere autenticacion
export const protectedProcedure = t.procedure.use(isAuthed);
