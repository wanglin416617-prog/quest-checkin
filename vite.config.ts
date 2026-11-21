import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const base = "/quest-checkin/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: [
        "app-icon/favicon.ico",
        "app-icon/favicon.svg",
        "app-icon/apple-touch-icon-180.png",
        "fonts/NunitoNum-Variable.woff2",
        "fonts/GongtongWordmark-ExtraBold.woff2",
      ],
      manifest: {
        id: base,
        name: "共同的努力",
        short_name: "共同的努力",
        description:
          "把自律变成闯关游戏：每天打卡小目标，攒积分换自己定的奖励。数据只存在本机，离线可用。",
        lang: "zh-CN",
        dir: "ltr",
        start_url: `${base}?source=pwa`,
        scope: base,
        display: "standalone",
        orientation: "portrait",
        theme_color: "#F7F4EF",
        background_color: "#F7F4EF",
        categories: ["lifestyle", "health", "productivity"],
        icons: [
          { src: "app-icon/app-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "app-icon/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          {
            src: "app-icon/app-icon-maskable-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "app-icon/app-icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2,webmanifest,txt}"],
        navigateFallback: `${base}index.html`,
        navigateFallbackDenylist: [/^\/apk\//, /\.ics$/],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
