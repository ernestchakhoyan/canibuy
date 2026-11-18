import { HistoryBuilder } from "@builder";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "History" };

export default function Page() {
  return <HistoryBuilder />;
}
