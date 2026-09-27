import { SectionHead } from "./ui";

const EVENTS = [
  { t: "14:32:08", e: "Incident created", by: "Agent", h: "9f2c41e0" },
  { t: "14:32:13", e: "Recovery plan created", by: "Agent", h: "3a07bb92" },
  { t: "14:32:19", e: "Human approval", by: "Operator", h: "c81d5f36", key: true },
  { t: "14:32:20", e: "Truck assigned", by: "System", h: "77e0a4d1" },
  { t: "14:51:44", e: "Cargo handoff", by: "Drivers", h: "e2b9c05a" },
  { t: "14:52:10", e: "Shipment resumed", by: "System", h: "51fa8e27" },
  { t: "17:48:02", e: "Delivery confirmed", by: "Receiver", h: "0d6c3b98" },
];

export default function ProofSection() {
  return (
    <section className="border-t border-line-soft py-28 sm:py-36">
      <div className="container-fg">
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <SectionHead title="Every important action leaves a record.">
            Who decided, what changed and when. Each step of a recovery is written to an ordered event history that
            operators, fleets and shippers can review.
          </SectionHead>
          <span className="tag inline-flex w-fit shrink-0 items-center gap-2 rounded-md border border-line px-3 py-2 text-dim">
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <path d="M2 6.2 L4.8 9 L10 3" fill="none" stroke="var(--color-signal)" strokeWidth="1.6" />
            </svg>
            Verifiable event history
          </span>
        </div>

        <div className="mt-16 overflow-x-auto pb-2">
          <ol className="relative grid min-w-[900px] grid-cols-7">
            <span aria-hidden className="absolute left-0 right-0 top-[5px] h-px bg-line" />
            {EVENTS.map((ev) => (
              <li key={ev.e} className="relative pr-4">
                <span
                  className={`relative block h-[11px] w-[11px] rounded-full border-2 border-base ${ev.key ? "bg-signal" : "bg-fg"}`}
                />
                <div className="mt-5 font-mono text-[11px] text-faint">{ev.t}</div>
                <div className="mt-2 text-[14.5px] font-medium leading-snug">{ev.e}</div>
                <div className="mt-1 text-[12.5px] text-dim">{ev.by}</div>
                <div className="mt-4 font-mono text-[10.5px] text-faint">#{ev.h}</div>
              </li>
            ))}
          </ol>
        </div>

        <p className="mt-10 max-w-2xl border-t border-line-soft pt-6 text-[13.5px] leading-relaxed text-faint">
          FleetGrid may later anchor hashes of key events to a public ledger, so the record can be checked independently.
          The ledger is supporting infrastructure for proof, not part of how logistics runs.
        </p>
      </div>
    </section>
  );
}
