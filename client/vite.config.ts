import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
      "/tickets": "http://localhost:3000",
      "/admin": "http://localhost:3000",
      "/dashboard": "http://localhost:3000",
      "/webhooks": "http://localhost:3000",
    },
  },
});
