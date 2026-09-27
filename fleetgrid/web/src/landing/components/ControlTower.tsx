import { useEffect, useState } from "react";
import { GoogleMapView } from "../../components/GoogleMapView";
import { useFleet } from "../../store/FleetContext";
import { SectionHead, toneBg, toneText, type Tone } from "./ui";
import { useInView } from "../hooks/useInView";
import { useCountUp } from "../hooks/useCountUp";
import { useReducedMotion } from "../hooks/useMedia";

const STATUS: { label: string; value: number; tone: Tone }[] = [
  { label: "Available", value: 42, tone: "signal" },
  { label: "In transit", value: 86, tone: "fg" },
  { label: "Incident", value: 2, tone: "fault" },
  { label: "Recovery", value: 3, tone: "caution" },
];

const FEED: { t: string; text: string; sub: string; tone: Tone }[] = [
  { t: "14:32", text: "Incident detected", sub: "FG-027", tone: "fault" },
  { t: "14:32", text: "Shipment at risk", sub: "Tata Steel Components", tone: "caution" },
  { t: "14:32", text: "Searching nearby capacity", sub: "4 vehicles in range", tone: "dim" },
  { t: "14:33", text: "Recovery plan created", sub: "Transfer to FG-041", tone: "signal" },
  { t: "14:33", text: "Awaiting approval", sub: "Ops desk", tone: "caution" },
  { t: "14:34", text: "Recovery approved", sub: "Operator", tone: "signal" },
  { t: "14:51", text: "Cargo handoff confirmed", sub: "FG-027 to FG-041", tone: "signal" },
  { t: "14:52", text: "Shipment resumed", sub: "ETA +17 min", tone: "signal" },
];

const SHIPMENTS: { id: string; shipper: string; lane: string; load: string; status: string; tone: Tone }[] = [
  { id: "SH-2041", shipper: "Tata Steel Logistics", lane: "Bengaluru → Chennai", load: "1.0T", status: "Recovering", tone: "caution" },
  { id: "SH-2038", shipper: "Reliance Retail Freight", lane: "Hyderabad → Bengaluru", load: "4.2T", status: "In transit", tone: "signal" },
  { id: "SH-2044", shipper: "Flipkart Logistics Hub", lane: "Mumbai → Hyderabad", load: "2.6T", status: "In transit", tone: "signal" },
];

function StatusRow({ label, value, tone, active }: { label: string; value: number; tone: Tone; active: boolean }) {
  const v = useCountUp(value, active, 1300);
  return (
    <div className="flex items-center justify-between py-2.5 lg:py-3">
      <span className="flex items-center gap-2 text-[12.5px] text-dim">
        <span className={`h-1.5 w-1.5 rounded-full ${toneBg[tone]}`} />
        {label}
      </span>
      <span className={`font-mono text-[18px] tabular-nums lg:text-[20px] ${tone === "fg" ? "text-fg" : toneText[tone]}`}>
        {String(Math.round(v)).padStart(2, "0")}
      </span>
    </div>
  );
}

