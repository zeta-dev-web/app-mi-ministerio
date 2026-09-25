"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AuthTabs() {
  const pathname = usePathname();
  const login = pathname === "/login";
  const tab = (active: boolean) =>
    `flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition ${
      active ? "bg-surface text-primary shadow-sm" : "text-muted"
    }`;
  return (
    <div role="tablist" aria-label="Acceso" className="grid grid-cols-2 gap-1 rounded-2xl bg-canvas p-1">
      <Link href="/login" role="tab" aria-selected={login} className={tab(login)}>
        Ingresar
      </Link>
      <Link href="/register" role="tab" aria-selected={!login} className={tab(!login)}>
        Crear cuenta
      </Link>
    </div>
  );
}
