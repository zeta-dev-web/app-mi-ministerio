import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export default async function proxy(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    const login = new URL("/login", req.url);
    login.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/actividad",
    "/actividad/:path*",
    "/personas",
    "/personas/:path*",
    "/tipos",
    "/tipos/:path*",
    "/perfil",
    "/perfil/:path*",
    "/personas",
    "/personas/:path*",
    "/estadisticas",
    "/estadisticas/:path*",
    "/tareas",
    "/tareas/:path*",
    "/biblia",
    "/biblia/:path*",
    "/configuracion",
    "/configuracion/:path*",
    "/informe",
    "/informe/:path*",
  ],
};
