import type { ReactNode } from 'react';
import { cn } from '../lib/format';

interface PanelProps {
  title?: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function Panel({ title, eyebrow, actions, children, className, bodyClassName }: PanelProps) {
  return (
    <section className={cn('panel flex min-h-0 flex-col', className)}>
      {(title || actions) && (
        <header className="panel-header shrink-0">
          <div className="flex min-w-0 items-baseline gap-2.5">
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            {title && <h2 className="truncate text-sm font-semibold tracking-tight text-ink-50">{title}</h2>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn('min-h-0 flex-1', bodyClassName ?? 'p-4')}>{children}</div>
    </section>
  );
}

export function EmptyState({ title, hint, icon = '·' }: { title: string; hint?: string; icon?: string }) {
  return (
    <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-1.5 px-4 py-8 text-center">
      <span className="text-lg leading-none text-ink-500">{icon}</span>
      <p className="text-sm font-medium text-ink-300">{title}</p>
      {hint && <p className="max-w-xs text-2xs leading-relaxed text-ink-500">{hint}</p>}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-base-600', className)} />;
}

export function Placeholder({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border border-dashed border-base-500 bg-base-850/60 px-3 py-2.5 text-2xs text-ink-400',
        className,
      )}
    >
      <span className="rounded border border-base-500 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-ink-400">
        Placeholder
      </span>
      {children}
    </div>
  );
}
