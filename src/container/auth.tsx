import { connectGoogleSheet, disconnectGoogle, signOutAction } from "@action";
import { auth, type ConnectError } from "@server";
import { Alert, AlertDescription, AlertTitle, Button, Card } from "@widget";
import { CheckIcon, ExternalLinkIcon, LogOutIcon, SheetIcon, TriangleAlertIcon, UnplugIcon } from "lucide-react";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";

// Server components: forms post straight to server actions, so these screens work before any JS loads.

const PROMISES = ["onlyOwnSheet", "editAnytime", "findsExisting"] as const;

export async function ConnectSheet() {
  const t = await getTranslations("auth");
  return (
    <Card>
      <p className="text-sm">{t("connect.intro")}</p>
      <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
        {PROMISES.map((key) => (
          <li key={key} className="flex gap-2">
            <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            {t(`connect.promises.${key}`)}
          </li>
        ))}
      </ul>
      <form action={connectGoogleSheet}>
        <Button type="submit" size="lg" className="w-full">
          <SheetIcon data-icon="inline-start" />
          {t("connect.button")}
        </Button>
      </form>
    </Card>
  );
}

/** Explains why the last connect attempt didn't end with a sheet (reads the session, so render inside Suspense). */
export async function ConnectStatus() {
  await connection(); // auth() uses crypto before it reads cookies; mark this as request-time first
  const error = (await auth())?.connectError;
  if (!error) return null;
  const t = await getTranslations("auth");

  return (
    <Alert variant="destructive">
      <TriangleAlertIcon />
      <AlertTitle>{t(`errors.${error.kind satisfies ConnectError}`)}</AlertTitle>
      {error.detail && (
        <AlertDescription className="break-words">{t("errors.details", { detail: error.detail })}</AlertDescription>
      )}
    </Alert>
  );
}

export async function AccountCard() {
  await connection(); // auth() uses crypto before it reads cookies; mark this as request-time first
  const session = await auth();
  if (!session?.user) return null;
  const t = await getTranslations("auth");

  return (
    <Card title={t("account.title")}>
      <p className="text-sm">
        {t.rich("account.connectedAs", {
          email: session.user.email ?? "",
          b: (chunks) => <span className="font-medium">{chunks}</span>,
        })}
      </p>
      {session.sheet && (
        <Button
          variant="secondary"
          nativeButton={false}
          // biome-ignore lint/a11y/useAnchorContent: Button renders its children into this anchor
          render={<a href={session.sheet.url} target="_blank" rel="noreferrer" />}
        >
          <ExternalLinkIcon data-icon="inline-start" />
          {t("account.openSheet")}
        </Button>
      )}
      <div className="grid grid-cols-2 gap-2">
        <form action={signOutAction}>
          <Button type="submit" variant="outline" className="w-full">
            <LogOutIcon data-icon="inline-start" />
            {t("account.signOut")}
          </Button>
        </form>
        <form action={disconnectGoogle}>
          <Button type="submit" variant="destructive" className="w-full">
            <UnplugIcon data-icon="inline-start" />
            {t("account.disconnect")}
          </Button>
        </form>
      </div>
      <p className="text-xs text-muted-foreground">{t("account.disconnectNote")}</p>
    </Card>
  );
}
