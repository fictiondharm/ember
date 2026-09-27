import type { ReactNode } from "react";
import { useInView } from "../hooks/useInView";

type BtnProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "ghost";
  className?: string;
};

export function Button({ href, children, variant = "primary", className = "" }: BtnProps) {
  const base =
    "inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md text-[13px] font-medium uppercase tracking-[0.06em] transition-colors duration-200 whitespace-nowrap";
  const styles =
    variant === "primary"
      ? "bg-fg text-base hover:bg-white shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_8px_24px_-8px_rgba(59,227,155,0.25)]"
      : "border border-line text-fg hover:border-faint hover:bg-raised";
  return (
    <a href={href} className={`${base} ${styles} ${className}`}>
      {children}
    </a>
  );
}

/** Section heading that reveals once on scroll. */
export function SectionHead({ title, children, className = "", size = "lg" }: { title: ReactNode; children?: ReactNode; className?: string; size?: "lg" | "md" }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  return (
    <div ref={ref} className={`reveal ${inView ? "is-in" : ""} ${className}`}>
      <h2 className={size === "md" ? "h2 !text-[clamp(2.1rem,3.4vw,3.05rem)]" : "h2"}>{title}</h2>
      {children && <div className="lede mt-5">{children}</div>}
    </div>
  );
}

export type Tone = "signal" | "caution" | "fault" | "dim" | "fg";
export const toneText: Record<Tone, string> = {
  signal: "text-signal",
  caution: "text-caution",
  fault: "text-fault",
  dim: "text-dim",
  fg: "text-fg",
};
export const toneBg: Record<Tone, string> = {
  signal: "bg-signal",
  caution: "bg-caution",
  fault: "bg-fault",
  dim: "bg-faint",
  fg: "bg-fg",
};

export function Logo({ className = "" }: { className?: string }) {
  return (
    <a href="/" className={`flex items-center gap-2.5 ${className}`} aria-label="FleetGrid home">
      <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden>
        <path d="M6 23 L16 8 L26 21" fill="none" stroke="var(--color-route)" strokeWidth="2.2" />
        <path d="M6 23 L26 21" fill="none" stroke="var(--color-signal)" strokeWidth="2.2" />
        <circle cx="6" cy="23" r="3" fill="var(--color-fg)" />
        <circle cx="16" cy="8" r="3" fill="var(--color-fg)" />
        <circle cx="26" cy="21" r="3" fill="var(--color-signal)" />
      </svg>
      <span className="text-[14px] font-semibold tracking-[0.22em]">FLEETGRID</span>
    </a>
  );
}
