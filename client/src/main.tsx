import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializeCapacitor } from "@/lib/capacitor";

// Initialize Capacitor for mobile features if supported
if (typeof window !== 'undefined') {
  try {
    initializeCapacitor();
  } catch (e) {
    console.warn('Capacitor initialization failed:', e);
  }
}

createRoot(document.getElementById("root")!).render(<App />);
