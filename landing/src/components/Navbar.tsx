import { useEffect, useState } from "react";
import { Logo } from "./ui";

export const NAV_LINKS = [
  { label: "Product", href: "#product" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Network", href: "#network" },
  { label: "For Businesses", href: "#businesses" },
  { label: "For Fleets", href: "#fleets" },
] as const;

/** The FleetGrid application lives here. Change once /app is connected. */
export const APP_URL = "/app";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled || open ? "border-b border-line-soft bg-base/80 backdrop-blur-md" : "border-b border-transparent"
      }`}
    >
      <nav className="container-fg flex h-16 items-center justify-between" aria-label="Main">
        <Logo />

        <ul className="hidden items-center gap-7 lg:flex">
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="text-[13.5px] text-dim transition-colors hover:text-fg">
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-5 lg:flex">
          <a href={APP_URL} className="text-[13.5px] text-dim transition-colors hover:text-fg">
            Sign In
          </a>
          <a
            href={APP_URL}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-panel px-3.5 text-[12px] font-medium uppercase tracking-[0.08em] transition-colors hover:border-faint hover:bg-raised"
          >
            <span className="dot-live" aria-hidden />
            Enter Control Tower
          </a>
        </div>

        <button
          className="-mr-2 flex h-10 w-10 items-center justify-center rounded-md text-dim lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
            {open ? (
              <path d="M4 4 L14 14 M14 4 L4 14" stroke="currentColor" strokeWidth="1.6" />
            ) : (
              <path d="M2 6 H16 M2 12 H16" stroke="currentColor" strokeWidth="1.6" />
            )}
          </svg>
        </button>
      </nav>

      {open && (
        <div className="container-fg pb-6 lg:hidden">
          <ul className="flex flex-col border-t border-line-soft pt-3">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={() => setOpen(false)} className="block py-3 text-[15px] text-dim hover:text-fg">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-3">
            <a href={APP_URL} className="flex h-11 flex-1 items-center justify-center rounded-md border border-line text-[13px] text-dim">
              Sign In
            </a>
            <a
              href={APP_URL}
              className="flex h-11 flex-[1.6] items-center justify-center gap-2 rounded-md bg-fg text-[12px] font-medium uppercase tracking-[0.08em] text-base"
            >
              Enter Control Tower
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
