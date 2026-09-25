import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/* ---------- Card ---------- */

export function Card({
  className,
  children,
  pad = "p-4",
}: {
  className?: string;
  children: ReactNode;
  pad?: string;
}) {
  return (
    <section className={cn("rounded-3xl bg-surface shadow-sm ring-1 ring-ink/5", pad, className)}>
      {children}
    </section>
  );
}

/* ---------- Btn ---------- */

export type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
export type BtnSize = "sm" | "md" | "lg";

const BTN_SIZES: Record<BtnSize, string> = {
  sm: "min-h-[44px] px-3 py-2 text-sm",
  md: "min-h-[48px] px-4 py-3 text-sm",
  lg: "min-h-[52px] px-5 py-3.5 text-base",
};

const BTN_VARIANTS: Record<BtnVariant, string> = {
  primary: "bg-primary text-on-primary shadow-sm hover:bg-primary-strong",
  secondary: "bg-surface text-ink ring-1 ring-line hover:bg-canvas",
  ghost: "text-muted hover:bg-primary-soft hover:text-ink",
  danger: "bg-pale-red text-pale-red-ink ring-1 ring-inset ring-pale-red-ink/20 hover:brightness-95",
  success: "bg-pale-green text-pale-green-ink ring-1 ring-inset ring-pale-green-ink/20 hover:brightness-95",
};

export function btn(variant: BtnVariant = "primary", size: BtnSize = "md") {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";
  return cn(base, BTN_SIZES[size], BTN_VARIANTS[variant]);
}

export function Btn({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  size?: BtnSize;
}) {
  return <button {...props} className={cn(btn(variant, size), className)} />;
}

/* ---------- Field ---------- */

export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export const labelClass = "mb-1.5 block text-sm font-medium text-ink";

/* ---------- Badge (pill pastel) ---------- */

const BADGE = {
  blue: "bg-pale-blue text-pale-blue-ink ring-pale-blue-ink/20",
  green: "bg-pale-green text-pale-green-ink ring-pale-green-ink/20",
  amber: "bg-amber-soft text-amber-ink ring-amber-ink/20",
  red: "bg-pale-red text-pale-red-ink ring-pale-red-ink/20",
} as const;

export type BadgeColor = keyof typeof BADGE;

export function Badge({
  color = "blue",
  children,
  className,
}: {
  color?: BadgeColor;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        BADGE[color],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ---------- Input ---------- */

const inputBase =
  "block w-full rounded-2xl border-0 px-4 py-3 text-base text-ink placeholder:text-muted/70 transition focus:ring-2 focus:ring-primary focus:outline-none disabled:opacity-60";

export const inputClass = `${inputBase} min-h-[48px] bg-canvas focus:bg-surface`;

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputClass, className)} />;
}
