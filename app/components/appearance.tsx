"use client";
import { PALETTES, useTheme } from "../theme-provider";
import { ThemeToggle } from "../theme-toggle";

export function Appearance() {
  const { theme, palette, setPalette, error } = useTheme();
  return (
    <section aria-labelledby="appearance-title" className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 id="appearance-title" className="text-base font-semibold">Apariencia</h2>
          <p className="mt-1 text-sm text-muted">Modo {theme === "dark" ? "oscuro" : "claro"}. Elegí tu combinación de colores.</p>
        </div>
        <ThemeToggle />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6" role="group" aria-label="Paleta de colores">
        {PALETTES.map(p => (
          <button key={p.id} type="button" aria-pressed={palette === p.id} onClick={() => setPalette(p.id)} className={`flex min-h-16 items-center gap-3 rounded-lg border px-3 py-3 text-sm transition-colors ${palette === p.id ? "border-primary bg-primary-soft text-primary-ink" : "border-line hover:bg-canvas"}`}>
            <span aria-hidden="true" className="h-7 w-7 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: p.swatch }} />
            <span className="font-medium">{p.name}</span>
          </button>
        ))}
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
    </section>
  );
}
