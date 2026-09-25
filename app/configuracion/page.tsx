"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useToast } from "../components/toast";
import { FEATURES } from "@/lib/features";
import { Appearance } from "../components/appearance";
import { MinistryTypesSettings } from "./ministry-types-settings";
import { NotificationSettings } from "./notification-settings";

export default function ConfiguracionPage() {
  const toast = useToast();
  const [ready, setReady] = useState(false);

  // Copia de seguridad
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreStep, setRestoreStep] = useState<0 | 1 | 2>(0);

  // Cambiar contraseña
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [repeatPw, setRepeatPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  // Informe mensual (horas completas)
  const [reportBase, setReportBase] = useState<Record<string, unknown> | null>(null);
  const [carry, setCarry] = useState(false);
  const [reportSaving, setReportSaving] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const load = async () => {
    const profRes = await fetch("/api/profile");
    const profData = await profRes.json().catch(() => ({}));
    if (profData.profile) {
      const p = profData.profile;
      setReportBase({
        name: p.name ?? "",
        phone: p.phone ?? null,
        congregation: p.congregation ?? null,
        baptismDate: p.baptismDate ?? null,
        publisherSince: p.publisherSince ?? null,
        personalGoalHours: p.personalGoalHours ?? null,
        annualGoalHours: p.annualGoalHours ?? null,
        serviceRoleId: p.serviceRole?.id ?? null,
        recipientName: p.recipientName ?? null,
        recipientPhone: p.recipientPhone ?? null,
      });
      setCarry(p.carryMinutes ?? false);
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      await load();
      if (alive) setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function saveReport(nextCarry: boolean) {
    if (!reportBase) return;
    setReportError(null);
    setReportSaving(true);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...reportBase, carryMinutes: nextCarry }),
    });
    setReportSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setReportError(data.error ?? "No se pudo guardar el informe mensual.");
      return;
    }
    setCarry(nextCarry);
    toast("Informe mensual guardado");
  }

  async function downloadBackup() {
    setBackupMsg(null);
    setBackupBusy(true);
    try {
      const res = await fetch("/api/backup");
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mi-ministerio-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast("Copia descargada");
    } catch {
      setBackupMsg("No se pudo descargar la copia.");
    } finally {
      setBackupBusy(false);
    }
  }

  async function restoreBackup() {
    if (!restoreFile) {
      setBackupMsg("Elegí un archivo de copia primero.");
      return;
    }
    setBackupMsg(null);
    setBackupBusy(true);
    try {
      const text = await restoreFile.text();
      const json = JSON.parse(text);
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Archivo inválido.");
      const r = data.restored ?? {};
      toast("Copia restaurada");
      setBackupMsg(
        `Restaurado: ${r.records ?? 0} registros, ${r.persons ?? 0} personas, ${r.tasks ?? 0} tareas, ${r.readings ?? 0} lecturas.`
      );
      setRestoreFile(null);
      setRestoreStep(0);
    } catch (e) {
      setBackupMsg(e instanceof Error ? e.message : "No se pudo restaurar la copia.");
    } finally {
      setBackupBusy(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    if (newPw !== repeatPw) {
      setPwError("La nueva contraseña y su repetición no coinciden.");
      return;
    }
    if (newPw.length < 8) {
      setPwError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setPwBusy(true);
    const res = await fetch("/api/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
    });
    const data = await res.json().catch(() => ({}));
    setPwBusy(false);
    if (!res.ok) {
      setPwError(data.error ?? "No se pudo cambiar la contraseña.");
      return;
    }
    toast("Contraseña actualizada");
    setCurrentPw("");
    setNewPw("");
    setRepeatPw("");
  }

  if (!ready) {
    return <p className="py-10 text-center text-sm text-muted">Cargando…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-fluid-3xl text-balance tracking-tight">Configuración</h1>
        <p className="mt-1 text-sm text-muted">
          Elegí qué formas de ministerio aparecen al agregar actividad. Por defecto solo Servicio está habilitado.
        </p>
      </div>
      <section className="rounded-xl border border-line bg-surface p-4" aria-labelledby="account-settings-title">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="account-settings-title" className="font-display text-2xl tracking-tight">Datos de tu cuenta</h2>
            <p className="mt-1 text-sm text-muted">Nombre, correo, congregación, condición y metas se administran juntos en Mi Perfil.</p>
          </div>
          <Link href="/perfil" className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-primary px-4 text-sm font-medium text-primary transition-colors hover:bg-primary-soft">
            Abrir Mi Perfil
          </Link>
        </div>
      </section>

      <Appearance />

      <NotificationSettings />

      <section aria-label="Informe mensual" className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3 sm:p-4">
        <h2 className="font-display text-2xl tracking-tight">Informe mensual</h2>
        <p className="-mt-1 text-sm text-muted">
          Los informes se envían en horas completas.
        </p>
        <div className="flex min-h-[64px] items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <span className="font-medium">Pasar minutos sobrantes al mes siguiente</span>
            <span className="text-xs text-muted">
              {carry ? "Se suman al próximo informe" : "Se descartan al informar"}
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={carry}
            aria-label="Pasar minutos sobrantes al mes siguiente"
            disabled={reportSaving || !reportBase}
            onClick={() => saveReport(!carry)}
            className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
              carry ? "bg-primary" : "bg-line"
            }`}
          >
            <span
              aria-hidden="true"
              className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${carry ? "left-7" : "left-1"}`}
            />
          </button>
        </div>
        {reportError && (
          <p role="alert" className="rounded-md bg-pale-red px-3 py-2 text-sm text-pale-red-ink">
            {reportError}
          </p>
        )}
      </section>
      <MinistryTypesSettings />
      {FEATURES.backup && (
      <section aria-label="Copia de seguridad" className="mt-2 flex flex-col gap-2">
        <h2 className="font-display text-2xl tracking-tight">Copia de seguridad</h2>
        <p className="-mt-2 text-sm text-muted">
          Descargá todo lo tuyo en un archivo JSON o restauralo después. La copia no incluye tu contraseña.
        </p>
        <button
          type="button"
          onClick={downloadBackup}
          disabled={backupBusy}
          className="min-h-[48px] rounded-md border border-line bg-surface px-4 py-2.5 font-medium transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {backupBusy ? "Descargando…" : "Descargar copia (JSON)"}
        </button>
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3">
          <label htmlFor="restore-file" className="text-sm font-medium">
            Restaurar desde archivo
          </label>
          <input
            id="restore-file"
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              setRestoreFile(e.target.files?.[0] ?? null);
              setRestoreStep(0);
              setBackupMsg(null);
            }}
            className="min-h-[48px] w-full rounded-md border border-line bg-canvas px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary-soft file:px-3 file:py-2 file:text-sm file:font-medium"
          />
          {restoreStep === 0 && (
            <button
              type="button"
              onClick={() => restoreFile && setRestoreStep(1)}
              disabled={backupBusy || !restoreFile}
              className="min-h-[48px] rounded-md bg-primary px-4 py-2.5 font-medium text-on-primary transition-transform hover:bg-primary-strong active:scale-[0.98] disabled:opacity-60"
            >
              Restaurar
            </button>
          )}
          {restoreStep === 1 && (
            <div className="flex flex-col gap-2 rounded-md bg-pale-red px-3 py-2 text-sm">
              <p className="font-medium text-pale-red-ink">
                Se borrarán tus datos actuales y se reemplazarán por los del archivo. ¿Continuar?
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRestoreStep(0)}
                  className="min-h-[48px] rounded-md border border-line bg-surface px-4 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => setRestoreStep(2)}
                  className="min-h-[48px] rounded-md bg-pale-red-ink px-4 font-medium text-white"
                >
                  Sí, continuar
                </button>
              </div>
            </div>
          )}
          {restoreStep === 2 && (
            <div className="flex flex-col gap-2 rounded-md bg-pale-red px-3 py-2 text-sm">
              <p className="font-medium text-pale-red-ink">
                Última confirmación: esta acción no se puede deshacer.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRestoreStep(0)}
                  className="min-h-[48px] rounded-md border border-line bg-surface px-4 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={restoreBackup}
                  disabled={backupBusy}
                  className="min-h-[48px] rounded-md bg-pale-red-ink px-4 font-medium text-white disabled:opacity-60"
                >
                  {backupBusy ? "Restaurando…" : "Restaurar definitivamente"}
                </button>
              </div>
            </div>
          )}
        </div>
        {backupMsg && (
          <p role="status" className="rounded-md border border-line bg-surface px-3 py-2 text-sm">
            {backupMsg}
          </p>
        )}
      </section>
      )}

      <section aria-label="Cambiar contraseña" className="mt-2 flex flex-col gap-2">
        <h2 className="font-display text-2xl tracking-tight">Cambiar contraseña</h2>
        <form onSubmit={changePassword} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Contraseña actual</span>
            <input
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              required
              autoComplete="current-password"
              className="min-h-[48px] w-full rounded-md border border-line bg-canvas px-3 py-2 text-base"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Nueva contraseña (mínimo 8 caracteres)</span>
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="min-h-[48px] w-full rounded-md border border-line bg-canvas px-3 py-2 text-base"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Repetir nueva contraseña</span>
            <input
              type="password"
              value={repeatPw}
              onChange={(e) => setRepeatPw(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="min-h-[48px] w-full rounded-md border border-line bg-canvas px-3 py-2 text-base"
            />
          </label>
          {pwError && (
            <p role="alert" className="rounded-md bg-pale-red px-3 py-2 text-sm text-pale-red-ink">
              {pwError}
            </p>
          )}
          <button
            type="submit"
            disabled={pwBusy}
            className="min-h-[48px] rounded-md bg-primary px-4 py-2.5 font-medium text-on-primary transition-transform hover:bg-primary-strong active:scale-[0.98] disabled:opacity-60"
          >
            {pwBusy ? "Guardando…" : "Cambiar contraseña"}
          </button>
        </form>
      </section>
    </div>
  );
}
