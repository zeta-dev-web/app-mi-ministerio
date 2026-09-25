import Link from "next/link";
import { TERMS_SECTIONS } from "../components/terms";

export const metadata = {
  title: "Términos y Condiciones",
};

export default function TerminosPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 py-10 sm:px-6">
      <Link href="/dashboard" className="text-sm font-medium text-primary underline underline-offset-4">
        ← Volver al inicio
      </Link>
      <h1 className="font-display mt-4 text-4xl tracking-tight">Términos y Condiciones</h1>
      <div className="mt-6 flex flex-col gap-2">
        {TERMS_SECTIONS.map((s) => (
          <section key={s.title} aria-label={s.title} className="rounded-xl border border-line bg-surface p-4 sm:p-5">
            <h2 className="font-medium">{s.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">{s.body}</p>
          </section>
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-muted">
        Desarrollado por ZetaDev · © {new Date().getFullYear()} Todos los derechos reservados
      </p>
    </main>
  );
}
