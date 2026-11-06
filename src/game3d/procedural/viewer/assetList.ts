export type AssetId = "cowboy" | "lineup" | "colt45" | "weapons" | "horse" | "props" | "saloon" | "sheriff" | "bank" | "store" | "stable" | "undertaker" | "water_tower" | "stagecoach_stop";

export const ASSET_LIST: { id: AssetId; label: string }[] = [
  { id: "cowboy", label: "Karakter" },
  { id: "lineup", label: "Barisan 16 karakter" },
  { id: "colt45", label: "Colt .45" },
  { id: "weapons", label: "Semua senjata" },
  { id: "horse", label: "Kuda" },
  { id: "props", label: "Prop" },
  { id: "saloon", label: "Saloon" },
  { id: "sheriff", label: "Sheriff & Jail" },
  { id: "bank", label: "Bank (Wells Fargo)" },
  { id: "store", label: "General Store" },
  { id: "stable", label: "Stable" },
  { id: "undertaker", label: "Undertaker" },
  { id: "water_tower", label: "Menara air" },
  { id: "stagecoach_stop", label: "Halte stagecoach" },
];
