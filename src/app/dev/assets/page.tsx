import type { Metadata } from "next";
import { AssetsPage } from "@/game3d/procedural/viewer/AssetsPage";
import { devOnly } from "@/lib/devOnly";

export const metadata: Metadata = { title: "Assets" };

export default function DevAssetsPage() {
  devOnly();
  return <AssetsPage />;
}
