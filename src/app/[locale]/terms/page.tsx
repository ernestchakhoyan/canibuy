import { TermsBuilder } from "@builder";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service" };

export default function Page() {
  return <TermsBuilder />;
}
