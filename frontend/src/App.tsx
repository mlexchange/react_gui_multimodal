import { MantineProvider } from "@mantine/core";
import { HubAppLayout } from "@blueskyproject/finch";
import { RouteItem } from "@blueskyproject/finch";

import { Scattering } from "./components/Scattering";
import { XPS } from "./components/XPS";

import { PlaceholderIcon } from "@phosphor-icons/react"

import "@mantine/core/styles.css";
import "@blueskyproject/finch/style.css";
import "./index.css";

function App() {
  const routes: RouteItem[] = [
    {
      label: "Home",
      path: "/",
      element: (
        <div>
          <p>Home</p>
        </div>
      ),
      icon: <PlaceholderIcon size={32} />,
    },
    {
      label: "Scattering",
      path: "/scattering",
      element: <Scattering />,
      icon: <PlaceholderIcon size={32} />,
    },
    {
      label: "XPS",
      path: "/xps",
      element: <XPS />,
      icon: <PlaceholderIcon size={32} />,
    },
  ];

  return (
    <MantineProvider>
      {/* <HubAppLayout headerTitle="Multimodal Analysis" routes={routes} /> */}
      <Scattering standalone={true} />
    </MantineProvider>
  );
}

export default App;
