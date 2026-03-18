import type { Metadata } from "next";

import { ActiveLoansPage } from "../../components/ActiveLoansPage";

export const metadata: Metadata = {
  title: "Active Loans — FlashDot",
  description: "Monitor and manage your active bonded flash loans.",
};

export default function LoansPage(): JSX.Element {
  return <ActiveLoansPage />;
}
