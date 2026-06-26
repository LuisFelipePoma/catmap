import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.GITHUB_PAGES === "true" ? "/catmap/" : "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@catmap/core": fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url)),
      "@catmap/data": fileURLToPath(new URL("../../packages/data/src/index.ts", import.meta.url)),
      "@catmap/charts": fileURLToPath(new URL("../../packages/charts/src/index.ts", import.meta.url)),
      "@catmap/geotech": fileURLToPath(new URL("../../packages/geotech/src/index.ts", import.meta.url)),
      "@catmap/maps": fileURLToPath(new URL("../../packages/maps/src/index.ts", import.meta.url)),
      "@catmap/react": fileURLToPath(new URL("../../packages/react/src/index.ts", import.meta.url))
    }
  }
});
