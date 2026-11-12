import type { MetadataRoute } from "next";
import bn from "@messages/bn.json";
import { APP_NAME } from "@/domain/shared/app";

/** Installable PWA (standalone). No service worker: the app needs the network for every write. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${bn.app.name} — ${bn.app.tagline}`,
    short_name: bn.app.name || APP_NAME,
    description: bn.meta.description,
    lang: "bn",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8fafc",
    theme_color: "#0f172a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
