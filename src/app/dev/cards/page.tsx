import type { Metadata } from "next";
import { CardGallery } from "@/game3d/cards/CardGallery";

export const metadata: Metadata = { title: "Cards" };

export default function DevCardsPage() {
  return <CardGallery />;
}
