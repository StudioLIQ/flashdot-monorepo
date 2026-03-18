import type { Metadata } from "next";

import { LoanDetailPage } from "../../../components/LoanDetailPage";

export const metadata: Metadata = {
  title: "Loan Detail — FlashDot",
};

export default function LoanDetailRoute({
  params,
}: {
  params: { id: string };
}): JSX.Element {
  return <LoanDetailPage loanId={params.id} />;
}
