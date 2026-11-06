import Link from "next/link";
import { Credits } from "@/ui/credits/Credits";
import { t } from "@/ui/i18n";

export default function CreditsPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-amber-950 p-8">
      <div className="max-w-xl rounded-lg border border-amber-700 bg-stone-950/80 p-6">
        <Credits />
      </div>
      <Link href="/" className="text-amber-300 underline">
        {t("credits.close")}
      </Link>
    </main>
  );
}
