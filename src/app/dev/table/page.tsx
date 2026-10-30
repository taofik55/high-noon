import type { Metadata } from "next";
import { t } from "@/ui/i18n";
import { DevTable } from "@/ui/table/DevTable";

export const metadata: Metadata = {
  title: t("table.title"),
};

export default function DevTablePage() {
  return <DevTable />;
}
