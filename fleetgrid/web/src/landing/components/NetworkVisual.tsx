import { useEffect, useRef, useState } from "react";
import { useMediaQuery, useReducedMotion } from "../hooks/useMedia";

export type Phase = "normal" | "disruption" | "recovery";

type Props = {
  /** "cycle" loops NORMAL → DISRUPTION → RECOVERY. "recovered" holds the healed network. */
  mode?: "cycle" | "recovered";
  /** Hide the HTML overlays (phase stepper + shipment card). */
  bare?: boolean;
  /** Tighter label sizing for embedded use (e.g. inside the Control Tower). */
  compact?: boolean;
  className?: string;
};

/* ---- Timeline (ms) ------------------------------------------------ */
const CYCLE = 14000;
const T_BREAK = 5000;
const T_RECOVER = 8000;
const RECOVERY_TRAVEL = 5400;

/* ---- Geometry (abstract, not to scale) ---------------------------- */
const CITIES = [
  { name: "MUMBAI", x: 110, y: 150, lx: 0, ly: -18, anchor: "middle" },
  { name: "HYDERABAD", x: 430, y: 130, lx: 0, ly: -18, anchor: "middle" },
  { name: "BENGALURU", x: 400, y: 360, lx: -14, ly: 4, anchor: "end" },
  { name: "HOSUR", x: 470, y: 395, lx: -2, ly: 26, anchor: "middle" },
  { name: "CHENNAI", x: 650, y: 320, lx: 16, ly: 4, anchor: "start" },
] as const;

const RELAYS = [
  [262, 118], [250, 262], [560, 206], [322, 300], [180, 330], [696, 214], [610, 452],
] as const;

const ROUTES = [
  "M110 150 Q270 104 430 130",
  "M110 150 Q220 300 400 360",
  "M430 130 Q456 250 400 360",
  "M430 130 Q592 190 650 320",
];

const TRUCKS = [
  { route: 0, dur: 17000, off: 0.1, rev: false },
  { route: 0, dur: 21000, off: 0.62, rev: true },
  { route: 1, dur: 19000, off: 0.35, rev: false },
  { route: 2, dur: 15000, off: 0.2, rev: true },
  { route: 3, dur: 18000, off: 0.72, rev: false },
  { route: 3, dur: 22000, off: 0.3, rev: true },
];

const ROUTE_A = "M400 360 Q432 386 470 395 L560 388"; // Bengaluru → Hosur → incident
const ROUTE_B = "M560 388 Q612 372 650 320"; // incident → Chennai (planned)
const RECOVERY = "M515 452 C538 444 552 414 560 388 C594 402 634 372 650 320";
const INCIDENT = { x: 560, y: 388 };
const SPARE = { x: 515, y: 452 };

const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

const PHASE_META: Record<Phase, { label: string; status: string; tone: string }> = {
  normal: { label: "Normal", status: "On schedule", tone: "var(--color-signal)" },
  disruption: { label: "Disruption", status: "At risk: vehicle stopped", tone: "var(--color-fault)" },
  recovery: { label: "Recovery", status: "Rerouted via FG-041, +17 min", tone: "var(--color-signal)" },
};

