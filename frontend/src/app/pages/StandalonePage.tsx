import { MantineProvider } from "@mantine/core";
import { Scattering } from "@/components/Scattering";

import "@mantine/core/styles.css";
import "@blueskyproject/finch/style.css";

/**
 * Example: Standalone mode
 *
 * This demonstrates how to use the Scattering component in standalone mode,
 * where it takes up the full viewport height and manages its own layout.
 *
 * Usage:
 * ```tsx
 * <MantineProvider>
 *   <Scattering standalone={true} />
 * </MantineProvider>
 * ```
 */
export default function StandalonePage() {
  return (
    <MantineProvider>
      <Scattering standalone={true} />
    </MantineProvider>
  );
}
