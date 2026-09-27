import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import LandingPage from "./pages/LandingPage";
import AppPlaceholder from "./pages/AppPlaceholder";

// Minimal routing: "/" is the landing page, "/app" is reserved for the FleetGrid application.
const isApp = window.location.pathname.startsWith("/app");

createRoot(document.getElementById("root")!).render(
  <StrictMode>{isApp ? <AppPlaceholder /> : <LandingPage />}</StrictMode>,
);
