import { SavingsBuilder } from "@builder";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Savings" };

export default function Page() {
  return <SavingsBuilder />;
}
