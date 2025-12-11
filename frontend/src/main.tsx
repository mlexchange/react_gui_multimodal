import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import "./index.css";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import App from "./app/App";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <MantineProvider>
      <Notifications position="top-right" />
      <App />
    </MantineProvider>
  </BrowserRouter>
);
