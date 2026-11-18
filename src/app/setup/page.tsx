import { SetupBuilder } from "@builder";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Setup" };

export default function Page() {
  return <SetupBuilder />;
}
