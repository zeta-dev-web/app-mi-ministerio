"use client";

import { useState } from "react";

export const TERMS_SECTIONS: { title: string; body: string }[] = [
  {
    title: "1. Qué es este servicio",
    body: "Mi Ministerio es una aplicación de registro personal de actividad religiosa. Te permite llevar tus horas, visitas, estudios, asignaciones y lectura, y generar tu informe mensual. Es una herramienta de organización personal.",
  },
  {
    title: "2. Tus datos son tu responsabilidad",
    body: "Toda la información que ingreses (horas, personas, notas, fechas) es responsabilidad exclusiva de quien la ingresa. Debés cargar datos veraces y contar con el consentimiento de las personas cuyos datos personales registres (nombres, teléfonos, direcciones).",
  },
  {
    title: "3. Sin garantía de disponibilidad ni de conservación",
    body: "El servicio se ofrece tal cual, sin garantías de disponibilidad continua ni de conservación permanente de los datos. No nos hacemos responsables por pérdida de información, interrupciones, fallas técnicas o errores de la aplicación. Te recomendamos descargar tu copia de seguridad periódicamente desde Configuración.",
  },
  {
    title: "4. Tu cuenta y tu contraseña",
    body: "Sos responsable de mantener en secreto tu contraseña y de toda actividad realizada con tu cuenta. Si detectás un uso no autorizado, cambiá tu contraseña de inmediato.",
  },
  {
    title: "5. Uso correcto",
    body: "No está permitido usar la aplicación para fines ilícitos, para vulnerar la privacidad de terceros ni para alterar o acceder a cuentas ajenas.",
  },
  {
    title: "6. Cambios y suspensión",
    body: "Podemos modificar, suspender o dar de baja el servicio o estas condiciones en cualquier momento. Los cambios sustanciales se informarán dentro de la aplicación.",
  },
  {
    title: "7. Aceptación",
    body: "Al crear tu cuenta declarás haber leído estos términos, aceptarlos y tener edad suficiente para usar el servicio o contar con autorización de un adulto responsable.",
  },
];

export function TermsModal({ onClose }: { onClose: () => void }) {
  const [atBottom, setAtBottom] = useState(false);
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Términos y condiciones"
    >
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/40"
      />
      <div className="sheet-in relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-canvas sm:max-w-lg sm:rounded-xl sm:border sm:border-line">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 sm:px-6">
          <p className="font-display text-2xl tracking-tight">Términos y condiciones</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar diálogo"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-line bg-surface transition-transform active:scale-[0.98]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div
          className="overflow-y-auto px-4 py-4 sm:px-6"
          onScroll={(e) => {
            const el = e.currentTarget;
            setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 24);
          }}
        >
          {TERMS_SECTIONS.map((s) => (
            <div key={s.title} className="mb-4">
              <h2 className="font-medium">{s.title}</h2>
              <p className="mt-1 text-sm text-muted">{s.body}</p>
            </div>
          ))}
          {!atBottom && (
            <p className="sticky bottom-0 bg-canvas py-2 text-center text-xs font-medium text-primary">
              Deslizá para leer todo ↓
            </p>
          )}
        </div>
        <div className="border-t border-line bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] w-full rounded-md bg-primary px-4 font-medium text-on-primary transition-transform active:scale-[0.98]"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
