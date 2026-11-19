"use server";

import { routing } from "@i18n";
import { auth, googleAccessToken, writePersonal } from "@server";
import type { AppMode, Personal } from "@type";

const APP_MODES: AppMode[] = ["system", "light", "dark"];

/** Saves appearance + language to the Personal block of the connected sheet. No sheet connected → nothing to do. */
export async function savePersonal(personal: Personal) {
  // Values come from the browser: only ever write known ones into the user's sheet.
  if (!APP_MODES.includes(personal.appMode) || !routing.locales.includes(personal.locale)) {
    throw new Error("Invalid appearance or language");
  }
  const spreadsheetId = (await auth())?.sheet?.id;
  const accessToken = spreadsheetId && (await googleAccessToken());
  if (!spreadsheetId || !accessToken) return;
  await writePersonal(accessToken, spreadsheetId, { appMode: personal.appMode, locale: personal.locale });
}
