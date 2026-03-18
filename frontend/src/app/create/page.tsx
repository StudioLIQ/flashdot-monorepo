import type { Metadata } from "next";

import { CreateLoanPage } from "../../components/CreateLoanPage";

export const metadata: Metadata = {
  title: "Create Loan — FlashDot",
  description: "Configure vaults, amounts, and duration for your bonded flash loan.",
};

export default function CreatePage(): JSX.Element {
  return <CreateLoanPage />;
}
