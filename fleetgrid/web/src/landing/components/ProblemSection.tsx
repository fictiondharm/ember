import { useEffect, useState } from "react";
import { useInView } from "../hooks/useInView";
import { useReducedMotion } from "../hooks/useMedia";
import { SectionHead, toneBg, toneText, type Tone } from "./ui";

const CHAIN: { time: string; title: string; detail: string; tone: Tone; state: string }[] = [
  { time: "14:31:52", title: "Truck breakdown", detail: "FG-027 stopped near Hosur", tone: "fault", state: "Incident" },
  { time: "14:32:40", title: "Shipment at risk", detail: "Delivery window for SH-2041 slipping", tone: "caution", state: "At risk" },
  { time: "14:36:05", title: "Capacity disappears", detail: "No backup vehicle assigned on the corridor", tone: "caution", state: "Unassigned" },
  { time: "14:44:30", title: "Operations start scrambling", detail: "Calls, spreadsheets and group chats", tone: "fault", state: "Manual" },
];

export default function ProblemSection() {
  const { ref, inView } = useInView<HTMLOListElement>(0.35);
  const reduced = useReducedMotion();
  const [lit, setLit] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setLit(CHAIN.length);
      return;
    }
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setLit(i);
      if (i >= CHAIN.length) window.clearInterval(id);
    }, 520);
    return () => window.clearInterval(id);
  }, [inView, reduced]);

  return (
    <section className="relative border-t border-line-soft py-28 sm:py-36">
      <div className="container-fg">
        <SectionHead title="Logistics doesn't fail quietly.">
          A single disruption can create a chain reaction across drivers, shipments, routes and customers.
        </SectionHead>

        <ol ref={ref} className="mt-16 grid gap-3 md:grid-cols-4 md:gap-8">
          {CHAIN.map((c, i) => {
            const on = lit > i;
            return (
              <li key={c.title} className="relative flex">
                <div
                  className={`relative flex w-full flex-col rounded-lg border bg-raised p-5 transition-all duration-500 ${
                    on ? "border-line opacity-100" : "border-line-soft opacity-40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-faint">{c.time}</span>
                    <span className={`tag flex items-center gap-1.5 ${on ? toneText[c.tone] : "text-faint"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${on ? toneBg[c.tone] : "bg-line"}`} />
                      {c.state}
                    </span>
                  </div>
                  <div className="mt-7 text-[17px] font-medium tracking-tight">{c.title}</div>
                  <div className="mt-1.5 text-[13.5px] leading-snug text-dim">{c.detail}</div>
                  <div className="mt-auto pt-5"><div className="h-[3px] w-full overflow-hidden rounded-full bg-line-soft">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${toneBg[c.tone]}`}
                      style={{ width: on ? `${40 + i * 20}%` : "0%" }}
                    />
                  </div></div>
                </div>
                {i < CHAIN.length - 1 && (
                  <span aria-hidden className="absolute -right-[22px] top-1/2 hidden -translate-y-1/2 font-mono text-[13px] text-faint md:block">
                    →
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        <div className="mt-16 grid gap-6 border-t border-line-soft pt-10 md:grid-cols-2">
          <p className="text-[clamp(1.35rem,2.4vw,1.9rem)] font-medium leading-tight tracking-[-0.02em] text-faint">
            Traditional systems tell teams what happened.
          </p>
          <p className="text-[clamp(1.35rem,2.4vw,1.9rem)] font-medium leading-tight tracking-[-0.02em]">
            FleetGrid is designed to coordinate what happens next.
          </p>
        </div>
      </div>
    </section>
  );
}
