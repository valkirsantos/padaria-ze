import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Padaria do Ze",
        short_name: "Padaria do Ze",
        description: "Faca suas encomendas de paes com antecedencia",
        theme_color: "#854F0B",
        background_color: "#FAEEDA",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ]
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /\/api\/produtos/,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "api-produtos", expiration: { maxAgeSeconds: 21600 } }
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:3001", changeOrigin: true },
      "/ws":  { target: "ws://localhost:3001",   ws: true, changeOrigin: true }
    }
  }
});
