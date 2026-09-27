import { useEffect, useState } from "react";
import { useInView } from "../hooks/useInView";
import { useReducedMotion } from "../hooks/useMedia";
import { SectionHead, toneBg, toneText, type Tone } from "./ui";

type Loop = {
  id: string;
  index: string;
  title: string;
  stages: string[];
  steps: string[];
};

const LOOPS: Loop[] = [
  {
    id: "capacity",
    index: "Loop 01",
    title: "Use empty capacity",
    stages: ["Spare capacity", "Match", "Reserve", "Move"],
    steps: [
      "A truck has spare capacity on its route.",
      "FleetGrid makes compatible capacity discoverable.",
      "A business adds a shipment.",
      "The shipment moves.",
    ],
  },
  {
    id: "heal",
    index: "Loop 02",
    title: "Heal the network",
    stages: ["Incident", "Analyze", "Recover", "Continue"],
    steps: [
      "A truck encounters an incident.",
      "FleetGrid identifies affected shipments.",
      "The agent searches nearby capacity.",
      "A recovery plan is created.",
      "A human approves.",
      "The shipment continues.",
    ],
  },
];

function useStageCycle(active: boolean, count: number, ms = 1700) {
  const reduced = useReducedMotion();
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (!active || reduced) {
      if (reduced) setStage(count - 1);
      return;
    }
    const id = window.setInterval(() => setStage((s) => (s + 1) % count), ms);
    return () => window.clearInterval(id);
  }, [active, count, ms, reduced]);
  return stage;
}

function StageRail({ stages, stage, tones }: { stages: string[]; stage: number; tones: Tone[] }) {
  return (
    <div className="relative">
      <div className="absolute left-0 right-0 top-[5px] h-px bg-line" />
      <div
        className="absolute left-0 top-[5px] h-px bg-signal transition-all duration-700"
        style={{ width: `${(stage / (stages.length - 1)) * 100}%` }}
      />
      <ol className="relative grid grid-cols-4">
        {stages.map((s, i) => {
          const on = i <= stage;
          const current = i === stage;
          const t = tones[i] ?? 'signal';
          return (
            <li key={s} className={`flex flex-col ${i === 0 ? "items-start" : i === stages.length - 1 ? "items-end" : "items-center"}`}>
              <span
                className={`h-[11px] w-[11px] rounded-full border-2 border-raised transition-colors duration-500 ${
                  on ? toneBg[t] : "bg-line"
                }`}
              />
              <span className={`tag mt-3 text-[10px] sm:text-[11px] transition-colors duration-500 ${current ? toneText[t] : on ? "text-dim" : "text-faint"}`}>
                {s}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function CapacityMock({ stage }: { stage: number }) {
  const matched = stage >= 1;
  const reserved = stage >= 2;
  const moving = stage >= 3;
  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <div className="flex items-center justify-between font-mono text-[12px]">
        <span>FG-041</span>
        <span className="text-faint">Bengaluru to Chennai</span>
      </div>
      <div className="mt-4 flex h-7 overflow-hidden rounded-[4px] border border-line-soft bg-base">
        <div className="h-full bg-route" style={{ width: "65.5%" }} />
        <div
          className="h-full transition-all duration-700"
          style={{
            width: reserved ? "11.1%" : "0%",
            background: "var(--color-signal)",
            opacity: moving ? 1 : 0.7,
          }}
        />
        <div
          className="h-full flex-1"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, transparent 0 5px, color-mix(in srgb, var(--color-signal) 22%, transparent) 5px 6px)",
          }}
        />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[11px]">
        <div>
          <div className="text-faint">Loaded</div>
          <div className="mt-0.5">5.9T</div>
        </div>
        <div>
          <div className="text-faint">Spare</div>
          <div className="mt-0.5 text-signal tabular-nums">{reserved ? "2.1T" : "3.1T"}</div>
        </div>
        <div className="text-right">
          <div className="text-faint">Status</div>
          <div className={`mt-0.5 ${moving ? "text-signal" : matched ? "text-caution" : "text-dim"}`}>
            {moving ? "Moving" : reserved ? "Reserved 1.0T" : matched ? "Match found" : "Listed"}
          </div>
        </div>
      </div>
    </div>
  );
}

function IncidentMock({ stage }: { stage: number }) {
  const states: { tone: Tone; head: string; body: string }[] = [
    { tone: "fault", head: "Incident", body: "FG-027 breakdown near Hosur" },
    { tone: "caution", head: "Analyzing", body: "1 shipment affected, 1.0T" },
    { tone: "signal", head: "Recovery planned", body: "Transfer to FG-041, approved" },
    { tone: "signal", head: "Continuing", body: "SH-2041 moving, ETA +17 min" },
  ];
  const s = states[stage] || { tone: "signal" as Tone, head: "Continuing", body: "SH-2041 moving, ETA +17 min" };
  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <div className="flex items-center justify-between font-mono text-[12px]">
        <span>SH-2041</span>
        <span className={`tag flex items-center gap-1.5 ${toneText[s.tone]}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${toneBg[s.tone]}`} />
          {s.head}
        </span>
      </div>
      <div key={stage} className="feed-in mt-4 text-[15px] font-medium tracking-tight">
        {s.body}
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1">
        {states.map((st, i) => (
          <div key={st.head} className={`h-[3px] rounded-full transition-colors duration-500 ${i <= stage ? toneBg[st.tone] : "bg-line-soft"}`} />
        ))}
      </div>
    </div>
  );
}

function LoopPanel({ loop, active }: { loop: Loop; active: boolean }) {
  const stage = useStageCycle(active, 4, loop.id === "heal" ? 1900 : 1700);
  const tones: Tone[] = loop.id === "heal" ? ["fault", "caution", "signal", "signal"] : ["signal", "signal", "signal", "signal"];
  return (
    <article className="flex flex-col rounded-xl border border-line bg-raised p-6 sm:p-8">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[26px] font-semibold tracking-[-0.03em] sm:text-[30px]">{loop.title}</h3>
        <span className="font-mono text-[12px] text-faint">{loop.index}</span>
      </div>

      <div className="mt-8">
        <StageRail stages={loop.stages} stage={stage} tones={tones} />
      </div>

      <div className="mt-8">{loop.id === "heal" ? <IncidentMock stage={stage} /> : <CapacityMock stage={stage} />}</div>

      <ol className="mt-8 space-y-2.5 border-t border-line-soft pt-6">
        {loop.steps.map((s, i) => (
          <li key={s} className="flex gap-4 text-[14.5px] text-dim">
            <span className="w-5 shrink-0 font-mono text-[12px] leading-[22px] text-faint">{String(i + 1).padStart(2, "0")}</span>
            <span className="leading-[22px]">{s}</span>
          </li>
        ))}
      </ol>
    </article>
  );
}

export default function FleetLoops() {
  const { ref, inView } = useInView<HTMLDivElement>(0.25);
  return (
    <section id="product" className="border-t border-line-soft py-28 sm:py-36">
      <div className="container-fg">
        <SectionHead
          title={
            <>
              One network.
              <br />
              Two critical loops.
            </>
          }
        >
          The same network that fills empty space on a truck is the one that finds a replacement when a truck stops.
        </SectionHead>
        <div ref={ref} className="mt-16 grid gap-5 lg:grid-cols-2">
          {LOOPS.map((l) => (
            <LoopPanel key={l.id} loop={l} active={inView} />
          ))}
        </div>
      </div>
    </section>
  );
}
