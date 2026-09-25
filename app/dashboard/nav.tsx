"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "../theme-toggle";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

const ICON = {
  inicio: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  ),
  actividad: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  personas: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
    </svg>
  ),
  informe: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M9 13h6M9 17h6" />
    </svg>
  ),
  asignaciones: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6l16 0M4 12l16 0M4 18l10 0" />
      <path d="M17 15l2 2 4-4" />
    </svg>
  ),
  biblia: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  stats: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M3 3v18h18" />
      <path d="M7 15v3M12 10v8M17 6v12" />
    </svg>
  ),
  config: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.9.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.9v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  ),
};

const MOBILE_TABS = [
  { href: "/dashboard", label: "Inicio", icon: ICON.inicio },
  { href: "/actividad", label: "Actividad", icon: ICON.actividad },
  { href: "/personas", label: "Personas", icon: ICON.personas },
  { href: "/informe", label: "Informe", icon: ICON.informe },
];

const DESKTOP_PRIMARY = [
  { href: "/dashboard", label: "Inicio", icon: ICON.inicio },
  { href: "/actividad", label: "Actividad", icon: ICON.actividad },
  { href: "/personas", label: "Personas", icon: ICON.personas },
  { href: "/informe", label: "Informe", icon: ICON.informe },
  { href: "/tareas", label: "Asignaciones", icon: ICON.asignaciones },
  { href: "/biblia", label: "Lectura Bíblica", icon: ICON.biblia },
];

export function DashboardNav({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  return (
    <>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[80] focus:rounded-md focus:bg-surface focus:p-3">Ir al contenido</a>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-surface p-5 lg:flex">
        <Link href="/dashboard" className="flex items-center gap-3 text-lg font-semibold tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary-ink" aria-hidden="true">m.</span>
          Mi Ministerio
        </Link>
        <p className="mt-8 mb-3 text-xs font-medium text-muted">Tu espacio personal</p>
        <nav aria-label="Principal escritorio" className="flex flex-col gap-1">
          {DESKTOP_PRIMARY.map((item) => (
            <Link key={item.href} href={item.href} aria-current={isActive(pathname, item.href) ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${isActive(pathname, item.href) ? "bg-primary-soft font-semibold text-primary-ink" : "text-muted hover:bg-canvas hover:text-ink"}`}>
              {item.icon}{item.label}
            </Link>
          ))}
        </nav>
        <p className="mt-6 mb-2 text-xs font-medium text-muted">Más</p>
        <nav aria-label="Secundario escritorio" className="flex flex-col gap-1">
          {[
            { href: "/estadisticas", label: "Estadísticas", icon: ICON.stats },
            { href: "/configuracion", label: "Configuración", icon: ICON.config },
          ].map((item) => (
            <Link key={item.href} href={item.href} aria-current={isActive(pathname, item.href) ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${isActive(pathname, item.href) ? "bg-primary-soft font-semibold text-primary-ink" : "text-muted hover:bg-canvas hover:text-ink"}`}>
              {item.icon}{item.label}
            </Link>
          ))}
        </nav>
        <Link href="?cargar=1" className="mt-5 flex min-h-11 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-on-primary hover:bg-primary-strong">+ Agregar actividad</Link>
        <div className="mt-auto border-t border-line pt-4">
          <p className="truncate text-xs text-muted" title={userEmail}>{userEmail}</p>
          <div className="mt-3 flex items-center justify-between">
            <ThemeToggle />
            <button type="button" onClick={() => signOut({ callbackUrl: "/login" })} className="min-h-11 rounded-lg px-3 text-sm text-muted hover:bg-canvas hover:text-ink">Salir</button>
          </div>
        </div>
      </aside>
      <header className="border-b border-line bg-surface lg:hidden">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-2 px-4 py-2.5 sm:px-6 lg:max-w-6xl">
          <Link href="/dashboard" className="shrink-0 font-display text-lg whitespace-nowrap tracking-tight text-primary">
            Mi Ministerio
          </Link>
          <div className="flex shrink-0 items-center gap-2 text-sm">
            <span className="hidden max-w-36 truncate text-muted xl:inline">{userEmail}</span>
            <Link
              href="/biblia"
              aria-label="Lectura Bíblica"
              className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border transition-transform active:scale-[0.98] ${
                isActive(pathname, "/biblia") ? "border-primary bg-primary-soft text-primary-ink" : "border-line bg-surface"
              }`}
            >
              {ICON.biblia}
            </Link>
            <Link
              href="/estadisticas"
              aria-label="Estadísticas"
              className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border transition-transform active:scale-[0.98] ${
                isActive(pathname, "/estadisticas") ? "border-primary bg-primary-soft text-primary-ink" : "border-line bg-surface"
              }`}
            >
              {ICON.stats}
            </Link>
            <Link
              href="/configuracion"
              aria-label="Configuración"
              className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border transition-transform active:scale-[0.98] ${
                isActive(pathname, "/configuracion") ? "border-primary bg-primary-soft text-primary-ink" : "border-line bg-surface"
              }`}
            >
              {ICON.config}
            </Link>
            <ThemeToggle />
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="hidden min-h-[44px] items-center rounded-md border border-line bg-surface px-3 transition-transform active:scale-[0.98] sm:flex"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <nav
        aria-label="Principal móvil"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <div className="grid grid-cols-5 items-end px-2">
          <TabLink tab={MOBILE_TABS[0]} active={isActive(pathname, MOBILE_TABS[0].href)} />
          <TabLink tab={MOBILE_TABS[1]} active={isActive(pathname, MOBILE_TABS[1].href)} />
          <Link
            href="?cargar=1"
            aria-label="Agregar actividad"
            className="flex flex-col items-center gap-1 pb-2"
          >
            <span className="flex h-14 w-14 -translate-y-3 items-center justify-center rounded-full bg-primary text-on-primary shadow-[0_4px_16px_rgba(0,0,0,0.12)] transition-transform active:scale-95">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <span className="-mt-2 text-[11px] font-medium text-muted">Agregar</span>
          </Link>
          <TabLink tab={MOBILE_TABS[2]} active={isActive(pathname, MOBILE_TABS[2].href)} />
          <TabLink tab={MOBILE_TABS[3]} active={isActive(pathname, MOBILE_TABS[3].href)} />
        </div>
      </nav>
    </>
  );
}

function TabLink({ tab, active }: { tab: (typeof MOBILE_TABS)[number]; active: boolean }) {
  return (
    <Link
      href={tab.href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-[64px] flex-col items-center justify-center gap-1 text-[11px] font-medium ${
        active ? "text-primary" : "text-muted"
      }`}
    >
      {tab.icon}
      {tab.label}
    </Link>
  );
}
