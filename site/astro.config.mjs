import { defineConfig } from "astro/config";

// Custom domain (padam.srid.ca) serves at the root, so no `base`.
export default defineConfig({
  site: "https://padam.srid.ca",
});
