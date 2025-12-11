import { HubAppLayout, RouteItem } from "@blueskyproject/finch";
import { Scattering } from "@/components/Scattering";
import { HouseIcon, ChartScatterIcon } from "@phosphor-icons/react";

import "@blueskyproject/finch/style.css";

/**
 * Example: HubAppLayout mode
 *
 * This demonstrates how to use the Scattering component within the
 * Finch HubAppLayout, which provides navigation and a consistent layout
 * for multiple modules.
 */
export default function HubLayoutPage() {
  const routes: RouteItem[] = [
    {
      label: "Home",
      path: "/hublayout",
      element: <p>Home</p>,
      icon: <HouseIcon size={32} />,
    },
    {
      label: "Scattering",
      path: "/hublayout/scattering",
      element: <Scattering />,
      icon: <ChartScatterIcon size={32} />,
    },
  ];

  return <HubAppLayout headerTitle="Multimodal Analysis" routes={routes} />;
}
