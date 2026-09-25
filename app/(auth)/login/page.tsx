"use client";

import { Suspense, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthTabs } from "../../components/auth-tabs";

const LAST_EMAIL_KEY = "mm_last_email";

const inputCls =
  "min-h-[52px] w-full rounded-2xl border-0 bg-canvas px-4 py-3 text-base placeholder:text-muted transition focus:bg-surface focus:ring-2 focus:ring-primary focus:outline-none";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const last = window.localStorage.getItem(LAST_EMAIL_KEY);
      if (last) setEmail(last);
    } catch {
      /* sin almacenamiento */
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("Email o contraseña incorrectos.");
      return;
    }
    try {
      window.localStorage.setItem(LAST_EMAIL_KEY, email.trim().toLowerCase());
    } catch {
      /* sin almacenamiento */
    }
    router.push(params.get("callbackUrl") ?? "/dashboard");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <AuthTabs />
      <div>
        <h2 className="text-xl font-bold">Bienvenido de nuevo</h2>
        <p className="mt-0.5 text-sm text-muted">Entra con tu correo y contraseña.</p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
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
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tu contraseña"
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
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
