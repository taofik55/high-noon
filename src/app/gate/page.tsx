import type { Metadata } from "next";
import { Suspense } from "react";
import { t } from "@/ui/i18n";
import { GateForm } from "@/ui/auth/GateForm";

export const metadata: Metadata = { title: t("gate.title") };

export default function GatePage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-amber-950 p-6 text-amber-50">
      {/* useSearchParams needs a Suspense boundary with Cache Components. */}
      <Suspense>
        <GateForm />
      </Suspense>
    </main>
  );
}
