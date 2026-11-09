import type { Metadata } from "next";
import Link from "next/link";
import { Msg } from "@/ui/i18n/Msg";
import { SettingsPanel } from "@/ui/settings/SettingsPanel";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-6 bg-amber-950 p-8">
      <div className="w-full max-w-md rounded-lg border border-amber-700 bg-stone-950/80 p-6">
        <h1 className="mb-4 text-2xl font-bold tracking-widest text-amber-400 uppercase">
          <Msg k="settings.title" />
        </h1>
        <SettingsPanel />
      </div>
      <Link href="/" data-testid="settings-back" className="text-amber-300 underline">
        <Msg k="settings.back" />
      </Link>
    </main>
  );
}