export default function NetworkVisual({ mode = "cycle", bare = false, compact = false, className = "" }: Props) {
  const reduced = useReducedMotion();
  const narrow = useMediaQuery("(max-width: 640px)");
  const [phase, setPhase] = useState<Phase>(mode === "recovered" ? "recovery" : "normal");

  const routeRefs = useRef<(SVGPathElement | null)[]>([]);
  const truckRefs = useRef<(SVGGElement | null)[]>([]);
  const routeA = useRef<SVGPathElement>(null);
  const recoveryPath = useRef<SVGPathElement>(null);
  const recoveryDraw = useRef<SVGPathElement>(null);
  const fg027 = useRef<SVGGElement>(null);
  const fg041 = useRef<SVGGElement>(null);
  const phaseRef = useRef<Phase>(phase);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();

    const place = (g: SVGGElement | null | undefined, path: SVGPathElement | null | undefined, p: number) => {
      if (!g || !path) return;
      const len = path.getTotalLength();
      const pt = path.getPointAtLength(len * Math.max(0, Math.min(1, p)));
      g.setAttribute("transform", `translate(${pt.x.toFixed(2)} ${pt.y.toFixed(2)})`);
    };

    const drawLen = recoveryDraw.current?.getTotalLength() ?? 0;
    if (recoveryDraw.current) recoveryDraw.current.style.strokeDasharray = `${drawLen}`;

    const tick = (now: number) => {
      const elapsed = now - start;

      // Ambient network traffic
      TRUCKS.forEach((tr, i) => {
        let p = reduced ? tr.off : (elapsed / tr.dur + tr.off) % 1;
        if (tr.rev) p = 1 - p;
        place(truckRefs.current[i], routeRefs.current[tr.route], p);
      });

      // Scenario clock
      let t: number;
      if (reduced) t = CYCLE - 400;
      else if (mode === "recovered") t = T_RECOVER + (elapsed % (RECOVERY_TRAVEL + 2200));
      else t = elapsed % CYCLE;

      const next: Phase = t < T_BREAK ? "normal" : t < T_RECOVER ? "disruption" : "recovery";
      if (next !== phaseRef.current) {
        phaseRef.current = next;
        setPhase(next);
      }

      place(fg027.current, routeA.current, ease(Math.min(1, t / T_BREAK)));

      const rp = t < T_RECOVER ? 0 : Math.min(1, (t - T_RECOVER) / RECOVERY_TRAVEL);
      place(fg041.current, recoveryPath.current, ease(rp));

      if (recoveryDraw.current) {
        const d = mode === "recovered" || reduced ? 1 : t < T_RECOVER ? 0 : Math.min(1, (t - T_RECOVER) / 1300);
        recoveryDraw.current.style.strokeDashoffset = `${drawLen * (1 - d)}`;
      }

      if (!reduced) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode, reduced]);

  const fs = narrow ? 13 : compact ? 13 : 11.5;
  const fsSmall = narrow ? 11 : compact ? 11 : 9.5;
  const disrupted = phase === "disruption";
  const recovering = phase === "recovery";
  const viewBox = narrow ? "296 44 468 450" : "40 70 720 420";

  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox={viewBox}
        className="block h-full w-full"
        role="img"
        aria-label="Abstract logistics network between Mumbai, Hyderabad, Bengaluru, Hosur and Chennai. A truck breaks down near Hosur and a nearby truck with spare capacity takes over the shipment."
      >
        <defs>
          <pattern id="fg-dots" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.9" fill="var(--color-line)" />
          </pattern>
          <radialGradient id="fg-vignette" cx="50%" cy="55%" r="60%">
            <stop offset="0%" stopColor="var(--color-base)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--color-base)" stopOpacity="0.85" />
          </radialGradient>
          <radialGradient id="fg-glow-fault">
            <stop offset="0%" stopColor="var(--color-fault)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--color-fault)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="fg-glow-signal">
            <stop offset="0%" stopColor="var(--color-signal)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--color-signal)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect x="0" y="0" width="800" height="560" fill="url(#fg-dots)" />

        {/* Idle network */}
        {ROUTES.map((d, i) => (
          <path
            key={d}
            ref={(el) => {
              routeRefs.current[i] = el;
            }}
            d={d}
            fill="none"
            style={{ stroke: "var(--color-route)" }}
            strokeWidth={1.4}
          />
        ))}
        {RELAYS.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={1.8} style={{ fill: "var(--color-faint)" }} opacity={0.6} />
        ))}

        {/* Primary corridor: Bengaluru → Hosur → Chennai */}
        <path d={ROUTE_A} ref={routeA} fill="none" style={{ stroke: "var(--color-signal)" }} strokeOpacity={0.55} strokeWidth={1.8} />
        <path
          d={ROUTE_B}
          fill="none"
          style={{
            stroke: disrupted ? "var(--color-fault)" : recovering ? "var(--color-route)" : "var(--color-signal)",
            transition: "stroke 600ms ease",
          }}
          strokeOpacity={disrupted ? 0.9 : 0.55}
          strokeWidth={1.8}
          strokeDasharray={phase === "normal" ? undefined : "4 5"}
        />

        {/* Recovery path */}
        <path d={RECOVERY} ref={recoveryPath} fill="none" stroke="none" />
        <path
          d={RECOVERY}
          ref={recoveryDraw}
          fill="none"
          style={{ stroke: "var(--color-signal)", opacity: recovering ? 1 : 0, transition: "opacity 300ms" }}
          strokeWidth={2.4}
          strokeLinecap="round"
        />

        {/* Spare capacity candidate */}
        <g transform={`translate(${SPARE.x} ${SPARE.y})`} opacity={phase === "normal" ? 0.55 : 1} style={{ transition: "opacity 500ms" }}>
          {disrupted && <circle r={6} className="node-ring" style={{ fill: "none", stroke: "var(--color-caution)" }} />}
          <rect x={-4} y={-4} width={8} height={8} rx={1.5} style={{ fill: "none", stroke: disrupted ? "var(--color-caution)" : "var(--color-faint)" }} strokeWidth={1.2} />
        </g>
        {disrupted && (
          <g fontFamily="var(--font-mono)" style={{ fill: "var(--color-caution)" }}>
            <text x={SPARE.x - 12} y={SPARE.y + 4} fontSize={fsSmall} textAnchor="end">FG-041</text>
            <text x={SPARE.x - 12} y={SPARE.y + 4 + fsSmall * 1.3} fontSize={fsSmall} textAnchor="end" style={{ fill: "var(--color-dim)" }}>
              3.1T spare, 8.2 km
            </text>
          </g>
        )}

        {/* Incident marker */}
        {phase !== "normal" && (
          <g transform={`translate(${INCIDENT.x} ${INCIDENT.y})`}>
            {disrupted && (
              <>
                <circle r={34} fill="url(#fg-glow-fault)" />
                <circle r={7} className="node-ring-fast" style={{ fill: "none", stroke: "var(--color-fault)" }} />
              </>
            )}
            {recovering && <circle r={30} fill="url(#fg-glow-signal)" />}
          </g>
        )}
        {phase !== "normal" && (
          <g fontFamily="var(--font-mono)">
            <text x={INCIDENT.x + 12} y={INCIDENT.y + 22} fontSize={fsSmall} style={{ fill: disrupted ? "var(--color-fault)" : "var(--color-dim)" }}>
              {disrupted ? "FG-027 BREAKDOWN" : "CARGO HANDOFF"}
            </text>
          </g>
        )}

        {/* Cities */}
        {CITIES.map((c) => (
          <g key={c.name} transform={`translate(${c.x} ${c.y})`}>
            <circle r={4} className="node-ring" style={{ fill: "none", stroke: "var(--color-dim)" }} strokeWidth={0.8} />
            <circle r={5} style={{ fill: "var(--color-base)", stroke: "var(--color-fg)" }} strokeWidth={1.4} />
            <circle r={1.8} style={{ fill: "var(--color-fg)" }} />
            <text
              x={c.lx}
              y={c.ly}
              fontSize={fs}
              textAnchor={c.anchor}
              fontFamily="var(--font-mono)"
              letterSpacing="0.08em"
              style={{ fill: "var(--color-dim)" }}
            >
              {c.name}
            </text>
          </g>
        ))}

        {/* Ambient traffic */}
        {TRUCKS.map((_, i) => (
          <g
            key={i}
            ref={(el) => {
              truckRefs.current[i] = el;
            }}
          >
            <circle r={2.6} style={{ fill: "var(--color-fg)" }} opacity={0.7} />
          </g>
        ))}

        {/* FG-027: the disrupted vehicle */}
        <g ref={fg027}>
          <circle
            r={9}
            style={{ fill: disrupted ? "var(--color-fault)" : "var(--color-signal)", transition: "fill 400ms" }}
            opacity={recovering ? 0 : 0.16}
          />
          <circle
            r={4.2}
            style={{
              fill: disrupted ? "var(--color-fault)" : recovering ? "var(--color-faint)" : "var(--color-signal)",
              transition: "fill 400ms",
            }}
          />
        </g>

        {/* FG-041: the recovery vehicle */}
        <g ref={fg041} opacity={phase === "normal" ? 0 : 1} style={{ transition: "opacity 400ms" }}>
          <circle r={10} style={{ fill: "var(--color-signal)" }} opacity={recovering ? 0.18 : 0} />
          <circle r={4.4} style={{ fill: recovering ? "var(--color-signal)" : "var(--color-caution)" }} />
        </g>

        <rect x="0" y="0" width="800" height="560" fill="url(#fg-vignette)" pointerEvents="none" />
      </svg>

      {!bare && <PhaseOverlay phase={phase} held={mode === "recovered"} card={!compact} />}
    </div>
  );
}

