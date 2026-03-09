import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./styles/index.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("[CabinetFlow] Root element #root not found in the DOM.");

createRoot(rootElement).render(<App />);