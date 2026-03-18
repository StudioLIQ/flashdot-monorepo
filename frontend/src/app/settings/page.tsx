import type { Metadata } from "next";

import { SettingsPage } from "../../components/SettingsPage";

export const metadata: Metadata = {
  title: "Settings — FlashDot",
  description: "Customize appearance, network, and display preferences.",
};

export default function SettingsRoute(): JSX.Element {
  return <SettingsPage />;
}
