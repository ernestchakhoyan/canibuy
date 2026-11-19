import {
  AccountCard,
  BillsEditor,
  CategoriesEditor,
  ConnectSheet,
  ConnectStatus,
  ExpenseForm,
  History,
  IncomeForm,
  IncomeList,
  MonthExpenses,
  MonthOverview,
  OrderForm,
  OrderList,
  ProjectForm,
  ProjectList,
  SavingsForm,
  SavingsHistory,
  SavingsOverview,
  SettingsForm,
} from "@container";
import { BudgetGate } from "@layout";
import { Brand } from "@widget";
import { type ReactNode, Suspense } from "react";

// One builder per route: each page in src/app renders its builder, which composes the containers.

const Page = ({ title, children }: { title: string; children: ReactNode }) => (
  <>
    <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
    <BudgetGate>{children}</BudgetGate>
  </>
);

export const MonthBuilder = () => (
  <Page title="This month">
    <MonthOverview />
    <ExpenseForm />
    <MonthExpenses />
  </Page>
);

export const IncomeBuilder = () => (
  <Page title="Income">
    <IncomeForm />
    <IncomeList />
  </Page>
);

export const SavingsBuilder = () => (
  <Page title="Savings">
    <SavingsOverview />
    <SavingsForm />
    <SavingsHistory />
  </Page>
);

export const OrdersBuilder = () => (
  <Page title="Orders">
    <OrderForm />
    <OrderList />
  </Page>
);

export const ProjectsBuilder = () => (
  <Page title="Projects">
    <ProjectForm />
    <ProjectList />
  </Page>
);

export const HistoryBuilder = () => (
  <Page title="History">
    <History />
  </Page>
);

export const SetupBuilder = () => (
  <>
    <Page title="Setup">
      <SettingsForm />
      <BillsEditor />
      <CategoriesEditor />
    </Page>
    <Suspense>
      <AccountCard />
    </Suspense>
  </>
);

export const ConnectBuilder = () => (
  <div className="flex flex-1 flex-col justify-center gap-8 py-12">
    <div className="flex flex-col gap-4">
      <Brand size="lg" />
      <h1 className="text-4xl font-semibold tracking-tight text-balance">
        How much can I save this month, and <span className="text-primary">can I afford this?</span>
      </h1>
    </div>
    <Suspense>
      <ConnectStatus />
    </Suspense>
    <ConnectSheet />
  </div>
);
