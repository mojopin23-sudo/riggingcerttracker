import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "331 Certs — Rig Runner Terminal 331",
    short_name: "331 Certs",
    description: "Rigging and equipment certifications for Rig Runner Terminal 331, Jourdanton, Texas.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#efe6d6",
    theme_color: "#1e2a24",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
