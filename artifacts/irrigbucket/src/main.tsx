import { createRoot } from "react-dom/client";
import App from "./App";
import { initSyncEngine } from "./lib/syncEngine";
import "./index.css";

initSyncEngine();

createRoot(document.getElementById("root")!).render(<App />);
