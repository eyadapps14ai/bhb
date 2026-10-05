import vinext from "vinext";
import { defineConfig } from "vite";

// Keep the Postgres driver as a real package (not bundled) so the standalone
// build copies it into dist/standalone/node_modules.
const external = ["pg"];

export default defineConfig({
  plugins: [vinext()],
  environments: {
    rsc: { resolve: { external } },
    ssr: { resolve: { external } },
  },
});
