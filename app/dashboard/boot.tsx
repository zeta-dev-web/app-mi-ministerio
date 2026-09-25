"use client";

import { useEffect, useState } from "react";

function SkeletonCard({ tall = false }: { tall?: boolean }) {
  return (
    <div aria-hidden="true" className="rounded-xl border border-line bg-surface p-5">
      <div className="h-4 w-2/5 animate-pulse rounded bg-line" />
      <div className={`mt-3 w-3/4 animate-pulse rounded bg-line ${tall ? "h-12" : "h-8"}`} />
      <div className="mt-3 h-3 w-1/2 animate-pulse rounded bg-line" />
    </div>
  );
}

/**
 * Muestra esqueletos del Inicio hasta que el tema queda aplicado en el
 * documento; recién ahí renderiza el contenido real.
 */
export function BootGate({ children }: { children: React.ReactNode }) {
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setBooted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!booted) {
    return (
      <div className="flex flex-col gap-5" aria-busy="true" aria-label="Cargando inicio">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="h-4 w-40 animate-pulse rounded bg-line" />
            <div className="mt-2 h-8 w-56 animate-pulse rounded bg-line" />
          </div>
          <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-line" />
        </div>
        <SkeletonCard tall />
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} aria-hidden="true" className="rounded-xl border border-line bg-surface p-3">
              <div className="mx-auto h-6 w-3/4 animate-pulse rounded bg-line" />
              <div className="mx-auto mt-2 h-3 w-1/2 animate-pulse rounded bg-line" />
            </div>
          ))}
        </div>
        <SkeletonCard />
        <SkeletonCard tall />
      </div>
    );
  }

  return <>{children}</>;
}
