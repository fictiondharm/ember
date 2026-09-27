import NetworkVisual from "./NetworkVisual";
import { Button } from "./ui";
import { APP_URL } from "./Navbar";

export default function FinalCTA() {
  return (
    <section className="relative overflow-hidden border-t border-line-soft pt-28 sm:pt-36">
      <div className="container-fg relative z-10 text-center">
        <h2 className="display mx-auto text-[clamp(2.4rem,5.4vw,4.9rem)]">
          When logistics breaks,
          <br />
          FleetGrid keeps it moving.
        </h2>
        <p className="lede mx-auto mt-6 text-center">Build a transport network that can respond, recover and continue.</p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Button href={APP_URL}>Enter FleetGrid</Button>
          <Button href="#network" variant="ghost">
            Explore the network
          </Button>
        </div>
      </div>
      <div className="container-fg relative mt-10 sm:mt-4">
        <div className="[mask-image:linear-gradient(to_bottom,transparent,black_25%,black_70%,transparent)]">
          <NetworkVisual mode="recovered" bare className="aspect-[1/1] sm:aspect-[1.9/1]" />
        </div>
      </div>
    </section>
  );
}
