import { useState } from 'react';
import { api, ApiError } from '../lib/api';
import { cn, formatMoney, formatRelative, formatT } from '../lib/format';
import { incidentTone, incidentTypeLabel, planTone } from '../lib/tone';
import { StatusPill } from './Primitives';
import { EmptyState, Placeholder } from './Panel';
import type { Incident, RecoveryOption, RecoveryPlan, Shipment, Truck } from '../lib/types';
import { flashClassFor, type FlashKind } from '../lib/flash';

interface IncidentPanelProps {
  incidents: Incident[];
  shipments: Shipment[];
  trucks: Truck[];
  plans: RecoveryPlan[];
  operatorId: string;
  flashIds: string[];
  flashTone: FlashKind;
  onAction: () => void;
}

const LIVE_INCIDENT_STATES = new Set(['OPEN', 'ANALYZING', 'PLAN_READY', 'ESCALATED']);

/**
 * INCIDENTS panel.
 *
 * An open incident is the loudest thing on the Control Tower. ANALYZE RECOVERY
 * generates deterministic options from backend state and parks the plan in
 * PENDING_APPROVAL — the approval gate cannot be bypassed.
 */
export function IncidentPanel({ incidents, shipments, trucks, plans, operatorId, flashIds, flashTone, onAction }: IncidentPanelProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<RecoveryPlan | null>(null);
  const [options, setOptions] = useState<RecoveryOption[]>([]);
  const [verification, setVerification] = useState<Record<string, string | number> | null>(null);

  const live = incidents
    .filter((i) => LIVE_INCIDENT_STATES.has(i.status))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const primary = live[0] ?? null;
  // Executing a plan resolves the incident, which would otherwise blank this panel
  // and hide the receipt. Fall back to the newest incident that has a plan so the
  // operator keeps seeing the outcome, and read the plan from the server snapshot
  // so a page reload still shows it.
  const settled = [...incidents]
    .filter((i) => i.recoveryPlanId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  const anchor = primary ?? settled ?? null;
  const localPlan = plan && anchor && plan.incidentId === anchor.id ? plan : null;
  const planForIncident = localPlan ?? plans.find((p) => p.incidentId === anchor?.id) ?? null;
  const shownOptions = options.length > 0 ? options : (planForIncident?.options ?? []);

  async function analyze() {
    if (!primary) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.createRecoveryPlan(primary.id);
      setPlan(res.plan);
      setOptions(res.options);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!planForIncident) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.approvePlan(planForIncident.id, operatorId);
      setPlan(res.plan);
      onAction();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function execute() {
    if (!planForIncident) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.executePlan(planForIncident.id, operatorId);
      setPlan(res.plan);
      setVerification(res.verification);
      onAction();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!anchor) {
    return (
      <EmptyState
        title="No active incidents"
        hint="When a driver reports a breakdown it appears here instantly on every connected device."
        icon="◎"
      />
    );
  }

  const truck = trucks.find((t) => t.id === anchor.truckId);
  const affected = shipments.filter((s) => anchor.affectedShipmentIds.includes(s.id));
  const compatible = shownOptions.filter((o) => o.compatible);
  const rejected = shownOptions.filter((o) => !o.compatible);
  const resolved = primary === null;

  return (
    <div className="space-y-3">
      <article
        className={cn(
          'relative overflow-hidden rounded-lg border p-3.5',
          resolved ? 'border-healthy/35 bg-healthy/[0.05]' : 'border-danger/45 bg-danger/[0.07] shadow-incident',
        )}
      >
        <div
          className={cn(
            'absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent',
            resolved ? 'via-healthy/60' : 'via-danger/70',
          )}
        />
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              {resolved ? (
                <span className="h-2 w-2 rounded-full bg-healthy" />
              ) : (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-danger opacity-75 animate-pulse-ring" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-danger" />
                </span>
              )}
              <span
                className={cn(
                  'text-2xs font-semibold uppercase tracking-[0.18em]',
                  resolved ? 'text-healthy' : 'text-danger',
                )}
              >
                {resolved ? 'Incident Resolved' : 'Incident Detected'}
              </span>
            </div>
            <div className="mt-2 font-mono text-lg font-semibold tracking-tight text-ink-50">{anchor.truckId}</div>
            <div className="mt-0.5 text-sm text-ink-200">
              {incidentTypeLabel[anchor.type] ?? anchor.type}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <StatusPill status={anchor.status} tone={incidentTone(anchor.status)} pulse={!resolved} />
            <span className="font-mono text-[10px] text-ink-500">{anchor.id}</span>
          </div>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <Row label="Location" value={anchor.location} />
          <Row label="Severity" value={anchor.severity} />
          <Row label="Reported" value={formatRelative(anchor.createdAt)} />
          <Row label="Source" value={anchor.source.replace('_', ' ')} />
        </dl>

        <p className="mt-3 border-l-2 border-danger/40 pl-2.5 text-xs leading-relaxed text-ink-300">
          “{anchor.transcript}”
        </p>

        {affected.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <div className="eyebrow">Affected shipment{affected.length > 1 ? 's' : ''}</div>
            {affected.map((s) => (
              <div
                key={s.id}
                className={cn(
                  'flex items-center justify-between gap-2 rounded border border-base-600 bg-base-900/70 px-2.5 py-2',
                  flashClassFor(flashTone, s.id, flashIds),
                )}
              >
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-ink-50">{s.cargoName}</div>
                  <div className="mt-0.5 text-[10px] text-ink-400">
                    {formatT(s.weightT)} · {s.origin} → {s.destination} ·{' '}
                    <span className="font-mono">{s.id}</span>
                  </div>
                </div>
                <StatusPill status={s.status} tone="danger" pulse={s.status === 'AT_RISK'} />
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2 text-[10px] text-ink-500">
          <span>Truck state</span>
          <StatusPill status={truck?.status ?? 'UNKNOWN'} tone="danger" />
          <span className="text-ink-600">·</span>
          <span className="tabular">{formatT(truck?.availableT ?? 0)} still free on {anchor.truckId}</span>
        </div>

        {primary && !planForIncident && (
          <button type="button" className="btn-primary mt-3.5 w-full" onClick={analyze} disabled={busy}>
            {busy ? 'Analyzing…' : 'Analyze Recovery'}
          </button>
        )}
      </article>

      {error && (
        <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</div>
      )}

      {planForIncident && (
        <div
          className={cn(
            'rounded-lg border p-3.5',
            planForIncident.status === 'COMPLETED'
              ? 'border-healthy/35 bg-healthy/[0.05]'
              : 'border-warn/35 bg-warn/[0.05]',
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                'text-2xs font-semibold uppercase tracking-[0.18em]',
                planForIncident.status === 'COMPLETED' ? 'text-healthy' : 'text-warn',
              )}
            >
              {planForIncident.status === 'COMPLETED' ? 'Recovery Completed' : 'Recovery Engine Ready'}
            </span>
            <StatusPill status={planForIncident.status} tone={planTone(planForIncident.status)} />
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-400">
            {compatible.length} compatible truck{compatible.length === 1 ? '' : 's'} found by the backend read tools.
            Option generation is <span className="text-ink-200">deterministic</span> — the LLM reasoning layer lands in
            phase 2. Distances and ETAs are demo estimates.
          </p>

          <div className="mt-3 space-y-1.5">
            {shownOptions.map((option) => (
              <div
                key={option.truckId}
                className={cn(
                  'rounded border px-2.5 py-2',
                  option.truckId === planForIncident.selectedTruckId
                    ? 'border-healthy/40 bg-healthy/[0.07]'
                    : option.compatible
                      ? 'border-base-600 bg-base-900/60'
                      : 'border-base-700 bg-base-900/30 opacity-60',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-ink-50">{option.truckId}</span>
                    {option.truckId === planForIncident.selectedTruckId && (
                      <span className="rounded border border-healthy/40 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-healthy">
                        Selected
                      </span>
                    )}
                  </div>
                  {option.compatible ? (
                    <span className="tabular text-[11px] text-ink-200">{formatMoney(option.cost, option.currency)}</span>
                  ) : (
                    <span className="text-[9px] uppercase tracking-[0.1em] text-ink-500">Incompatible</span>
                  )}
                </div>
                {option.compatible ? (
                  <div className="tabular mt-1 flex flex-wrap gap-x-3 text-[10px] text-ink-400">
                    <span>{formatT(option.availableT)} spare</span>
                    <span>{option.distanceKm} km away</span>
                    <span>{option.etaMinutes} min ETA</span>
                  </div>
                ) : (
                  <div className="mt-1 text-[10px] text-ink-500">{option.reason}</div>
                )}
              </div>
            ))}
            {rejected.length === 0 && shownOptions.length === 0 && (
              <div className="text-2xs text-ink-500">No options returned.</div>
            )}
          </div>

          <dl className="tabular mt-3 grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded border border-base-600 bg-base-900/60 px-2.5 py-1.5">
              <dt className="eyebrow">Recovery cost</dt>
              <dd className="mt-0.5 text-ink-50">{formatMoney(planForIncident.cost)}</dd>
            </div>
            <div className="rounded border border-base-600 bg-base-900/60 px-2.5 py-1.5">
              <dt className="eyebrow">ETA impact</dt>
              <dd className="mt-0.5 text-ink-50">+{planForIncident.etaDeltaMinutes} min</dd>
            </div>
          </dl>

          {planForIncident.status === 'COMPLETED' && (
            <div className="mt-2 rounded border border-healthy/30 bg-healthy/[0.06] px-2.5 py-2 text-[11px] text-healthy">
              <div className="font-semibold uppercase tracking-[0.14em]">
                {verification ? 'Verified backend state after execution' : 'Recorded on server'}
              </div>
              <div className="tabular mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-ink-300">
                {verification
                  ? Object.entries(verification).map(([key, value]) => (
                      <div key={key} className="flex justify-between gap-2">
                        <span className="text-ink-500">{key}</span>
                        <span>{String(value)}</span>
                      </div>
                    ))
                  : [
                      ['shipment', planForIncident.affectedShipmentIds.join(', ') || '—'],
                      ['reassigned to', planForIncident.selectedTruckId ?? '—'],
                      ['approved by', planForIncident.approvedBy ?? '—'],
                    ].map(([key, value]) => (
                      <div key={key} className="flex justify-between gap-2">
                        <span className="text-ink-500">{key}</span>
                        <span>{String(value)}</span>
                      </div>
                    ))}
              </div>
            </div>
          )}

          <div className="mt-3 flex gap-2">
            {primary && planForIncident.status === 'PENDING_APPROVAL' && (
              <button type="button" className="btn-primary flex-1" onClick={approve} disabled={busy}>
                {busy ? 'Approving…' : 'Approve Recovery'}
              </button>
            )}
            {primary && planForIncident.status === 'APPROVED' && (
              <button type="button" className="btn-primary flex-1" onClick={execute} disabled={busy}>
                {busy ? 'Executing…' : 'Execute Recovery'}
              </button>
            )}
            {planForIncident.status === 'COMPLETED' && (
              <div className="flex-1 rounded-md border border-healthy/35 bg-healthy/10 px-3 py-2 text-center text-xs font-medium text-healthy">
                Recovery executed — cargo reassigned on server
              </div>
            )}
          </div>

          <div className="mt-2.5">
            <Placeholder>
              Payment capture, driver notification delivery and blockchain proof anchoring are phase-2 integrations.
              Notifications are stored as PENDING, never marked delivered.
            </Placeholder>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-0.5 text-xs text-ink-100">{value}</dd>
    </div>
  );
}
