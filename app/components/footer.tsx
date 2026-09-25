import Link from "next/link";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer
      className="relative w-full overflow-hidden pb-28 sm:pb-10 lg:pb-8"
      aria-label="Pie de página"
      style={{ background: "linear-gradient(135deg, var(--color-primary-strong), var(--color-primary))" }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-20 right-0 h-64 w-64 rounded-full"
        style={{ background: "color-mix(in srgb, var(--color-on-primary) 10%, transparent)" }}
      />
      <div
        className="relative mx-auto flex w-full max-w-[1280px] flex-col gap-2 px-4 pt-8 sm:px-7"
        style={{ color: "var(--color-on-primary)" }}
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <p className="font-display text-2xl tracking-tight">Mi Ministerio</p>
          <Link
            href="/terminos"
            className="min-h-[44px] py-2 text-sm font-medium opacity-90 underline underline-offset-4 hover:opacity-100 sm:min-h-0 sm:py-0"
          >
            Términos y Condiciones
          </Link>
        </div>
        <p className="text-sm opacity-80">Tu compañero para el servicio del campo.</p>
        <p
          className="mt-3 border-t pt-3 text-xs opacity-80"
          style={{ borderColor: "color-mix(in srgb, var(--color-on-primary) 25%, transparent)" }}
        >
          © {year} ZetaDev · Todos los derechos reservados
        </p>
      </div>
    </footer>
  );
}
