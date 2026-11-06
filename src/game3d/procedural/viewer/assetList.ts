export type AssetId = "cowboy" | "colt45" | "saloon";

export const ASSET_LIST: { id: AssetId; label: string }[] = [
  { id: "cowboy", label: "Cowboy (master)" },
  { id: "colt45", label: "Colt .45" },
  { id: "saloon", label: "Saloon" },
];
