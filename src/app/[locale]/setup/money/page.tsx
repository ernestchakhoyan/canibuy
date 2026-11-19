import { SetupSectionBuilder } from "@builder";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("setupSections"))("money.title") };
}

export default function Page() {
  return <SetupSectionBuilder section="money" />;
}
