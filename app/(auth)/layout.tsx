export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-dvh"
      style={{ background: "linear-gradient(180deg, var(--color-primary-strong), var(--color-primary))" }}
    >
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-[max(env(safe-area-inset-top),2.5rem)] pb-10">
        <div className="mb-7 flex flex-col items-center text-center">
          <div
            className="grid h-20 w-20 place-items-center rounded-3xl bg-[color-mix(in_srgb,var(--color-on-primary)_15%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--color-on-primary)_30%,transparent)] backdrop-blur"
            aria-hidden="true"
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-on-primary)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z" />
            </svg>
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight" style={{ color: "var(--color-on-primary)" }}>
            Mi Ministerio
          </h1>
          <p className="mt-1 text-sm opacity-80" style={{ color: "var(--color-on-primary)" }}>
            Tu asistente para tu servicio
          </p>
        </div>
        <div className="rounded-[28px] bg-surface p-6 shadow-xl">{children}</div>
      </div>
    </div>
  );
}
