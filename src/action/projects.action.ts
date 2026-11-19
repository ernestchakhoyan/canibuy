"use server";

import { auth, googleAccessToken, writeProjects } from "@server";
import type { Project, ProjectPart } from "@type";

const MAX_ROWS = 5000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;

const text = (v: unknown, max: number) => typeof v === "string" && v.length <= max;
const optionalDate = (v: unknown) =>
  v === undefined || v === null || v === "" || (text(v, 10) && DATE.test(v as string));

const validProject = (p: Project) =>
  text(p.id, 32) && text(p.name, 200) && optionalDate(p.startedDate) && optionalDate(p.archivedDate);

const validPart = (p: ProjectPart) =>
  text(p.projectId, 32) &&
  text(p.partId, 32) &&
  text(p.part, 200) &&
  Number.isFinite(p.cost) &&
  p.cost >= 0 &&
  text(p.payMonth, 7) &&
  MONTH.test(p.payMonth) &&
  (p.status === "Planned" || p.status === "Paid") &&
  optionalDate(p.paidDate) &&
  (p.installment === undefined ||
    p.installment === null ||
    p.installment === "bank" ||
    p.installment === "friend" ||
    p.installment === "saving");

/** Mirrors the app's projects and their parts into the sheet's Projects tab. No sheet connected → nothing to do. */
/** Returns `true` once written, `false` when no sheet is connected. */
export async function saveProjects(projects: Project[], parts: ProjectPart[]) {
  // They come from the browser: only well-formed rows may be written into the user's sheet.
  if (
    !Array.isArray(projects) ||
    !Array.isArray(parts) ||
    projects.length + parts.length > MAX_ROWS ||
    !projects.every(validProject) ||
    !parts.every(validPart)
  ) {
    throw new Error("Invalid projects");
  }
  const spreadsheetId = (await auth())?.sheet?.id;
  const accessToken = spreadsheetId && (await googleAccessToken());
  if (!spreadsheetId || !accessToken) return false; // nothing written: the caller must not count it as synced
  // Rebuild from known fields only, so nothing extra rides along into the sheet.
  await writeProjects(
    accessToken,
    spreadsheetId,
    projects.map(({ id, name, startedDate, archivedDate }) => ({ id, name, startedDate, archivedDate })),
    parts.map(({ projectId, project, partId, part, cost, payMonth, status, paidDate, installment }) => ({
      projectId,
      project,
      partId,
      part,
      cost,
      payMonth,
      status,
      paidDate,
      installment: installment ?? undefined,
    }))
  );
  return true;
}
