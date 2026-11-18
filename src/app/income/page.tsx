import { IncomeBuilder } from "@builder";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Income" };

export default function Page() {
  return <IncomeBuilder />;
}
