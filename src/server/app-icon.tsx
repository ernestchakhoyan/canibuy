import "server-only";
import { ImageResponse } from "next/og";

// App icon (favicon, Apple touch icon, PWA icons). Static hex colors, taken from the theme's light tokens:
// #007852 primary, #E0F4EA secondary, #003E2C secondary-foreground, #EDB333 brand-gold, #412805 brand-gold-foreground.
// src/app/icon.svg is the same drawing at stroke 10, kept as a static file for the favicon.

export const APP_ICON_BACKGROUND = "#F6FAF8";
export const APP_ICON_THEME = "#007852";

/** `strokeWidth`: 6 at 180 px and up, 10 at 32 px and below so the glyphs stay readable. */
export const appIconSvg = (strokeWidth: number) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <rect width="120" height="120" rx="27" fill="#007852"/>
  <rect x="20" y="20" width="36" height="36" rx="10" fill="#E0F4EA"/>
  <rect x="64" y="20" width="36" height="36" rx="10" fill="#E0F4EA"/>
  <rect x="20" y="64" width="36" height="36" rx="10" fill="#E0F4EA"/>
  <rect x="64" y="64" width="36" height="36" rx="10" fill="#EDB333"/>
  <path d="M38 29V47M29 38H47M73 38H91M29 77.5H47M29 86.5H47" fill="none" stroke="#003E2C" stroke-width="${strokeWidth}" stroke-linecap="round"/>
  <path d="M73 82L79.5 88.5L91.5 75.5" fill="none" stroke="#412805" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

/** The app icon as a `size`×`size` PNG. */
export const appIconPng = (size: number, strokeWidth = 6) =>
  new ImageResponse(
    // biome-ignore lint/performance/noImgElement: rendered by Satori into a PNG, not by the browser
    <img
      src={`data:image/svg+xml;base64,${Buffer.from(appIconSvg(strokeWidth)).toString("base64")}`}
      width={size}
      height={size}
      alt=""
    />,
    { width: size, height: size }
  );
