import { SectionHead } from "./ui";

const CHAIN = [
  { k: "Past incident", lines: ["FG-027", "Hosur", "Truck breakdown"], accent: "fault" },
  { k: "Recovery", lines: ["FG-041 selected"], accent: "dim" },
  { k: "Reason", lines: ["8.2 km away", "3.1T spare", "17 min ETA"], accent: "dim" },
  { k: "Memory", lines: ["Available to future", "recovery decisions"], accent: "signal" },
] as const;

export default function MemorySection() {
  return (
    <section className="border-t border-line-soft py-28 sm:py-36">
      <div className="container-fg grid gap-14 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-5 lg:pt-2">
          <SectionHead size="md" title="Every recovery becomes operational knowledge.">
            FleetGrid is designed to retain relevant operational context, so future recovery decisions are informed by
            what happened before. The agent recalls precedent. Operators still make the call.
          </SectionHead>
        </div>

        <ol className="relative lg:col-span-7 lg:pl-6">
          {CHAIN.map((c, i) => (
            <li key={c.k} className="relative grid grid-cols-[120px_1fr] gap-6 pb-8 last:pb-0 sm:grid-cols-[150px_1fr]">
              {i < CHAIN.length - 1 && (
                <span aria-hidden className="absolute left-[144px] top-3 ml-[-0.5px] h-full w-px bg-line sm:left-[174px]" />
              )}
              <span className="pt-0.5 text-right text-[13px] text-dim">{c.k}</span>
              <div className="relative pl-6">
                <span
                  aria-hidden
                  className={`absolute -left-[5px] top-[6px] h-[9px] w-[9px] rounded-full border-2 border-base ${
                    c.accent === "signal" ? "bg-signal" : c.accent === "fault" ? "bg-fault" : "bg-dim"
                  }`}
                />
                <div
                  className={`rounded-lg border px-4 py-3 font-mono text-[13px] leading-relaxed ${
                    c.accent === "signal" ? "border-signal/35 bg-signal/[0.04] text-fg" : "border-line bg-raised text-fg"
                  }`}
                >
                  {c.lines.map((l, j) => (
                    <div key={l} className={j === 0 ? "" : "text-dim"}>
                      {l}
                    </div>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
