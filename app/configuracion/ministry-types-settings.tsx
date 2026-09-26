"use client";

import { useEffect, useState } from "react";
import { useToast } from "../components/toast";

type MinistryType = { id: string; name: string; userId: string | null; active: boolean };

export function MinistryTypesSettings() {
  const toast = useToast();
  const [globals, setGlobals] = useState<string[]>([]);
  const [disabled, setDisabled] = useState<string[]>([]);
  const [mine, setMine] = useState<MinistryType[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    // Sin setError(null) acá: load() se llama desde un useEffect y un setState
    // síncrono al entrar provoca un render en cascada. El error lo limpia cada
    // acción (toggleGlobal/toggleMine/addMine) y en el montaje ya es null.
    const [preferencesResponse, typesResponse] = await Promise.all([
      fetch("/api/preferences"),
      fetch("/api/ministry-types?includeInactive=true"),
    ]);
    const preferences = await preferencesResponse.json().catch(() => ({}));
    const types = await typesResponse.json().catch(() => ({}));
    if (!preferencesResponse.ok || !typesResponse.ok) {
      setError("No se pudieron cargar los tipos de servicios.");
      return;
    }
    setGlobals(preferences.globals ?? []);
    setDisabled(preferences.disabled ?? []);
    setMine((types.types ?? []).filter((type: MinistryType) => type.userId != null));
  }

  useEffect(() => {
    // Mismo patrón que app/configuracion/page.tsx: el fetch va dentro de un
    // IIFE y la guarda `alive` evita el setState si el componente se desmonta
    // mientras la petición está en vuelo. Además, setLoading solo se toca fuera
    // del cuerpo síncrono del efecto, así que no hay render en cascada.
    let alive = true;
    (async () => {
      await load();
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function toggleGlobal(name: string) {
    if (name === "Servicio") return;
    const nextDisabled = disabled.includes(name)
      ? disabled.filter((item) => item !== name)
      : [...disabled, name];
    setBusy(name);
    setError(null);
    const response = await fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disabled: nextDisabled }),
    });
    if (!response.ok) {
      setError("No se pudo guardar el tipo de servicio.");
    } else {
      setDisabled(nextDisabled);
      toast("Cambios guardados");
    }
    setBusy(null);
  }

  async function toggleMine(type: MinistryType) {
    setBusy(type.id);
    setError(null);
    const response = await fetch(`/api/ministry-types/${type.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !type.active }),
    });
    if (!response.ok) {
      setError("No se pudo guardar el tipo de servicio.");
    } else {
      setMine((current) => current.map((item) => (item.id === type.id ? { ...item, active: !item.active } : item)));
      toast("Cambios guardados");
    }
    setBusy(null);
  }

  async function addMine(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setBusy("new");
    setError(null);
    const response = await fetch("/api/ministry-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, active: true }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error ?? "No se pudo agregar el tipo de servicio.");
    } else {
      setNewName("");
      setMine((current) => [...current, data.type]);
      toast("Tipo de servicio agregado");
    }
    setBusy(null);
  }

  if (loading) return <p className="text-sm text-muted">Cargando tipos de servicios…</p>;

  return (
    <section aria-labelledby="ministry-types-title" className="flex flex-col gap-3">
      <div>
        <h2 id="ministry-types-title" className="font-display text-2xl tracking-tight">TIPOS DE SERVICIOS</h2>
        <p className="mt-1 text-sm text-muted">Marcá los tipos que querés tener disponibles al registrar una actividad.</p>
      </div>

      <div className="grid gap-2 lg:grid-cols-2">
        {globals.map((name) => {
          const checked = !disabled.includes(name);
          const locked = name === "Servicio";
          return (
            <label key={name} className="flex min-h-[64px] cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface p-3">
              <input
                type="checkbox"
                checked={checked}
                disabled={locked || busy === name}
                onChange={() => toggleGlobal(name)}
                className="h-5 w-5 shrink-0 accent-[var(--color-primary)]"
              />
              <span className="min-w-0 flex-1 font-medium">{name}</span>
              {locked && <span className="text-xs text-muted">Requerido</span>}
            </label>
          );
        })}
        {mine.map((type) => (
          <label key={type.id} className="flex min-h-[64px] cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface p-3">
            <input
              type="checkbox"
              checked={type.active}
              disabled={busy === type.id}
              onChange={() => toggleMine(type)}
              className="h-5 w-5 shrink-0 accent-[var(--color-primary)]"
            />
            <span className="min-w-0 flex-1 font-medium">{type.name}</span>
          </label>
        ))}
      </div>

      <form onSubmit={addMine} className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="new-ministry-type">Nuevo tipo de servicio</label>
        <input
          id="new-ministry-type"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          maxLength={60}
          placeholder="Agregar un tipo de servicio"
          className="min-h-[48px] flex-1 rounded-md border border-line bg-surface px-3 py-2 text-base placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={busy === "new" || !newName.trim()}
          className="min-h-[48px] shrink-0 rounded-md bg-primary px-4 font-medium text-on-primary transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {busy === "new" ? "Agregando…" : "Agregar"}
        </button>
      </form>
      {error && <p role="alert" className="rounded-md bg-pale-red px-3 py-2 text-sm text-pale-red-ink">{error}</p>}
    </section>
  );
}
