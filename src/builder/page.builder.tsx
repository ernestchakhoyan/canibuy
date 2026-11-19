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
} from "@container";
import { BudgetGate } from "@layout";
import { Card, Logo, Skeleton } from "@widget";
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

export const SetupBuilder = () => (
  <Screen>
    <Title page="setup" />
    <BudgetGate>
      <PersonalForm />
      <SettingsForm />
      <BillsEditor />
      <CategoriesEditor />
    </BudgetGate>
    <Suspense>
      <AccountCard />
    </Suspense>
  </Screen>
);

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
