import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The admin dashboard runs on 5175. Every request to /api is forwarded to the pssa backend on 5000.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5175,
    proxy: { "/api": "http://localhost:5000" },
  },
});
