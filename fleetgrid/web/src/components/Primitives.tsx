import type { ReactNode } from 'react';
import { cn, humanizeStatus } from '../lib/format';
import type { Tone } from '../lib/tone';

const TONE_CLASSES: Record<Tone, string> = {
  healthy: 'border-healthy/30 bg-healthy/10 text-healthy',
  warn: 'border-warn/30 bg-warn/10 text-warn',
  danger: 'border-danger/35 bg-danger/12 text-danger',
  accent: 'border-accent/30 bg-accent/10 text-[#8FB4FF]',
  neutral: 'border-base-500 bg-base-750 text-ink-300',
};

const DOT_CLASSES: Record<Tone, string> = {
  healthy: 'bg-healthy',
  warn: 'bg-warn',
  danger: 'bg-danger',
  accent: 'bg-accent',
  neutral: 'bg-ink-500',
};

interface StatusPillProps {
  status: string;
  tone: Tone;
  size?: 'sm' | 'md';
  pulse?: boolean;
  className?: string;
}

/** Compact status indicator. Every value comes from server state. */
export function StatusPill({ status, tone, size = 'sm', pulse = false, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded border font-medium uppercase tracking-[0.08em]',
        size === 'sm' ? 'px-1.5 py-0.5 text-2xs' : 'px-2.5 py-1 text-xs',
        TONE_CLASSES[tone],
        className,
      )}
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        {pulse && <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-70', DOT_CLASSES[tone], 'animate-pulse-ring')} />}
        <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', DOT_CLASSES[tone])} />
      </span>
      {humanizeStatus(status)}
    </span>
  );
}

interface MetricProps {
  label: string;
  value: ReactNode;
  tone?: Tone;
  hint?: string;
  onClick?: () => void;
  active?: boolean;
}

/** Fleet summary counter used across the Control Tower header. */
export function Metric({ label, value, tone = 'neutral', hint, onClick, active = false }: MetricProps) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        'flex min-w-0 flex-col justify-between border-l border-base-600 px-4 py-3 text-left transition-colors first:border-l-0',
        onClick && 'hover:bg-base-750/60',
        active && 'bg-base-750/80',
      )}
    >
      <span className="eyebrow truncate">{label}</span>
      <span
        className={cn(
          'tabular mt-1.5 text-2xl font-semibold leading-none tracking-tight',
          tone === 'healthy' && 'text-healthy',
          tone === 'warn' && 'text-warn',
          tone === 'danger' && 'text-danger',
          tone === 'accent' && 'text-[#8FB4FF]',
          tone === 'neutral' && 'text-ink-50',
        )}
      >
        {value}
      </span>
      {hint && <span className="mt-1 truncate text-2xs text-ink-500">{hint}</span>}
    </Wrapper>
  );
}
