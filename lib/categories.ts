export const CATEGORIES = [
  {
    id: "winch_truck",
    label: "Winch trucks",
    short: "Winch",
    fields: ["registration", "state_inspection"],
    lines: true,
    slickBack: true,
  },
  {
    id: "crane",
    label: "Cranes",
    short: "Crane",
    fields: ["annual"],
    lines: true,
    slickBack: false,
  },
  {
    id: "forklift",
    label: "Forklifts",
    short: "Forklift",
    fields: ["annual"],
    lines: false,
    slickBack: false,
  },
  {
    id: "tandem_pole",
    label: "Tandem pole trucks",
    short: "Tandem",
    fields: ["registration", "state_inspection"],
    lines: true,
    slickBack: false,
  },
  {
    id: "pickup",
    label: "Pickups",
    short: "Pickup",
    fields: ["registration", "state_inspection"],
    lines: false,
    slickBack: false,
  },
  {
    id: "trailer",
    label: "Trailers",
    short: "Trailer",
    fields: ["registration", "state_inspection"],
    lines: false,
    slickBack: false,
  },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];
export type CertField = "registration" | "state_inspection" | "annual";

export const CERT_FIELDS: { id: CertField; label: string; short: string }[] = [
  { id: "registration", label: "Registration", short: "Registration" },
  { id: "state_inspection", label: "State inspection", short: "State inspection" },
  { id: "annual", label: "Annual inspection", short: "Annual" },
];

export function categoryById(id: string) {
  return CATEGORIES.find((category) => category.id === id) ?? null;
}

export function categoryTracks(id: CategoryId, field: CertField) {
  const fields: readonly string[] = categoryById(id)?.fields ?? [];
  return fields.includes(field);
}

export function categoryExpectsLines(id: CategoryId) {
  return categoryById(id)?.lines ?? false;
}

export function fieldLabel(field: CertField) {
  return CERT_FIELDS.find((item) => item.id === field)?.label ?? field;
}
