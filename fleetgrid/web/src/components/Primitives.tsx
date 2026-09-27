import type { ReactNode } from 'react';
import { cn, humanizeStatus } from '../lib/format';
import type { Tone } from '../lib/tone';

const TONE_CLASSES: Record<Tone, string> = {
  healthy: 'border-healthy bg-healthy/10 text-healthy',
  warn: 'border-warn bg-warn/10 text-warn',
  danger: 'border-swiss-red bg-swiss-red/10 text-swiss-red font-bold',
  accent: 'border-swiss-red bg-swiss-red/15 text-swiss-red',
  neutral: 'border-base-600 bg-base-800 text-ink-200',
};

const DOT_CLASSES: Record<Tone, string> = {
  healthy: 'bg-healthy',
  warn: 'bg-warn',
  danger: 'bg-swiss-red',
  accent: 'bg-swiss-red',
  neutral: 'bg-ink-400',
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
        'inline-flex items-center gap-1.5 border-2 font-mono font-bold uppercase tracking-[0.12em]',
        size === 'sm' ? 'px-2 py-0.5 text-3xs' : 'px-3 py-1 text-2xs',
        TONE_CLASSES[tone],
        className,
      )}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        {pulse && <span className={cn('absolute inline-flex h-full w-full opacity-70', DOT_CLASSES[tone], 'animate-pulse-ring')} />}
        <span className={cn('relative inline-flex h-2 w-2', DOT_CLASSES[tone])} />
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
        'flex min-w-0 flex-col justify-between border-l-2 border-base-600 px-4 py-3.5 text-left transition-colors first:border-l-0 rounded-none',
        onClick && 'hover:bg-base-750/80 cursor-pointer',
        active && 'bg-base-750 border-b-2 border-b-swiss-red',
      )}
    >
      <span className="eyebrow truncate tracking-[0.18em]">{label}</span>
      <span
        className={cn(
          'tabular mt-2 text-2xl font-black leading-none tracking-tight font-sans',
          tone === 'healthy' && 'text-healthy',
          tone === 'warn' && 'text-warn',
          tone === 'danger' && 'text-swiss-red',
          tone === 'accent' && 'text-swiss-red',
          tone === 'neutral' && 'text-ink-50',
        )}
      >
        {value}
      </span>
      {hint && <span className="mt-1.5 truncate text-3xs font-mono font-medium uppercase tracking-[0.1em] text-ink-400">{hint}</span>}
    </Wrapper>
  );
}

