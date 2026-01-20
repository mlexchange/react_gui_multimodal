import "@h5web/lib/styles.css";
import { createRoot } from "react-dom/client";
import { ToastProvider } from "@/components/ui";
import "./index.css";
import App from "./app/App";

createRoot(document.getElementById("root")!).render(
  <ToastProvider>
    <App />
  </ToastProvider>
);
