import type { Metadata } from "next";
import { CardGallery } from "@/game3d/cards/CardGallery";
import { devOnly } from "@/lib/devOnly";

export const metadata: Metadata = { title: "Cards" };

export default function DevCardsPage() {
  devOnly();
  return <CardGallery />;
}
