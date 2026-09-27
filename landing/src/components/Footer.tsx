import { Logo } from "./ui";

const COLS = [
  {
    title: "Product",
    links: [
      { label: "Product", href: "#product" },
      { label: "How It Works", href: "#how-it-works" },
      { label: "Network", href: "#network" },
    ],
  },
  {
    title: "Network",
    links: [
      { label: "Businesses", href: "#businesses" },
      { label: "Fleets", href: "#fleets" },
    ],
  },
  {
    title: "Project",
    links: [
      // TODO: replace with the real hackathon page and repository URLs.
      { label: "Hackathon", href: "#top" },
      { label: "GitHub", href: "https://github.com" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-line-soft py-16">
      <div className="container-fg grid gap-12 md:grid-cols-12">
        <div className="md:col-span-5">
          <Logo />
          <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-dim">
            AI-powered infrastructure for resilient logistics networks.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-6 md:col-span-7">
          {COLS.map((c) => (
            <div key={c.title}>
              <div className="text-[12.5px] text-faint">{c.title}</div>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-[14px] text-dim transition-colors hover:text-fg"
                      {...(l.href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="container-fg mt-14">
        <div className="flex flex-wrap justify-between gap-4 border-t border-line-soft pt-6 text-[12px] text-faint">
          <span>© 2026 FleetGrid</span>
          <span>Product visuals use illustrative demo data.</span>
        </div>
      </div>
    </footer>
  );
}
