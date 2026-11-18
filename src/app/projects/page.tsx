import { ProjectsBuilder } from "@builder";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Projects" };

export default function Page() {
  return <ProjectsBuilder />;
}
