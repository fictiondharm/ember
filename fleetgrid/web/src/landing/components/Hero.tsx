import { useEffect, useState } from "react";
import NetworkVisual from "./NetworkVisual";
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
      <div className="mt-2 flex items-center gap-2.5 font-mono text-[22px] tracking-tight sm:text-[26px]">
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
  const { setMode } = useFleet();
  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 400);
    return () => window.clearTimeout(id);
  }, []);

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
          AI logistics infrastructure
        </p>

        <div className="mt-6 grid gap-10 lg:grid-cols-12 lg:items-end">
          <h1 className="display text-[clamp(3rem,7.2vw,6.25rem)] lg:col-span-8">
            Logistics that
            <br />
            can recover itself.
          </h1>
          <div className="lg:col-span-4 lg:pb-3">
            <p className="text-[16.5px] leading-relaxed text-dim [text-wrap:pretty]">
              FleetGrid connects transport capacity, shipments and intelligent operations into one network, so when
              logistics breaks, the network can respond.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button onClick={() => void setMode('CONTROL_TOWER')}>Enter FleetGrid</Button>
              <Button href="#product" variant="ghost">
                See how it works ↓
              </Button>
            </div>
          </div>
        </div>

        <div className="relative mt-14 overflow-hidden rounded-xl border border-line bg-raised shadow-[0_40px_120px_-40px_rgba(0,0,0,0.8)] sm:mt-20">
          <NetworkVisual className="aspect-[1/1.02] sm:aspect-[1.72/1]" />
          <div className="grid grid-cols-2 gap-px border-t border-line bg-line md:grid-cols-4">
            <Stat label="Network status" live active={ready} />
            <Stat label="Active vehicles" target={128} active={ready} />
            <Stat label="Available capacity" target={42.6} decimals={1} suffix="T" active={ready} />
            <Stat label="Shipments moving" target={317} active={ready} />
          </div>
        </div>
        <p className="mt-3 text-[12px] text-faint">Product visualization with illustrative demo data. Routes are abstract, not to scale.</p>
      </div>
    </section>
  );
}
