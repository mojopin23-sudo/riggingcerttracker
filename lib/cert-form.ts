import { categoryTracks, type CategoryId, type CertField } from "@/lib/categories";
import type { DateStatus } from "@/lib/dates";

export type StoredDate = {
  iso: string | null;
  status: DateStatus;
  raw: string | null;
  note: string | null;
};

export function dateFromForm(
  formData: FormData,
  field: string,
  applies: boolean,
  existing: StoredDate | null,
): StoredDate {
  const markedNa = formData.get(`${field}_na`) === "on";
  const keptRaw = String(formData.get(`${field}_raw`) ?? "").trim();
  const typed = String(formData.get(field) ?? "").trim();
  const confirmed = formData.get(`${field}_confirm`) === "on";

  if (markedNa) return { iso: null, status: "na", raw: null, note: null };

  if (!typed) {
    if (existing?.status === "unparsed" && (keptRaw || existing.raw)) {
      return {
        iso: null,
        status: "unparsed",
        raw: keptRaw || existing.raw,
        note: existing.note,
      };
    }
    return { iso: null, status: applies ? "missing" : "na", raw: null, note: null };
  }

  const iso = validIso(typed);
  if (!iso) {
    return {
      iso: null,
      status: "unparsed",
      raw: typed,
      note: `Could not read “${typed}” as a date`,
    };
  }

  if (existing && existing.iso === iso && existing.status === "suspicious" && !confirmed) {
    return {
      iso: existing.iso,
      status: "suspicious",
      raw: existing.raw,
      note: existing.note,
    };
  }

  return { iso, status: "ok", raw: null, note: null };
}

export function appliesTo(category: CategoryId, field: CertField) {
  return categoryTracks(category, field);
}

function validIso(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return value;
}
