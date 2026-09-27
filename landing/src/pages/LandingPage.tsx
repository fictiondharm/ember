import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import ProblemSection from "../components/ProblemSection";
import FleetLoops from "../components/FleetLoops";
import AgentSection from "../components/AgentSection";
import ControlTower from "../components/ControlTower";
import NetworkRoles from "../components/NetworkRoles";
import MemorySection from "../components/MemorySection";
import ProofSection from "../components/ProofSection";
import FinalCTA from "../components/FinalCTA";
import Footer from "../components/Footer";

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <ProblemSection />
        <FleetLoops />
        <AgentSection />
        <ControlTower />
        <NetworkRoles />
        <MemorySection />
        <ProofSection />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
