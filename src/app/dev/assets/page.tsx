import type { Metadata } from "next";
import { AssetsPage } from "@/game3d/procedural/viewer/AssetsPage";

export const metadata: Metadata = { title: "Assets" };

export default function DevAssetsPage() {
  return <AssetsPage />;
}
