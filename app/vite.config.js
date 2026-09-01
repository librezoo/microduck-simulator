import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // The same dist runs from HTTPS and the iOS app's microduck:// bundle
  // scheme. Generated asset URLs therefore need to stay relative.
  base: "./",
  server: {
    port: 5173,
  },
  build: {
    // Keep the JS/CSS bundle out of dist/assets/: the game's static assets
    // (public/assets/) land there and must keep their historical URLs.
    assetsDir: "bundle",
    chunkSizeWarningLimit: 1500,
  },
});
