import { categoryExpectsLines, fieldLabel, type CategoryId, type CertField } from "@/lib/categories";
import type { Component, Unit } from "@/lib/db";
import { daysUntil, formatDate, todayISO, type DateStatus } from "@/lib/dates";

export type AttentionBucket =
  | "expired"
  | "d30"
  | "d60"
  | "d90"
  | "ok"
  | "missing"
  | "review"
  | "na";

export type AttentionItem = {
  key: string;
  unitId: string;
  unitNumber: string;
  category: CategoryId;
  plate: string | null;
  kind: CertField | "line" | "no_lines";
  label: string;
  detail: string | null;
  componentId?: string;
  date: string | null;
  raw: string | null;
  note: string | null;
  status: DateStatus;
  bucket: AttentionBucket;
  days: number | null;
};

const FIELD_KEYS: CertField[] = ["registration", "state_inspection", "annual"];

export function buildAttention(units: Unit[], components: Component[], today = todayISO()) {
  const byUnit = new Map<string, Component[]>();
  for (const component of components) {
    const list = byUnit.get(component.unitId) ?? [];
    list.push(component);
    byUnit.set(component.unitId, list);
  }

  const items: AttentionItem[] = [];
  for (const unit of units) {
    for (const field of FIELD_KEYS) {
      const record = readField(unit, field);
      if (record.status === "na") continue;
      items.push({
        key: `${unit.id}:${field}`,
        unitId: unit.id,
        unitNumber: unit.number,
        category: unit.category,
        plate: unit.plate,
        kind: field,
        label: fieldLabel(field),
        detail: null,
        date: record.exp,
        raw: record.raw,
        note: record.note,
        status: record.status,
        ...placement(record.status, record.exp, today),
      });
    }

    const lines = byUnit.get(unit.id) ?? [];
    for (const line of lines) {
      const detail = [line.serial, line.size].filter(Boolean).join(" · ") || null;
      items.push({
        key: line.id,
        unitId: unit.id,
        unitNumber: unit.number,
        category: unit.category,
        plate: unit.plate,
        kind: "line",
        label: line.label,
        detail,
        componentId: line.id,
        date: line.expiration,
        raw: line.expirationRaw,
        note: line.expirationNote,
        status: line.expirationStatus,
        ...placement(line.expirationStatus, line.expiration, today),
      });
    }

    if (categoryExpectsLines(unit.category) && !unit.slickBack && lines.length === 0) {
      items.push({
        key: `${unit.id}:no-lines`,
        unitId: unit.id,
        unitNumber: unit.number,
        category: unit.category,
        plate: unit.plate,
        kind: "no_lines",
        label: "Lines & slings",
        detail: "Nothing on file",
        date: null,
        raw: null,
        note: null,
        status: "missing",
        bucket: "missing",
        days: null,
      });
    }
  }

  items.sort((a, b) => {
    const rank = bucketRank(a.bucket) - bucketRank(b.bucket);
    if (rank !== 0) return rank;
    const dayA = a.days ?? 9_999;
    const dayB = b.days ?? 9_999;
    if (dayA !== dayB) return dayA - dayB;
    return a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true });
  });
  return items;
}

export function matchesWindow(item: AttentionItem, window: string) {
  switch (window) {
    case "expired":
      return item.bucket === "expired";
    case "d30":
      return item.bucket === "d30";
    case "d60":
      return item.bucket === "d30" || item.bucket === "d60";
    case "d90":
      return item.bucket === "d30" || item.bucket === "d60" || item.bucket === "d90";
    case "missing":
      return item.bucket === "missing" || item.status === "unparsed";
    case "review":
      return item.status === "unparsed" || item.status === "suspicious" || item.bucket === "review";
    case "urgent":
      return item.bucket === "expired" || item.bucket === "d30" || item.status === "unparsed";
    case "current":
      return item.bucket === "ok";
    case "all":
      return item.bucket !== "na";
    default:
      return item.bucket === "expired" || item.bucket === "d30" || item.status === "unparsed";
  }
}

function placement(status: DateStatus, iso: string | null, today: string) {
  if (status === "na") return { bucket: "na" as const, days: null };
  if (status === "unparsed") return { bucket: "missing" as const, days: null };
  if (status === "missing") return { bucket: "missing" as const, days: null };
  if (status === "suspicious") return { bucket: "review" as const, days: iso ? daysUntil(iso, today) : null };
  if (!iso) return { bucket: "missing" as const, days: null };
  const days = daysUntil(iso, today);
  if (days < 0) return { bucket: "expired" as const, days };
  if (days <= 30) return { bucket: "d30" as const, days };
  if (days <= 60) return { bucket: "d60" as const, days };
  if (days <= 90) return { bucket: "d90" as const, days };
  return { bucket: "ok" as const, days };
}

function bucketRank(bucket: AttentionBucket) {
  switch (bucket) {
    case "expired":
      return 0;
    case "missing":
      return 1;
    case "review":
      return 2;
    case "d30":
      return 3;
    case "d60":
      return 4;
    case "d90":
      return 5;
    default:
      return 6;
  }
}

function readField(unit: Unit, field: CertField) {
  if (field === "registration") {
    return {
      exp: unit.registrationExp,
      raw: unit.registrationRaw,
      status: unit.registrationStatus,
      note: unit.registrationNote,
    };
  }
  if (field === "state_inspection") {
    return {
      exp: unit.stateInspectionExp,
      raw: unit.stateInspectionRaw,
      status: unit.stateInspectionStatus,
      note: unit.stateInspectionNote,
    };
  }
  return {
    exp: unit.annualExp,
    raw: unit.annualRaw,
    status: unit.annualStatus,
    note: unit.annualNote,
  };
}

export function worstItem(items: AttentionItem[]) {
  return items[0] ?? null;
}

export function describeWhen(item: AttentionItem) {
  if (item.kind === "no_lines") return "No lines or slings on file";
  if (item.status === "unparsed") return `Couldn't read “${item.raw ?? "the sheet value"}”`;
  if (item.status === "suspicious") return `Check this date · ${formatDate(item.date)}`;
  if (item.status === "missing" || !item.date) return "No date on file";
  if (item.days == null) return formatDate(item.date);
  if (item.days < 0) {
    const count = Math.abs(item.days);
    return `${formatDate(item.date)} · ${count} day${count === 1 ? "" : "s"} overdue`;
  }
  if (item.days === 0) return `${formatDate(item.date)} · due today`;
  return `${formatDate(item.date)} · ${item.days} day${item.days === 1 ? "" : "s"} left`;
}

export function bucketLabel(bucket: AttentionBucket) {
  switch (bucket) {
    case "expired":
      return "Overdue";
    case "d30":
      return "30 days";
    case "d60":
      return "60 days";
    case "d90":
      return "90 days";
    case "missing":
      return "Missing";
    case "review":
      return "Check";
    case "ok":
      return "Current";
    default:
      return "N/A";
  }
}
