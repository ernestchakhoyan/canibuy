import { MonthBuilder } from "@builder";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("pages"))("month") };
}

export default function Page() {
  return <MonthBuilder />;
}