function PhaseOverlay({ phase, held, card }: { phase: Phase; held: boolean; card: boolean }) {
  const order: Phase[] = ["normal", "disruption", "recovery"];
  const meta = PHASE_META[phase];
  return (
    <>
      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1 sm:left-5 sm:top-5" aria-live="polite">
        {order.map((p, i) => {
          const active = p === phase;
          const done = order.indexOf(phase) > i || (held && p !== "recovery");
          return (
            <div key={p} className="flex items-center gap-1">
              <span
                className={`tag flex items-center gap-1.5 rounded-[5px] border px-2 py-1 transition-colors duration-500 ${
                  active ? "border-line bg-panel text-fg" : "border-transparent text-faint"
                }`}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full transition-colors duration-500"
                  style={{ background: active ? PHASE_META[p].tone : done ? "var(--color-dim)" : "var(--color-line)" }}
                />
                {PHASE_META[p].label}
              </span>
              {i < 2 && <span className="h-px w-3 bg-line sm:w-5" />}
            </div>
          );
        })}
      </div>

      {card && <div className="pointer-events-none absolute right-5 top-5 hidden w-[232px] rounded-lg border border-line bg-panel/85 p-3.5 backdrop-blur-sm md:block">
        <div className="flex items-center justify-between">
          <span className="tag text-faint">Shipment SH-2041</span>
          <span className="tag text-faint">1.0T</span>
        </div>
        <div className="mt-2 text-[13px] font-medium">Bengaluru to Chennai</div>
        <div className="mt-2.5 flex items-center gap-2 border-t border-line-soft pt-2.5 text-[12px]">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-500" style={{ background: meta.tone }} />
          <span className="text-dim">{meta.status}</span>
        </div>
      </div>}
    </>
  );
}
