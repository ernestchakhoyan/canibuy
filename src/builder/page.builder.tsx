import {
  AccountCard,
  BillsEditor,
  CategoriesEditor,
  ConnectSheet,
  ConnectStatus,
  History,
  IncomeForm,
  IncomeList,
  MonthExpenses,
  MonthOverview,
  OrderForm,
  OrderList,
  PersonalForm,
  ProjectDetails,
  ProjectList,
  SavingsAccounts,
  SavingsForm,
  SavingsOverview,
  SettingsForm,
  StartOver,
} from "@container";
import { Link } from "@i18n";
import { BudgetGate } from "@layout";
import { Card, Logo, Skeleton } from "@widget";
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  PaletteIcon,
  ReceiptIcon,
  TagsIcon,
  UserRoundIcon,
  WalletIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { type ReactNode, Suspense, ViewTransition } from "react";

// One builder per route: each page in src/app renders its builder, which composes the containers.

/**
 * Route cross-fade (CSS in globals.css). It lives here, not in a layout: layouts persist across navigations, so
 * enter/exit never fire there. Cache Components hides visited pages in <Activity>, which also counts as enter/exit.
 */
const Screen = ({ children }: { children: ReactNode }) => (
  <ViewTransition enter="page-enter" exit="page-exit" default="none">
    {children}
  </ViewTransition>
);

const ProjectSkeleton = () => (
  <>
    <Skeleton className="h-8 w-1/2 motion-reduce:animate-none" />
    <Card>
      <Skeleton className="h-2 w-full motion-reduce:animate-none" />
      <Skeleton className="h-11 w-full motion-reduce:animate-none" />
    </Card>
  </>
);

type PageKey = "month" | "income" | "savings" | "orders" | "projects" | "history" | "setup";

/** Page heading, translated from the `pages` namespace (same keys as the tab titles in each page.tsx). */
const Title = async ({ page }: { page: PageKey }) => (
  <h1 className="text-2xl font-semibold tracking-tight">{(await getTranslations("pages"))(page)}</h1>
);

const Page = ({ title, children }: { title: PageKey; children: ReactNode }) => (
  <Screen>
    <Title page={title} />
    <BudgetGate>{children}</BudgetGate>
  </Screen>
);

export const MonthBuilder = () => (
  <Page title="month">
    <MonthOverview />
    <MonthExpenses />
  </Page>
);

export const IncomeBuilder = () => (
  <Page title="income">
    <IncomeForm />
    <IncomeList />
  </Page>
);

export const SavingsBuilder = () => (
  <Page title="savings">
    <SavingsOverview />
    <SavingsAccounts />
    <SavingsForm />
  </Page>
);

export const OrdersBuilder = () => (
  <Page title="orders">
    <OrderForm />
    <OrderList />
  </Page>
);

export const ProjectsBuilder = () => (
  <Page title="projects">
    <ProjectList />
  </Page>
);

/**
 * /projects/[id]. The id is only known at request time and the project lives in the browser's budget, so the client
 * container reads it with `useParams`, which suspends during prerendering: hence the Suspense boundary.
 */
export const ProjectBuilder = () => (
  <Screen>
    <BudgetGate>
      <Suspense fallback={<ProjectSkeleton />}>
        <ProjectDetails />
      </Suspense>
    </BudgetGate>
  </Screen>
);

export const HistoryBuilder = () => (
  <Page title="history">
    <History />
  </Page>
);

/** Settings sections: one page each under /setup, listed on /setup. */
const SETUP_SECTIONS = [
  { key: "personal", icon: PaletteIcon },
  { key: "money", icon: WalletIcon },
  { key: "bills", icon: ReceiptIcon },
  { key: "categories", icon: TagsIcon },
  { key: "account", icon: UserRoundIcon },
] as const;
export type SetupSection = (typeof SETUP_SECTIONS)[number]["key"];

/** /setup: the list of sections. */
export const SetupBuilder = async () => {
  const t = await getTranslations("setupSections");
  return (
    <Screen>
      <Title page="setup" />
      <nav aria-label={t("label")}>
        <ul className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          {SETUP_SECTIONS.map(({ key, icon: Icon }) => (
            <li key={key}>
              <Link
                href={`/setup/${key}`}
                className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                  <Icon className="size-4.5" aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-semibold">{t(`${key}.title`)}</span>
                  <span className="truncate text-xs text-muted-foreground">{t(`${key}.hint`)}</span>
                </span>
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </Screen>
  );
};

/** A section's cards. Single-card sections hide the card's own title: the page heading already says it. */
const SECTION_CONTENT: Record<SetupSection, ReactNode> = {
  personal: <PersonalForm />,
  money: <SettingsForm />,
  bills: <BillsEditor />,
  categories: <CategoriesEditor />,
  account: null, // rendered below: the account card loads outside BudgetGate
};

/** /setup/<section>: back to the list, the section's heading, its cards. */
export const SetupSectionBuilder = async ({ section }: { section: SetupSection }) => {
  const t = await getTranslations("setupSections");
  return (
    <Screen>
      <Link href="/setup" className="flex min-h-11 items-center gap-1 self-start text-sm text-muted-foreground">
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        {t("back")}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{t(`${section}.title`)}</h1>
      {section === "account" ? (
        <>
          <Suspense>
            <AccountCard />
          </Suspense>
          <StartOver />
        </>
      ) : (
        <div className="[&_[data-slot=card-header]:not(:has([data-slot=card-action]))]:hidden [&_[data-slot=card-title]]:hidden">
          <BudgetGate>{SECTION_CONTENT[section]}</BudgetGate>
        </div>
      )}
    </Screen>
  );
};

const ConnectHeadline = async () => {
  const t = await getTranslations("connect");
  return (
    <h1 className="text-4xl font-semibold tracking-tight text-balance">
      {t.rich("headline", { em: (chunks) => <span className="text-primary">{chunks}</span> })}
    </h1>
  );
};

export const ConnectBuilder = () => (
  <Screen>
    <div className="flex flex-1 flex-col justify-center gap-8 py-12">
      <div className="flex flex-col gap-4">
        <Logo size="lg" />
        <ConnectHeadline />
      </div>
      <Suspense>
        <ConnectStatus />
      </Suspense>
      <ConnectSheet />
    </div>
  </Screen>
);
