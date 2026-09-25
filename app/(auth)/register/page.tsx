"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthTabs } from "../../components/auth-tabs";
import { TermsModal } from "../../components/terms";

const inputCls =
  "min-h-[52px] w-full rounded-2xl border-0 bg-canvas px-4 py-3 text-base placeholder:text-muted transition focus:bg-surface focus:ring-2 focus:ring-primary focus:outline-none";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accepted) {
      setError("Tenés que aceptar los Términos y Condiciones para crear tu cuenta.");
      return;
    }
    setError(null);
    setLoading(true);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, acceptedTerms: true }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo crear la cuenta.");
      return;
    }
    try {
      window.localStorage.setItem("mm_last_email", email.trim().toLowerCase());
    } catch {
      /* sin almacenamiento */
    }
    router.push("/login");
  }

  return (
    <div className="flex flex-col gap-5">
      <AuthTabs />
      <div>
        <h2 className="text-xl font-bold">Crea tu cuenta</h2>
        <p className="mt-0.5 text-sm text-muted">Solo tu nombre, un correo y una contraseña. Tus datos son privados.</p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Nombre completo</span>
          <input
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Como aparecerá en tu informe"
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Correo electrónico</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Contraseña</span>
          <span className="relative block">
            <input
              type={showPw ? "text" : "password"}
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className={`${inputCls} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              aria-label={showPw ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="absolute inset-y-0 right-0 grid w-12 place-items-center text-muted"
            >
              {showPw ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M6.61 6.61A13.5 13.5 0 0 0 1 12s4 8 11 8a9.6 9.6 0 0 0 5.39-1.61" />
                  <path d="M2 2l20 20" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 12s3.5-8 10-8c2 0 3.7.7 5.1 1.7M22 12s-3.5 8-10 8c-2 0-3.7-.7-5.1-1.7" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[#C05A2E]"
          />
          <span>
            Acepto los{" "}
            <button
              type="button"
              onClick={() => setShowTerms(true)}
              className="font-medium text-primary underline underline-offset-2"
            >
              Términos y Condiciones
            </button>
          </span>
        </label>
        {error && (
          <p role="alert" className="rounded-2xl bg-pale-red px-4 py-3 text-sm text-pale-red-ink">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="min-h-[52px] rounded-2xl bg-primary px-4 font-semibold text-on-primary transition-transform hover:bg-primary-strong active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? "Creando tu cuenta…" : "Crear cuenta y entrar"}
        </button>
      </form>
      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
    </div>
  );
}
