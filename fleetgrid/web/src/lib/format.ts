/** Tiny class-name joiner. No tailwind-merge dependency needed at this size. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function formatT(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${Number(value).toFixed(1)}T`;
}

export function formatMoney(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.round(diff / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Converts an event type such as `shipment.capacity_reserved` into readable text. */
export function humanizeEventType(eventType: string): string {
  const tail = eventType.includes('.') ? eventType.split('.').slice(1).join(' ') : eventType;
  return tail.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function humanizeStatus(status: string): string {
  return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
