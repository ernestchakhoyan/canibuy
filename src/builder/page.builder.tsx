import {
  BillsEditor,
  CategoriesEditor,
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
import type { ReactNode } from "react";

// One builder per route: each page in src/app renders its builder, which composes the containers.

const Page = ({ title, children }: { title: string; children: ReactNode }) => (
  <>
    <h1 className="text-2xl font-semibold">{title}</h1>
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
  <Page title="Setup">
    <SettingsForm />
    <BillsEditor />
    <CategoriesEditor />
  </Page>
);
