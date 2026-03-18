import type { Metadata } from "next";

import { LoanHistoryPage } from "../../components/LoanHistoryPage";

export const metadata: Metadata = {
  title: "History — FlashDot",
  description: "View your completed and settled flash loan history.",
};

export default function HistoryPage(): JSX.Element {
  return <LoanHistoryPage />;
}
