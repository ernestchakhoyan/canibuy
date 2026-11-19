import { connectGoogleSheet, disconnectGoogle, signOutAction } from "@action";
import { auth, type ConnectError } from "@server";
import { Card } from "@widget";
import { connection } from "next/server";

// Server components: forms post straight to server actions, so these screens work before any JS loads.

export function ConnectSheet() {
  return (
    <Card>
      <p className="text-sm">
        Your budget lives in a Google Sheet in your own Drive. Nothing is stored on our servers. Google will ask you to
        let the app create that sheet.
      </p>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
        <li>The app can only see the sheet it creates, nothing else in your Drive.</li>
        <li>You can open and edit the sheet yourself at any time.</li>
        <li>If you connected before, the app finds your existing sheet instead of making a new one.</li>
      </ul>
      <form action={connectGoogleSheet}>
        <button type="submit" className="btn btn-primary w-full">
          Connect Google Sheet
        </button>
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
    <div role="alert" className="flex flex-col gap-1 rounded-2xl border border-negative p-4 text-sm">
      <p className="font-medium text-negative">{CONNECT_ERRORS[error.kind]}</p>
      {error.detail && <p className="break-words text-xs text-muted">Details: {error.detail}</p>}
    </div>
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
        <a href={session.sheet.url} target="_blank" rel="noreferrer" className="btn">
          Open my Google Sheet
        </a>
      )}
      <div className="grid grid-cols-2 gap-2">
        <form action={signOutAction}>
          <button type="submit" className="btn w-full">
            Sign out
          </button>
        </form>
        <form action={disconnectGoogle}>
          <button type="submit" className="btn w-full text-negative">
            Disconnect Google
          </button>
        </form>
      </div>
      <p className="text-xs text-muted">Disconnecting revokes the app's access. Your sheet stays in your Drive.</p>
    </Card>
  );
}
