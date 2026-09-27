import { useEffect, useState, type ReactNode } from "react";
import { useInView } from "../hooks/useInView";
import { useReducedMotion } from "../hooks/useMedia";
import { SectionHead, toneBg, toneText, type Tone } from "./ui";

type Block = { time: string; title: string; tone: Tone; body?: ReactNode };

function KV({ items }: { items: [string, string][] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-7 gap-y-1.5">
      {items.map(([k, v]) => (
        <div key={k}>
          <span className="text-faint">{k} </span>
          <span className="text-fg">{v}</span>
        </div>
      ))}
    </div>
  );
}

const CANDIDATES = [
  { id: "FG-041", spare: "3.1T", dist: "8.2 km", eta: "17 min", pick: true },
  { id: "FG-052", spare: "5.0T", dist: "15.8 km", eta: "26 min", pick: false },
];

const BLOCKS: Block[] = [
  {
    time: "14:32:08",
    title: "Incident detected",
    tone: "fault",
    body: <KV items={[["vehicle", "FG-027"], ["event", "Truck breakdown"], ["location", "Hosur"]]} />,
  },
  {
    time: "14:32:10",
    title: "Identifying affected shipments",
    tone: "caution",
    body: <KV items={[["shipments", "1"], ["load", "1.0T"], ["lane", "Bengaluru → Chennai"]]} />,
  },
  {
    time: "14:32:11",
    title: "Searching network capacity",
    tone: "dim",
    body: (
      <div className="mt-2.5 overflow-hidden rounded-md border border-line-soft">
        <div className="grid grid-cols-[1.3fr_1fr_1.2fr_1fr] bg-base/60 px-3 py-1.5 text-faint">
          <span>vehicle</span>
          <span>spare</span>
          <span>distance</span>
          <span className="text-right">eta</span>
        </div>
        {CANDIDATES.map((c) => (
          <div
            key={c.id}
            className={`grid grid-cols-[1.3fr_1fr_1.2fr_1fr] whitespace-nowrap border-t border-line-soft px-3 py-2 ${c.pick ? "text-fg" : "text-dim"}`}
          >
            <span className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${c.pick ? "bg-signal" : "bg-line"}`} />
              {c.id}
            </span>
            <span>{c.spare}</span>
            <span>{c.dist}</span>
            <span className="text-right">{c.eta}</span>
          </div>
        ))}
      </div>
    ),
  },
  { time: "14:32:13", title: "Recovery plan ready", tone: "signal" },
];

const AFTER: Block[] = [
  { time: "14:32:19", title: "Approved by operator", tone: "signal", body: <KV items={[["by", "Ops desk"], ["plan", "Transfer to FG-041"]]} /> },
  { time: "14:32:20", title: "Executing", tone: "signal", body: <KV items={[["FG-041", "Dispatched to handoff point"], ["customer ETA", "Updated +17 min"]]} /> },
];

function Line({ b }: { b: Block }) {
  return (
    <div className="feed-in grid grid-cols-1 gap-1 sm:grid-cols-[76px_1fr] sm:gap-5">
      <span className="text-[11px] text-faint sm:text-[inherit]">{b.time}</span>
      <div>
        <div className={`flex items-center gap-2 uppercase tracking-[0.06em] ${toneText[b.tone]}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${toneBg[b.tone]}`} />
          {b.title}
        </div>
        {b.body}
      </div>
    </div>
  );
}

const PRINCIPLE = [
  { k: "Recommendation", v: "The agent assembles the facts and proposes a plan with its reasoning." },
  { k: "Human approval", v: "An operator reviews and approves. Nothing moves on the agent's say-so alone." },
  { k: "Execution", v: "Once approved, FleetGrid coordinates dispatch, updates and records." },
];

export default function AgentSection() {
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(0);
  const [approved, setApproved] = useState(false);
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setShown(BLOCKS.length);
      return;
    }
    setShown(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown(i);
      if (i >= BLOCKS.length) window.clearInterval(id);
    }, 750);
    return () => window.clearInterval(id);
  }, [inView, reduced, run]);

  const planReady = shown >= BLOCKS.length;
  const replay = () => {
    setApproved(false);
    setRun((r) => r + 1);
  };

  return (
    <section id="how-it-works" className="relative border-t border-line-soft py-28 sm:py-36">
      <div className="container-fg grid gap-14 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-5 xl:col-span-4">
          <SectionHead
            size="md"
            title={
              <>
                An operational agent,
                <br />
                not another chatbot.
              </>
            }
          >
            FleetGrid's agent works on live network state: vehicles, loads, distances and delivery windows. It
            recommends. People decide.
          </SectionHead>

          <ol className="mt-12 space-y-0">
            {PRINCIPLE.map((p, i) => (
              <li key={p.k} className="relative grid grid-cols-[28px_1fr] gap-4 pb-7 last:pb-0">
                {i < PRINCIPLE.length - 1 && <span aria-hidden className="absolute left-[13px] top-7 h-[calc(100%-24px)] w-px bg-line" />}
                <span
                  className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border font-mono text-[11px] ${
                    i === 1 ? "border-signal/50 text-signal" : "border-line text-dim"
                  }`}
                >
                  {i + 1}
                </span>
                <div>
                  <div className="text-[15px] font-medium">{p.k}</div>
                  <div className="mt-1 text-[14px] leading-relaxed text-dim">{p.v}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div ref={ref} className="lg:col-span-7 xl:col-span-8">
          <div className="overflow-hidden rounded-xl border border-line bg-raised shadow-[0_40px_120px_-50px_rgba(0,0,0,0.9)]">
            <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
              <div className="flex items-center gap-3">
                <span className="text-[13px] font-semibold tracking-[0.16em]">FLEETGRID AGENT</span>
                <span className="tag hidden rounded border border-line px-1.5 py-0.5 text-faint sm:inline">Incident mode</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px] text-dim">
                <span className="dot-live" aria-hidden />
                South corridor
              </div>
            </div>

            <div className="min-h-[520px] space-y-6 p-4 font-mono text-[12px] leading-relaxed sm:p-6 sm:text-[13px]" aria-live="polite">
              {BLOCKS.slice(0, shown).map((b) => (
                <Line key={`${run}-${b.time}-${b.title}`} b={b} />
              ))}

              {planReady && (
                <div className="feed-in ml-0 rounded-lg border border-signal/30 bg-signal/[0.04] p-4 sm:ml-[96px] sm:p-5">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <div className="text-faint">plan</div>
                      <div className="mt-1 text-[15px] font-medium text-fg sm:text-[17px]">TRANSFER TO FG-041</div>
                    </div>
                    <div className="text-right">
                      <div className="text-faint">eta impact</div>
                      <div className="mt-1 text-[15px] font-medium text-caution sm:text-[17px]">+17 MIN</div>
                    </div>
                  </div>
                  <p className="mt-3 border-t border-line-soft pt-3 text-dim">
                    Closest compatible capacity. Fits 1.0T with 2.1T to spare. FG-052 has more space but adds 9 minutes.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => setApproved(true)}
                      disabled={approved}
                      className={`inline-flex h-10 items-center gap-2 rounded-md px-4 text-[12px] font-medium uppercase tracking-[0.08em] transition-colors ${
                        approved
                          ? "cursor-default border border-signal/40 text-signal"
                          : "bg-signal text-base hover:brightness-110"
                      }`}
                    >
                      {approved ? "✓ Recovery approved" : "Approve recovery"}
                    </button>
                    {!approved && <span className="text-faint">Awaiting human approval</span>}
                    {approved && (
                      <button onClick={replay} className="text-faint underline-offset-4 hover:text-fg hover:underline">
                        Replay incident
                      </button>
                    )}
                  </div>
                </div>
              )}

              {approved && AFTER.map((b) => <Line key={b.title} b={b} />)}

              {!approved && <span className="caret sm:ml-[96px]" aria-hidden />}
            </div>
          </div>
          <p className="mt-3 font-mono text-[11px] text-faint">Live Autonomous Agent Decision Graph. Evaluates network topography and candidate capacity deterministically.</p>
        </div>
      </div>
    </section>
  );
}
