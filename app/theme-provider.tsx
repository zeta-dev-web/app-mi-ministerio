"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

type Theme = "light" | "dark";

export const PALETTES = [
  { id: "sage", name: "Salvia", swatch: "#bad7c5" },
  { id: "sky", name: "Cielo", swatch: "#bfd6ed" },
  { id: "lavender", name: "Lavanda", swatch: "#d7c7e9" },
  { id: "terracotta", name: "Arcilla", swatch: "#ebc5af" },
  { id: "honey", name: "Miel", swatch: "#f3df9f" },
  { id: "rose", name: "Rosa", swatch: "#efbfd0" },
] as const;
export type Palette = (typeof PALETTES)[number]["id"];
type ThemeState = { theme: Theme; palette: Palette };

const ThemeContext = createContext<ThemeState & {
  toggle: () => void;
  setPalette: (value: Palette) => void;
  error: string | null;
}>({ theme: "light", palette: "sage", toggle: () => {}, setPalette: () => {}, error: null });

export function useTheme() {
  return useContext(ThemeContext);
}

function apply(state: ThemeState) {
  document.documentElement.classList.toggle("dark", state.theme === "dark");
  if (state.palette === "terracotta") {
    delete document.documentElement.dataset.palette;
  } else {
    document.documentElement.dataset.palette = state.palette;
  }
}

export function ThemeProvider({
  children,
  initialTheme,
  initialPalette,
  userKey,
}: {
  children: React.ReactNode;
  initialTheme: Theme;
  initialPalette: Palette;
  userKey: string;
}) {
  const [state, setState] = useState<ThemeState>({ theme: initialTheme, palette: initialPalette });
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const [synced, setSynced] = useState<{ state: ThemeState; userKey: string }>({
    state: { theme: initialTheme, palette: initialPalette },
    userKey,
  });

  // El servidor puede mandar otra apariencia (o cambiar de usuario) sin que
  // cambie el `key` del provider. Se ajusta DURANTE el render y no en un
  // efecto: un setState dentro del cuerpo de un efecto provoca un segundo
  // render en cascada. Es el patrón "adjusting state when a prop changes" de
  // React. El `key={userKey}` de layout.tsx ya remonta el provider al cambiar
  // de usuario, así que esto cubre el caso re-render sin remount.
  if (synced.state.theme !== initialTheme || synced.state.palette !== initialPalette || synced.userKey !== userKey) {
    setSynced({ state: { theme: initialTheme, palette: initialPalette }, userKey });
    setState({ theme: initialTheme, palette: initialPalette });
    setError(null);
  }

  // Refleja el estado en el DOM. No lleva setState: solo sincroniza el sistema
  // externo (documentElement), que es justamente para lo que sirve un efecto.
  useEffect(() => {
    apply(state);
  }, [state]);

  useEffect(() => () => requestRef.current?.abort(), []);

  async function persist(next: ThemeState, previous: ThemeState) {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setState(next);
    apply(next);
    setError(null);
    try {
      const response = await fetch("/api/appearance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("No se pudo guardar la apariencia.");
    } catch (cause) {
      if (controller.signal.aborted) return;
      setState(previous);
      apply(previous);
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la apariencia.");
    }
  }

  function toggle() {
    const nextTheme: Theme = state.theme === "dark" ? "light" : "dark";
    void persist({ ...state, theme: nextTheme }, state);
  }

  function setPalette(palette: Palette) {
    void persist({ ...state, palette }, state);
  }

  return <ThemeContext.Provider value={{ ...state, toggle, setPalette, error }}>{children}</ThemeContext.Provider>;
}
