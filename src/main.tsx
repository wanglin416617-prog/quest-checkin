import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app/App";
import { registerPwa } from "@/pwa/registerSW";
import { requestPersistentStorage } from "@/pwa/persist";
import "@/styles/index.css";

registerPwa();
void requestPersistentStorage();

const buildId = import.meta.env.VITE_BUILD_ID;
if (typeof buildId === "string" && buildId) document.documentElement.dataset.build = buildId;

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element #root not found");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
