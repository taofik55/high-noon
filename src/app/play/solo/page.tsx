import type { Metadata } from "next";
import { t } from "@/ui/i18n";
import { SoloGame } from "@/ui/solo/SoloGame";

export const metadata: Metadata = {
  title: t("solo.title"),
};

export default function SoloPage() {
  return <SoloGame />;
}
