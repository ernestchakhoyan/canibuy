import { ConnectBuilder } from "@builder";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Connect your Google Sheet" };

export default function Page() {
  return <ConnectBuilder />;
}
