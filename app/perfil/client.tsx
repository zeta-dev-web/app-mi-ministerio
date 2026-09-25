"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "../components/toast";

type Role = { id: string; label: string; monthlyQuota: number | null };
type Profile = {
  name: string;
  email: string;
  phone: string;
  congregation: string;
  baptismDate: string;
  publisherSince: string;
  personalGoalHours: number | null;
  annualGoalHours: number | null;
  serviceRoleId: string | null;
  recipientName: string;
  recipientPhone: string;
};

const inputCls =
  "min-h-[48px] w-full rounded-md border border-line bg-surface px-3 py-2 text-base placeholder:text-muted";

function Icon({ d }: { d: string }) {
  return (
    <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-ink">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
      </svg>
    </span>
  );
}

const ICONS = {
  user: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  phone: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.8.7a2 2 0 0 1 1.7 2z",
  mail: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6",
  home: "M3 10.5L12 3l9 7.5M5 9.5V21h14V9.5",
  drop: "M12 2.7l5.7 5.7a8 8 0 1 1-11.4 0z",
  arrow: "M5 12h14M13 6l6 6-6 6",
  pencil: "M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
};

function Row({
  icon,
  label,
  value,
  onClick,
  href,
}: {
  icon: keyof typeof ICONS;
  label: string;
  value: string;
  onClick?: () => void;
  href?: string;
}) {
  const inner = (
    <>
      <Icon d={ICONS[icon]} />
      <span className="flex min-w-0 flex-1 flex-col text-left">
        <span className="text-sm text-muted">{label}</span>
        <span className={`truncate font-medium ${value ? "" : "text-muted"}`}>{value || "No establecido"}</span>
      </span>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-muted">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </>
  );
  const cls =
    "flex min-h-[64px] w-full items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left transition-transform active:scale-[0.99]";
  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute inset-0 cursor-default bg-black/40" />
      <div className="sheet-in relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-canvas sm:max-w-lg sm:rounded-xl sm:border sm:border-line">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 sm:px-6">
          <p className="font-display text-2xl tracking-tight">{title}</p>
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
        <div className="overflow-y-auto px-4 py-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">{children}</div>
      </div>
    </div>
  );
}

