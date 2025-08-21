import { ErrorBoundary } from "./components/ErrorBoundary";
import App from "./App";
import "./index.css";
import { createRoot } from "react-dom/client";
import 'leaflet/dist/leaflet.css';


createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
