import { useEffect, useState, useMemo } from "react";
import NetworkVisual from "./NetworkVisual";
import { GoogleMapView } from "../../components/GoogleMapView";
import { Button } from "./ui";
import { useCountUp } from "../hooks/useCountUp";
import { useFleet } from "../../store/FleetContext";

function Stat({ label, target, decimals = 0, suffix = "", live = false, active }: {
  label: string; target?: number; decimals?: number; suffix?: string; live?: boolean; active: boolean;
}) {
  const v = useCountUp(target ?? 0, active, 1600);
  return (
    <div className="bg-raised px-4 py-4 sm:px-6 sm:py-5">
      <div className="tag text-faint">{label}</div>
      <div className="mt-2 flex items-center gap-2.5 font-mono text-[20px] tracking-tight sm:text-[24px]">
        {live ? (
          <>
            <span className="dot-live" aria-hidden />
            <span className="text-signal">LIVE</span>
          </>
        ) : (
          <span className="tabular-nums">
            {v.toFixed(decimals)}
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

export default function Hero() {
  const [ready, setReady] = useState(false);
  const [viewMode, setViewMode] = useState<'MAP' | 'CIRCUIT'>('MAP');
  const { setMode, snapshot } = useFleet();

  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 400);
    return () => window.clearTimeout(id);
  }, []);

  const totalSpareT = useMemo(
    () => snapshot.trucks.reduce((acc, t) => acc + (t.availableT ?? 0), 0),
    [snapshot.trucks],
  );

  const activeShipmentsCount = useMemo(
    () => snapshot.shipments.filter((s) => s.status !== 'DELIVERED').length,
    [snapshot.shipments],
  );

  return (
    <section id="top" className="relative overflow-hidden pt-28 sm:pt-36">
      <div aria-hidden className="grid-bg pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_70%_55%_at_50%_0%,black,transparent)]" />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full opacity-[0.07] blur-3xl"
        style={{ background: "radial-gradient(closest-side, var(--color-signal), transparent)" }}
      />

      <div className="container-fg relative">
        <p className="tag flex items-center gap-2.5 text-dim">
          <span className="h-px w-6 bg-signal" aria-hidden />
          Autonomous Logistics Infrastructure
        </p>

        <div className="mt-6 grid gap-10 lg:grid-cols-12 lg:items-end">
          <h1 className="display text-[clamp(2.75rem,7vw,6rem)] lg:col-span-8">
            Logistics that
            <br />
            can recover itself.
          </h1>
          <div className="lg:col-span-4 lg:pb-3">
            <p className="text-[16px] leading-relaxed text-dim [text-wrap:pretty]">
              FleetGrid unifies real-time telematics, carrier capacity, and automated rerouting onto an authoritative state engine. When highway blockades or mechanical failures occur, the network heals automatically.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button onClick={() => void setMode('CONTROL_TOWER')}>Enter Control Tower</Button>
              <Button onClick={() => void setMode('LIVE_MAP')} variant="ghost">
                🗺️ Fullscreen Google Map
              </Button>
            </div>
          </div>
        </div>

        {/* Showcase with View Switcher */}
        <div className="relative mt-12 overflow-hidden rounded-xl border border-line bg-raised shadow-[0_40px_120px_-40px_rgba(0,0,0,0.85)] sm:mt-16">
          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between border-b border-line bg-base-950/70 px-4 py-3 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-signal animate-pulse" />
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-fg">
                  Bengaluru — Chennai Highway Corridor (NH-48)
                </span>
              </div>
              <span className="hidden font-mono text-2xs text-faint sm:inline">
                | GPS Telemetry Frequency: 2.5s
              </span>
            </div>

            {/* Mode Switcher */}
            <div className="flex items-center gap-1 rounded-lg border border-line bg-base p-1 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('MAP')}
                className={`rounded px-3 py-1 font-mono text-[11px] font-medium transition-all ${
                  viewMode === 'MAP'
                    ? 'bg-signal text-base-950 font-bold shadow-sm'
                    : 'text-dim hover:text-fg'
                }`}
              >
                🗺️ Google Maps Live Engine
              </button>
              <button
                type="button"
                onClick={() => setViewMode('CIRCUIT')}
                className={`rounded px-3 py-1 font-mono text-[11px] font-medium transition-all ${
                  viewMode === 'CIRCUIT'
                    ? 'bg-signal text-base-950 font-bold shadow-sm'
                    : 'text-dim hover:text-fg'
                }`}
              >
                ⚡ Neural Topology Flow
              </button>
            </div>
          </div>

          {/* Interactive Visual Canvas */}
          <div className="relative">
            {viewMode === 'MAP' ? (
              <div className="h-[480px] w-full bg-base-950 sm:h-[540px]">
                <GoogleMapView
                  trucks={snapshot.trucks}
                  height="100%"
                  showRerouteDetour={true}
                />
              </div>
            ) : (
              <NetworkVisual className="aspect-[1/1.02] sm:aspect-[1.72/1]" />
            )}
          </div>

          {/* Real-time Authoritative Network Stats */}
          <div className="grid grid-cols-2 gap-px border-t border-line bg-line md:grid-cols-4">
            <Stat label="Corridor State" live active={ready} />
            <Stat label="Active Vehicles" target={snapshot.trucks.length || 24} active={ready} />
            <Stat label="Available Capacity" target={totalSpareT || 42.6} decimals={1} suffix="T" active={ready} />
            <Stat label="Active Shipments" target={activeShipmentsCount || 8} active={ready} />
          </div>
        </div>
        <p className="mt-3 font-mono text-[11px] text-faint">
          Authoritative national freight corridor telematics. Live GPS stream connected to FleetGrid Autonomous State Engine.
        </p>
      </div>
    </section>
  );
}
