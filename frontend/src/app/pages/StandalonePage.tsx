import { Scattering } from "@/components/Scattering";

import "@blueskyproject/finch/style.css";

/**
 * Example: Standalone mode
 *
 * This demonstrates how to use the Scattering component in standalone mode,
 * where it takes up the full viewport height and manages its own layout.
 */
export default function StandalonePage() {
  return <Scattering standalone={true} />;
}
