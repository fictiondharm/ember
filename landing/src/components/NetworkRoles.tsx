import { SectionHead } from "./ui";

const ROLES = [
  {
    id: "fleets",
    who: "For fleets",
    line: "Turn unused capacity into network capacity.",
    items: ["Fleet visibility", "Capacity discovery", "Incident coordination", "Recovery operations"],
  },
  {
    id: "businesses",
    who: "For businesses",
    line: "Move goods through a network that can adapt.",
    items: ["Capacity discovery", "Shipment creation", "Live tracking", "Recovery visibility"],
  },
  {
    id: "operators",
    who: "For operators",
    line: "Coordinate the moment everything changes.",
    items: ["Network visibility", "AI recommendations", "Human approval", "Operational history"],
  },
];

export default function NetworkRoles() {
  return (
    <section className="border-t border-line-soft py-28 sm:py-36">
      <div className="container-fg">
        <SectionHead title="Built for every side of the network." />
        <div className="mt-16 grid border-y border-line md:grid-cols-3 md:divide-x md:divide-line">
          {ROLES.map((r, i) => (
            <div
              id={r.id}
              key={r.id}
              className={`scroll-mt-24 py-10 md:px-8 md:py-12 ${i === 0 ? "md:pl-0" : ""} ${i === 2 ? "md:pr-0" : ""} ${
                i > 0 ? "border-t border-line md:border-t-0" : ""
              }`}
            >
              <div className="text-[13px] text-signal">{r.who}</div>
              <p className="mt-4 text-[24px] md:min-h-[3.5em] font-semibold leading-[1.15] tracking-[-0.03em] [text-wrap:balance] sm:text-[26px]">
                {r.line}
              </p>
              <ul className="mt-8 space-y-3">
                {r.items.map((it) => (
                  <li key={it} className="flex items-center gap-3 text-[14.5px] text-dim">
                    <span className="h-px w-3 bg-faint" aria-hidden />
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
