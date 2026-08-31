import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import "./index.css";

// vite-plugin-pwa's registerSW() silently swallows registration failures
// (Workbox's own .catch() with no handler) unless onRegisterError is
// supplied -- without this, a broken Service Worker (and therefore no
// offline caching at all) produces zero visible signal.
registerSW({
  immediate: true,
  onRegisterError: (err) => console.error("[service worker] registration failed:", err),
});

const container = document.getElementById("root");
if (!container) throw new Error("root element not found");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