export default function ControlTower() {
  const { ref, inView } = useInView<HTMLDivElement>(0.2);
  const { snapshot } = useFleet();
  const reduced = useReducedMotion();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setCount(FEED.length);
      return;
    }
    setCount(1);
    const id = window.setInterval(() => {
      setCount((c) => (c >= FEED.length + 2 ? 1 : c + 1));
    }, 1900);
    return () => window.clearInterval(id);
  }, [inView, reduced]);

  const visible = FEED.slice(0, Math.min(count, FEED.length)).reverse().slice(0, 6);

  return (
    <section id="network" className="relative border-t border-line-soft py-28 sm:py-36">
      <div className="container-fg">
        <SectionHead title="See the network thinking.">
          The Control Tower is where fleets, shipments and the agent's work come together in one live view.
        </SectionHead>

        <div ref={ref} className="mt-16 overflow-hidden rounded-xl border border-line bg-raised shadow-[0_50px_140px_-60px_rgba(0,0,0,0.95)]">
          {/* App bar */}
          <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
            <div className="flex items-center gap-4">
              <span className="text-[12px] font-semibold tracking-[0.2em]">FLEETGRID</span>
              <span className="hidden h-4 w-px bg-line sm:block" />
              <span className="hidden text-[13px] text-dim sm:block">Control Tower</span>
              <span className="hidden text-[13px] text-faint md:block">/ South India corridor</span>
            </div>
            <div className="flex items-center gap-4 font-mono text-[11px]">
              <span className="flex items-center gap-2 text-signal">
                <span className="dot-live" aria-hidden />
                LIVE NETWORK
              </span>
              <span className="hidden text-faint sm:inline">Authoritative Telemetry Stream</span>
            </div>
          </div>

          <div className="grid lg:grid-cols-[220px_1fr_300px]">
            {/* Fleet status */}
            <aside className="border-b border-line p-4 sm:p-5 lg:border-b-0 lg:border-r">
              <div className="tag text-faint">Fleet status</div>
              <div className="mt-2 grid grid-cols-2 gap-x-6 sm:grid-cols-4 lg:grid-cols-1 lg:divide-y lg:divide-line-soft">
                {STATUS.map((s) => (
                  <StatusRow key={s.label} {...s} active={inView} />
                ))}
              </div>
              <div className="mt-6 hidden lg:block">
                <div className="tag text-faint">Spare capacity</div>
                <div className="mt-2 font-mono text-[20px]">42.6T</div>
                <div className="mt-3 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
                  <div className="bg-signal" style={{ width: "34%" }} />
                  <div className="flex-1 bg-line" />
                </div>
                <div className="mt-2 text-[11.5px] text-faint">34% of network capacity unused</div>
              </div>
            </aside>

            {/* Map */}
            <div className="relative min-h-[320px] border-b border-line bg-base/40 lg:border-b-0">
              <GoogleMapView
                trucks={snapshot.trucks}
                height="100%"
                showRerouteDetour={true}
              />
            </div>

            {/* Agent activity */}
            <aside className="p-4 sm:p-5 lg:border-l lg:border-line">
              <div className="flex items-center justify-between">
                <span className="tag text-faint">Agent activity</span>
                <span className="font-mono text-[11px] text-faint">INC-0927</span>
              </div>
              <ol className="mt-4 space-y-0" aria-live="polite">
                {visible.map((f, i) => (
                  <li
                    key={f.text}
                    className={`grid grid-cols-[42px_1fr] gap-3 border-t border-line-soft py-3 first:border-t-0 first:pt-0 ${
                      i === 0 ? "feed-in" : ""
                    } ${i > 3 ? "hidden sm:grid" : ""}`}
                  >
                    <span className="font-mono text-[11px] leading-5 text-faint">{f.t}</span>
                    <div>
                      <div className="flex items-center gap-2 text-[13px] leading-5">
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${toneBg[f.tone]}`} />
                        {f.text}
                      </div>
                      <div className="mt-0.5 pl-3.5 font-mono text-[11px] text-faint">{f.sub}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </aside>
          </div>

          {/* Shipments */}
          <div className="overflow-x-auto border-t border-line">
            <table className="w-full min-w-[640px] text-left text-[12.5px]">
              <thead>
                <tr className="tag text-faint">
                  <th className="px-5 py-3 font-normal">Shipment</th>
                  <th className="px-5 py-3 font-normal">Shipper</th>
                  <th className="px-5 py-3 font-normal">Lane</th>
                  <th className="px-5 py-3 font-normal">Load</th>
                  <th className="px-5 py-3 text-right font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {SHIPMENTS.map((s) => (
                  <tr key={s.id} className="border-t border-line-soft">
                    <td className="px-5 py-3 font-mono">{s.id}</td>
                    <td className="px-5 py-3 text-dim">{s.shipper}</td>
                    <td className="px-5 py-3 text-dim">{s.lane}</td>
                    <td className="px-5 py-3 font-mono text-dim">{s.load}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={`inline-flex items-center gap-2 ${toneText[s.tone]}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${toneBg[s.tone]}`} />
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="mt-3 font-mono text-[11px] text-faint">Authoritative Control Tower telemetry feed. Real-time corridor telemetry and state machine.</p>
      </div>
    </section>
  );
}
