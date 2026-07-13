import React from "react";
import ReactDOM from "react-dom/client";
import "../../web/app/globals.css";
import "./styles.css";
import { resolveFinanceApiBaseUrl } from "../../web/lib/runtime-config";

// Web UI reused in desktop expects Next-style process.env on the client.
const globalProcess = (globalThis as any).process || ((globalThis as any).process = {});
globalProcess.env = globalProcess.env || {};
if (!globalProcess.env.NEXT_PUBLIC_API_BASE_URL) {
  const fallbackApiBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL || "https://finance-api.agentame.xyz";
  globalProcess.env.NEXT_PUBLIC_API_BASE_URL = resolveFinanceApiBaseUrl(fallbackApiBaseUrl);
}
if (!globalProcess.env.NEXT_PUBLIC_WEB_APP_URL) {
  globalProcess.env.NEXT_PUBLIC_WEB_APP_URL = (import.meta as any).env?.VITE_WEB_APP_URL || "https://finance.agentame.xyz";
}

const root = ReactDOM.createRoot(document.getElementById("root")!);

void import("./App").then(({ App }) => {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
