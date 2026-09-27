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
    <section className={cn('panel flex min-h-0 flex-col rounded-none border-2 border-base-600 bg-base-850', className)}>
      {(title || actions) && (
        <header className="panel-header shrink-0 border-b-2 border-base-600 bg-base-900 px-4 py-3">
          <div className="flex min-w-0 items-baseline gap-2.5">
            {eyebrow && <span className="eyebrow text-2xs font-bold uppercase tracking-[0.18em] text-swiss-red">{eyebrow}</span>}
            {title && <h2 className="truncate text-xs font-bold uppercase tracking-[0.14em] text-ink-50 font-sans">{title}</h2>}
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
    <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-1.5 border-2 border-dashed border-base-600 bg-base-900/40 px-4 py-8 text-center rounded-none">
      <span className="text-lg leading-none text-swiss-red font-bold">{icon}</span>
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-200">{title}</p>
      {hint && <p className="max-w-xs text-3xs font-mono uppercase tracking-[0.08em] text-ink-400">{hint}</p>}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-0.5 w-full bg-base-600', className)} />;
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
        'flex items-center gap-2 rounded-none border-2 border-dashed border-base-600 bg-base-900/60 px-3.5 py-2.5 text-2xs text-ink-300 font-mono',
        className,
      )}
    >
      <span className="border border-swiss-red bg-swiss-red/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-swiss-red">
        Placeholder
      </span>
      {children}
    </div>
  );
}

