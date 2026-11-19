import { appIconPng } from "@server";

// PWA icon for the manifest. The dotted folder name serves it at /icon-192.png, which the proxy matcher skips.
export const GET = () => appIconPng(192);
