import { Logo } from "../components/ui";

/**
 * Temporary stand-in for /app.
 * Replace this with the real FleetGrid application (or redirect to it) — see README.
 */
export default function AppPlaceholder() {
  return (
    <div className="grid-bg flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <Logo />
      <h1 className="h2 mt-10">Control Tower</h1>
      <p className="lede mx-auto mt-4 text-center">The FleetGrid application will be connected here.</p>
      <a href="/" className="mt-8 text-[13px] text-dim underline-offset-4 hover:text-fg hover:underline">
        Back to fleetgrid.com
      </a>
    </div>
  );
}
