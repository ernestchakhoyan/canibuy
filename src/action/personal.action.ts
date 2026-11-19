"use server";

import { routing } from "@i18n";
import { auth, googleAccessToken, writePersonal } from "@server";
import type { AppMode, Personal } from "@type";

const APP_MODES: AppMode[] = ["system", "light", "dark"];

/**
 * Saves appearance, language and the amounts eye to the Personal block of the connected sheet.
 * Returns `true` once written, `false` when no sheet is connected.
 */
export async function savePersonal(personal: Personal) {
  // Values come from the browser: only ever write known ones into the user's sheet.
  if (
    !APP_MODES.includes(personal.appMode) ||
    !routing.locales.includes(personal.locale) ||
    (personal.amountsHidden !== undefined && typeof personal.amountsHidden !== "boolean")
  ) {
    throw new Error("Invalid personal settings");
  }
  const spreadsheetId = (await auth())?.sheet?.id;
  const accessToken = spreadsheetId && (await googleAccessToken());
  if (!spreadsheetId || !accessToken) return false; // nothing written: the caller must not count it as synced
  await writePersonal(accessToken, spreadsheetId, {
    appMode: personal.appMode,
    locale: personal.locale,
    amountsHidden: personal.amountsHidden ?? true,
  });
  return true;
}