export function PerfilClient({ initial, roles }: { initial: Profile; roles: Role[] }) {
  const router = useRouter();
  const toast = useToast();
  const [profile, setProfile] = useState<Profile>(initial);
  const [editing, setEditing] = useState<null | "name" | "phone" | "congregation" | "baptismDate" | "publisherSince" | "role" | "goal" | "annualGoal" | "recipientName" | "recipientPhone">(null);
  const [draft, setDraft] = useState("");
  const [goalDraft, setGoalDraft] = useState("");
  const [annualGoalDraft, setAnnualGoalDraft] = useState("");
  const [roleDraft, setRoleDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const role = roles.find((r) => r.id === profile.serviceRoleId) ?? null;

  // Sugerencias derivadas de la cuota del rol (nunca pisan valores propios).
  const suggestedMonthly = role?.monthlyQuota ?? null;
  const suggestedAnnual =
    role?.monthlyQuota != null
      ? role.monthlyQuota * 12
      : profile.personalGoalHours != null
        ? profile.personalGoalHours * 12
        : null;

  function openEditor(field: NonNullable<typeof editing>) {
    setError(null);
    if (field === "goal")
      setGoalDraft(profile.personalGoalHours?.toString() ?? suggestedMonthly?.toString() ?? "");
    else if (field === "annualGoal")
      setAnnualGoalDraft(profile.annualGoalHours?.toString() ?? suggestedAnnual?.toString() ?? "");
    else if (field === "role") setRoleDraft(profile.serviceRoleId);
    else setDraft(profile[field] as string);
    setEditing(field);
  }

  async function save(patch: Partial<Profile>) {
    setError(null);
    setSaving(true);
    const body = {
      name: profile.name,
      phone: profile.phone || null,
      congregation: profile.congregation || null,
      baptismDate: profile.baptismDate || null,
      publisherSince: profile.publisherSince || null,
      personalGoalHours: profile.personalGoalHours,
      annualGoalHours: profile.annualGoalHours,
      serviceRoleId: profile.serviceRoleId,
      recipientName: profile.recipientName || null,
      recipientPhone: profile.recipientPhone || null,
      ...patch,
    };
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo guardar.");
      return false;
    }
    toast("Perfil actualizado");
    setProfile((p) => ({ ...p, ...patch }));
    setEditing(null);
    router.refresh();
    return true;
  }

  function saveRole(roleId: string) {
    const selectedRole = roles.find((r) => r.id === roleId);
    if (!selectedRole) return;

    // Las metas se recalculan únicamente al cambiar de rol. Después pueden editarse
    // manualmente y no se vuelven a tocar hasta otro cambio de rol.
    if (roleId !== profile.serviceRoleId) {
      const monthly = selectedRole.monthlyQuota;
      return save({
        serviceRoleId: roleId,
        personalGoalHours: monthly,
        annualGoalHours: monthly != null ? monthly * 12 : null,
      });
    }
    return save({ serviceRoleId: roleId });
  }

  const goalLabel =
    profile.personalGoalHours != null ? `${profile.personalGoalHours}h` : "Usando predeterminado";
  const annualGoalLabel =
    profile.annualGoalHours != null ? `${profile.annualGoalHours}h` : "No establecida";

  return (
    <div className="flex flex-col gap-3">
      <h1 className="font-display text-fluid-3xl text-balance tracking-tight">Mi Perfil</h1>

      <div className="grid gap-3 lg:grid-cols-2">
      <Row icon="user" label="Nombre completo" value={profile.name} onClick={() => openEditor("name")} />
      <Row icon="phone" label="Número de teléfono" value={profile.phone} onClick={() => openEditor("phone")} />
      <Row icon="mail" label="Correo electrónico" value={profile.email} />
      <Row icon="user" label="Soy…" value={role?.label ?? ""} onClick={() => openEditor("role")} />
      <Row icon="home" label="Congregación" value={profile.congregation} onClick={() => openEditor("congregation")} />
      <Row icon="drop" label="Fecha de bautismo" value={profile.baptismDate} onClick={() => openEditor("baptismDate")} />
      <Row icon="arrow" label="Fecha de convertirse en publicador" value={profile.publisherSince} onClick={() => openEditor("publisherSince")} />
      <Row icon="pencil" label="Meta Personal" value={goalLabel} onClick={() => openEditor("goal")} />
      <Row icon="clock" label="Meta anual" value={annualGoalLabel} onClick={() => openEditor("annualGoal")} />
      <Row icon="user" label="Destinatario del informe" value={profile.recipientName} onClick={() => openEditor("recipientName")} />
      <Row icon="phone" label="WhatsApp del destinatario" value={profile.recipientPhone} onClick={() => openEditor("recipientPhone")} />
      <Row icon="clock" label="Historial de servicio" value="Ver mi actividad" href="/actividad" />
      </div>

      {editing === "name" && (
        <Modal title="Nombre completo" onClose={() => setEditing(null)}>
          <EditorForm
            error={error}
            saving={saving}
            onSubmit={() => draft.trim() && save({ name: draft.trim() })}
          >
            <input value={draft} onChange={(e) => setDraft(e.target.value)} required maxLength={80} className={inputCls} placeholder="Tu nombre" />
          </EditorForm>
        </Modal>
      )}
      {editing === "phone" && (
        <Modal title="Número de teléfono" onClose={() => setEditing(null)}>
          <EditorForm error={error} saving={saving} onSubmit={() => save({ phone: draft.trim() })}>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} type="tel" maxLength={40} className={inputCls} placeholder="+54 ..." />
          </EditorForm>
        </Modal>
      )}
      {editing === "congregation" && (
        <Modal title="Congregación" onClose={() => setEditing(null)}>
          <EditorForm error={error} saving={saving} onSubmit={() => save({ congregation: draft.trim() })}>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={120} className={inputCls} placeholder="Nombre de la congregación" />
          </EditorForm>
        </Modal>
      )}
      {editing === "baptismDate" && (
        <Modal title="Fecha de bautismo" onClose={() => setEditing(null)}>
          <EditorForm error={error} saving={saving} onSubmit={() => save({ baptismDate: draft })}>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} type="date" className={inputCls} />
          </EditorForm>
        </Modal>
      )}
      {editing === "publisherSince" && (
        <Modal title="Fecha de convertirse en publicador" onClose={() => setEditing(null)}>
          <EditorForm error={error} saving={saving} onSubmit={() => save({ publisherSince: draft })}>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} type="date" className={inputCls} />
          </EditorForm>
        </Modal>
      )}
      {editing === "role" && (
        <Modal title="Soy…" onClose={() => setEditing(null)}>
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (roleDraft) saveRole(roleDraft);
            }}
          >
            {roles.map((r) => {
              const selected = roleDraft === r.id;
              return (
                <label
                  key={r.id}
                  className={`flex min-h-[56px] cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                    selected ? "border-primary bg-primary-soft font-medium" : "border-line bg-surface"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    checked={selected}
                    onChange={() => setRoleDraft(r.id)}
                    className="h-5 w-5 accent-[#C05A2E]"
                  />
                  <span className="flex-1">{r.label}</span>
                </label>
              );
            })}
            {(() => {
              const selectedRole = roles.find((r) => r.id === roleDraft) ?? null;
              if (!selectedRole) return null;
              const monthly = selectedRole.monthlyQuota;
              const changingRole = selectedRole.id !== profile.serviceRoleId;
              return (
                <p className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-muted">
                  {changingRole
                    ? `Al guardar este rol, las metas se establecerán en ${monthly != null ? `${monthly}h mensuales y ${monthly * 12}h anuales` : "sin meta mensual ni anual"}.`
                    : "Tus metas actuales se conservarán porque no cambiaste de rol."} Después podrás editarlas manualmente.
                </p>
              );
            })()}
            {error && (
              <p role="alert" className="rounded-md bg-pale-red px-3 py-2 text-sm text-pale-red-ink">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={saving || !roleDraft}
              className="mt-2 min-h-[48px] rounded-md bg-primary px-4 py-2.5 font-medium text-on-primary transition-transform hover:bg-primary-strong active:scale-[0.98] disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </form>
        </Modal>
      )}
      {editing === "goal" && (
        <Modal title="Meta Personal" onClose={() => setEditing(null)}>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const n = goalDraft.trim() === "" ? null : Number(goalDraft);
              if (n !== null && (!Number.isInteger(n) || n < 0 || n > 300)) {
                setError("Ingresá de 0 a 300 horas.");
                return;
              }
              save({ personalGoalHours: n });
            }}
          >
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border border-line bg-surface p-3">
                <p className="text-muted">Predeterminado</p>
                <p className="text-lg font-medium">{role?.monthlyQuota != null ? `${role.monthlyQuota}h` : "0h"}</p>
              </div>
              <div className="rounded-md border border-line bg-surface p-3">
                <p className="text-muted">Meta Personal</p>
                <p className="text-lg font-medium">{profile.personalGoalHours != null ? `${profile.personalGoalHours}h` : "--"}</p>
              </div>
            </div>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Horas de Meta Personal</span>
              <input
                value={goalDraft}
                onChange={(e) => setGoalDraft(e.target.value)}
                type="number"
                min={0}
                max={300}
                inputMode="numeric"
                className={inputCls}
                placeholder="Horas"
              />
            </label>
            {profile.personalGoalHours == null && suggestedMonthly != null && (
              <p className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-muted">
                Sugerencia según tu condición ({role?.label}): {suggestedMonthly}h. Ya está precargada; podés
                ajustarla o dejarla.
              </p>
            )}
            {error && (
              <p role="alert" className="rounded-md bg-pale-red px-3 py-2 text-sm text-pale-red-ink">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={saving}
              className="min-h-[48px] rounded-md bg-primary px-4 py-2.5 font-medium text-on-primary transition-transform hover:bg-primary-strong active:scale-[0.98] disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
            {profile.personalGoalHours != null && (
              <button
                type="button"
                disabled={saving}
                onClick={() => save({ personalGoalHours: null })}
                className="min-h-[48px] rounded-md border border-line bg-surface px-4 py-2.5 text-sm transition-transform active:scale-[0.98] disabled:opacity-60"
              >
                Quitar mi meta (usar predeterminado)
              </button>
            )}
          </form>
        </Modal>
      )}
      {editing === "annualGoal" && (
        <Modal title="Meta anual" onClose={() => setEditing(null)}>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const n = annualGoalDraft.trim() === "" ? null : Number(annualGoalDraft);
              if (n !== null && (!Number.isInteger(n) || n < 0 || n > 3600)) {
                setError("Ingresá de 0 a 3600 horas.");
                return;
              }
              save({ annualGoalHours: n });
            }}
          >
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border border-line bg-surface p-3">
                <p className="text-muted">Sugerida</p>
                <p className="text-lg font-medium">{suggestedAnnual != null ? `${suggestedAnnual}h` : "--"}</p>
              </div>
              <div className="rounded-md border border-line bg-surface p-3">
                <p className="text-muted">Meta anual</p>
                <p className="text-lg font-medium">{profile.annualGoalHours != null ? `${profile.annualGoalHours}h` : "--"}</p>
              </div>
            </div>
            {suggestedAnnual != null && profile.annualGoalHours == null && (
              <p className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-muted">
                Sugerencia: {suggestedAnnual}h (cuota del rol × 12
                {role?.monthlyQuota == null && profile.personalGoalHours != null ? " o tu meta mensual × 12" : ""}).
                Ya está precargada; podés ajustarla.
              </p>
            )}
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Horas de Meta anual</span>
              <input
                value={annualGoalDraft}
                onChange={(e) => setAnnualGoalDraft(e.target.value)}
                type="number"
                min={0}
                max={3600}
                inputMode="numeric"
                className={inputCls}
                placeholder="Horas"
              />
            </label>
            {error && (
              <p role="alert" className="rounded-md bg-pale-red px-3 py-2 text-sm text-pale-red-ink">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={saving}
              className="min-h-[48px] rounded-md bg-primary px-4 py-2.5 font-medium text-on-primary transition-transform hover:bg-primary-strong active:scale-[0.98] disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
            {profile.annualGoalHours != null && (
              <button
                type="button"
                disabled={saving}
                onClick={() => save({ annualGoalHours: null })}
                className="min-h-[48px] rounded-md border border-line bg-surface px-4 py-2.5 text-sm transition-transform active:scale-[0.98] disabled:opacity-60"
              >
                Quitar mi meta anual
              </button>
            )}
          </form>
        </Modal>
      )}
      {editing === "recipientName" && (
        <Modal title="Destinatario del informe" onClose={() => setEditing(null)}>
          <EditorForm error={error} saving={saving} onSubmit={() => save({ recipientName: draft.trim() })}>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={80} className={inputCls} placeholder="Nombre del secretario / encargado" />
          </EditorForm>
        </Modal>
      )}
      {editing === "recipientPhone" && (
        <Modal title="WhatsApp del destinatario" onClose={() => setEditing(null)}>
          <EditorForm error={error} saving={saving} onSubmit={() => save({ recipientPhone: draft.trim() })}>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} type="tel" maxLength={20} className={inputCls} placeholder="+54 ..." />
          </EditorForm>
        </Modal>
      )}
    </div>
  );
}

function EditorForm({
  error,
  saving,
  onSubmit,
  children,
}: {
  error: string | null;
  saving: boolean;
  onSubmit: () => void;
  children: React.ReactNode;
}) {
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {children}
      {error && (
        <p role="alert" className="rounded-md bg-pale-red px-3 py-2 text-sm text-pale-red-ink">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={saving}
        className="min-h-[48px] rounded-md bg-primary px-4 py-2.5 font-medium text-on-primary transition-transform hover:bg-primary-strong active:scale-[0.98] disabled:opacity-60"
      >
        {saving ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
