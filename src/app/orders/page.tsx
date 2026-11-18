import { OrdersBuilder } from "@builder";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Orders" };

export default function Page() {
  return <OrdersBuilder />;
}
