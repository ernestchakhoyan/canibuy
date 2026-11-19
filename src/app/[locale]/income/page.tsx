import { IncomeBuilder } from "@builder";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("pages"))("income") };
}

export default function Page() {
  return <IncomeBuilder />;
}
