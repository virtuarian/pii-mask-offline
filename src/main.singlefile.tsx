import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

// Entry point for the single-HTML-file build (see vite.singlefile.config.ts):
// unlike main.tsx, this never registers a Service Worker -- there is no
// separate file for one to be, and no origin-scoped Cache Storage to manage
// for a file meant to be copied around and opened directly.

const container = document.getElementById("root");
if (!container) throw new Error("root element not found");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
