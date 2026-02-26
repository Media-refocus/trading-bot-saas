import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// Rutas que requieren autenticacion
const protectedRoutes = [
  "/dashboard",
  "/backtester",
  "/operativas",
  "/bot",
  "/settings",
];

// Rutas publicas (no requieren autenticacion)
const publicRoutes = [
  "/login",
  "/register",
  "/api",
  "/_next",
  "/favicon.ico",
  "/images",
];

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  // Verificar si es una ruta publica
  const isPublicRoute = publicRoutes.some((route) =>
    nextUrl.pathname.startsWith(route)
  );

  // Verificar si es una ruta protegida
  const isProtectedRoute = protectedRoutes.some((route) =>
    nextUrl.pathname.startsWith(route)
  );

  // Si es una ruta protegida y no esta autenticado, redirigir a login
  if (isProtectedRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  // Si esta autenticado e intenta acceder a login/register, redirigir a dashboard
  if (isLoggedIn && (nextUrl.pathname === "/login" || nextUrl.pathname === "/register")) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
