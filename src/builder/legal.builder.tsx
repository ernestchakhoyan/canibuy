import { Link } from "@i18n";
import { Logo } from "@widget";
import type { ReactNode } from "react";

// Public legal pages linked from Google's OAuth consent screen. English only: they're legal text, and Google's
// reviewers read them in English. ponytail: translate into hy/ru via messages if users ask for it.

// TODO[techdebt]: set the real contact address before publishing the OAuth app.
const CONTACT_EMAIL = "you@gmail.com";
const UPDATED = "November 23, 2026";

const Legal = ({ title, children }: { title: string; children: ReactNode }) => (
  <article className="flex flex-col gap-6 py-8 text-sm leading-relaxed [&_a]:text-primary [&_a]:underline [&_h2]:text-base [&_h2]:font-semibold [&_section]:flex [&_section]:flex-col [&_section]:gap-2 [&_ul]:list-disc [&_ul]:pl-5">
    <Link href="/connect" className="self-start no-underline!">
      <Logo />
    </Link>
    <header className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">Last updated: {UPDATED}</p>
    </header>
    {children}
    <section>
      <h2>Contact</h2>
      <p>
        Questions? Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </section>
  </article>
);

export const PrivacyBuilder = () => (
  <Legal title="Privacy Policy">
    <p>
      Canibuy is a budgeting app whose only database is a Google Sheet in your own Google Drive. This policy explains
      what the app accesses, where it is stored, and how to remove it.
    </p>
    <section>
      <h2>What the app accesses</h2>
      <ul>
        <li>
          <b>Your Google account's basic profile</b> (name, email address, profile picture), to show which account is
          connected.
        </li>
        <li>
          <b>Only the files the app creates in your Google Drive</b> (the <code>drive.file</code> permission). The app
          creates one spreadsheet for your budget and reads and writes only that spreadsheet. It cannot see any other
          file in your Drive.
        </li>
      </ul>
    </section>
    <section>
      <h2>Where your data is stored</h2>
      <ul>
        <li>
          <b>Your budget</b> (income, expenses, savings, orders, projects, settings) is stored in your spreadsheet and
          cached in your browser's local storage on your device.
        </li>
        <li>
          <b>Your sign-in</b> (Google access tokens and the spreadsheet's ID) is kept in an encrypted cookie in your
          browser. There is no server-side database: we do not keep a copy of your budget or your account.
        </li>
        <li>
          The app is hosted on Vercel, which may keep standard request logs (such as IP address and browser type) for
          security and operations.
        </li>
        <li>
          Currency exchange rates are fetched from a public rates service. Those requests contain no personal data.
        </li>
      </ul>
    </section>
    <section>
      <h2>How we use and share it</h2>
      <p>
        Your data is used only to show and update your budget. We do not sell it, share it with third parties, use it
        for advertising, or use it to train AI or machine learning models.
      </p>
      <p>
        Canibuy's use and transfer of information received from Google APIs adheres to the{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements.
      </p>
    </section>
    <section>
      <h2>Removing your data</h2>
      <ul>
        <li>
          <b>Disconnect</b> on the app's Setup page revokes the app's access to your Google account and clears the
          sign-in cookie.
        </li>
        <li>
          You can also revoke access at{" "}
          <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">
            myaccount.google.com/permissions
          </a>
          .
        </li>
        <li>Your spreadsheet stays in your Drive. Delete it there if you no longer want it.</li>
        <li>Clearing your browser's site data removes the copy on your device.</li>
      </ul>
    </section>
    <section>
      <h2>Changes</h2>
      <p>If this policy changes, the new version will be posted on this page with a new date.</p>
    </section>
  </Legal>
);

export const TermsBuilder = () => (
  <Legal title="Terms of Service">
    <p>By using Canibuy you agree to these terms.</p>
    <section>
      <h2>The service</h2>
      <p>
        Canibuy is a free budgeting tool. It creates a Google Sheet in your Google Drive and uses it to store your
        budget. You need a Google account to use it, and your use of Google's services is also subject to Google's
        terms.
      </p>
    </section>
    <section>
      <h2>Your data</h2>
      <p>
        Your budget belongs to you and lives in your own Google Drive. See the{" "}
        <Link href="/privacy">Privacy Policy</Link> for what the app accesses and how to remove it.
      </p>
    </section>
    <section>
      <h2>Not financial advice</h2>
      <p>
        The app's calculations (for example, whether you can afford a purchase, savings forecasts and currency
        conversions) are estimates based on the numbers you enter and on public exchange rates. They are not financial
        advice. Check important decisions yourself.
      </p>
    </section>
    <section>
      <h2>No warranty</h2>
      <p>
        The service is provided "as is", without warranties of any kind. It may change, be interrupted or stop at any
        time. Your spreadsheet stays in your Drive either way.
      </p>
    </section>
    <section>
      <h2>Limitation of liability</h2>
      <p>
        To the extent permitted by law, the developer is not liable for any loss arising from your use of the service,
        including lost or incorrect data or decisions made based on its calculations.
      </p>
    </section>
    <section>
      <h2>Acceptable use</h2>
      <p>Don't use the service to break the law or to interfere with its operation.</p>
    </section>
    <section>
      <h2>Changes</h2>
      <p>These terms may be updated. The new version will be posted on this page with a new date.</p>
    </section>
  </Legal>
);
