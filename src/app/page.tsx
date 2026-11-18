import { MonthBuilder } from "@builder";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "This month" };

export default function Page() {
  return <MonthBuilder />;
}
