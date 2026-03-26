import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Yonderia",
    short_name: "Yonderia",
    description:
      "Create and share trip itineraries with friends. Coordinate dates, locations, and activities in one place.",
    start_url: "/",
    display: "standalone",
    background_color: "#F0F0F0",
    theme_color: "#D02020",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
