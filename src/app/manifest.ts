import { APP_ICON_BACKGROUND, APP_ICON_THEME } from "@server";
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Canibuy",
    short_name: "Canibuy",
    description: "How much can I save this month, and can I afford this?",
    start_url: "/",
    display: "standalone",
    theme_color: APP_ICON_THEME,
    background_color: APP_ICON_BACKGROUND,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
