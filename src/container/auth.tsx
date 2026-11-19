import { connectGoogleSheet, disconnectGoogle, signOutAction } from "@action";
import { auth, type ConnectError } from "@server";
import { Alert, AlertDescription, AlertTitle, Button, Card } from "@widget";
import { CheckIcon, ExternalLinkIcon, LogOutIcon, SheetIcon, TriangleAlertIcon, UnplugIcon } from "lucide-react";
import { connection } from "next/server";

// Server components: forms post straight to server actions, so these screens work before any JS loads.

const PROMISES = [
  "The app can only see the sheet it creates, nothing else in your Drive.",
  "You can open and edit the sheet yourself at any time.",
  "If you connected before, the app finds your existing sheet instead of making a new one.",
];

export function ConnectSheet() {
  return (
    <Card>
      <p className="text-sm">
        Your budget lives in a Google Sheet in your own Drive. Nothing is stored on our servers. Google will ask you to
        let the app create that sheet.
      </p>
      <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
        {PROMISES.map((text) => (
          <li key={text} className="flex gap-2">
            <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            {text}
          </li>
        ))}
      </ul>
      <form action={connectGoogleSheet}>
        <Button type="submit" size="lg" className="w-full">
          <SheetIcon data-icon="inline-start" />
          Connect Google Sheet
        </Button>
      </form>
    </Card>
  );
}

const CONNECT_ERRORS: Record<ConnectError, string> = {
  NoDriveAccess:
    "Google didn't give the app access to Drive. On Google's screen, tick the box to let Canibuy see, edit and create the Google Drive files it uses, then try again.",
  SheetFailed:
    "You're connected, but creating your sheet failed. Check that the Google Sheets API and Google Drive API are enabled in the Google Cloud project, then try again.",
  RefreshFailed: "Your Google access expired or was revoked. Connect again to keep using your sheet.",
};

/** Explains why the last connect attempt didn't end with a sheet (reads the session, so render inside Suspense). */
export async function ConnectStatus() {
  await connection(); // auth() uses crypto before it reads cookies; mark this as request-time first
  const error = (await auth())?.connectError;
  if (!error) return null;

  return (
    <Alert variant="destructive">
      <TriangleAlertIcon />
      <AlertTitle>{CONNECT_ERRORS[error.kind]}</AlertTitle>
      {error.detail && <AlertDescription className="break-words">Details: {error.detail}</AlertDescription>}
    </Alert>
  );
}

export async function AccountCard() {
  await connection(); // auth() uses crypto before it reads cookies; mark this as request-time first
  const session = await auth();
  if (!session?.user) return null;

  return (
    <Card title="Account">
      <p className="text-sm">
        Connected as <span className="font-medium">{session.user.email}</span>
      </p>
      {session.sheet && (
        <Button
          variant="secondary"
          nativeButton={false}
          // biome-ignore lint/a11y/useAnchorContent: Button renders its children into this anchor
          render={<a href={session.sheet.url} target="_blank" rel="noreferrer" />}
        >
          <ExternalLinkIcon data-icon="inline-start" />
          Open my Google Sheet
        </Button>
      )}
      <div className="grid grid-cols-2 gap-2">
        <form action={signOutAction}>
          <Button type="submit" variant="outline" className="w-full">
            <LogOutIcon data-icon="inline-start" />
            Sign out
          </Button>
        </form>
        <form action={disconnectGoogle}>
          <Button type="submit" variant="destructive" className="w-full">
            <UnplugIcon data-icon="inline-start" />
            Disconnect
          </Button>
        </form>
      </div>
      <p className="text-xs text-muted-foreground">
        Disconnecting revokes the app's access. Your sheet stays in your Drive.
      </p>
    </Card>
  );
}
