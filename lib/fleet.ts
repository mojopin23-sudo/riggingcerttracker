import { buildAttention, type AttentionItem } from "@/lib/attention";
import { categoryById, type CategoryId } from "@/lib/categories";
import {
  getComponentsForUnit,
  getDb,
  getDocumentsForUnit,
  getUnit,
  listComponents,
  listDocuments,
  listImportIssues,
  listUnits,
  type Component,
  type StoredDocument,
  type Unit,
} from "@/lib/db";
import { todayISO } from "@/lib/dates";

export function loadFleet() {
  const db = getDb();
  const units = listUnits(db).sort((a, b) =>
    a.number.localeCompare(b.number, undefined, { numeric: true }),
  );
  const components = listComponents(db);
  const documents = listDocuments(db);
  const today = todayISO();
  const attention = buildAttention(units, components, today);
  return { units, components, documents, attention, today };
}

export function loadUnit(id: string) {
  const db = getDb();
  const unit = getUnit(id, db);
  if (!unit) return null;
  return {
    unit,
    components: getComponentsForUnit(id, db),
    documents: getDocumentsForUnit(id, db),
    today: todayISO(),
  };
}

export function componentsByUnit(components: Component[]) {
  const map = new Map<string, Component[]>();
  for (const component of components) {
    const list = map.get(component.unitId) ?? [];
    list.push(component);
    map.set(component.unitId, list);
  }
  return map;
}

export function documentsByTarget(documents: StoredDocument[]) {
  const map = new Map<string, StoredDocument[]>();
  for (const document of documents) {
    const key = document.componentId ? `line:${document.componentId}` : `unit:${document.unitId}:${document.certKind}`;
    const list = map.get(key) ?? [];
    list.push(document);
    map.set(key, list);
  }
  return map;
}

export function unitMatchesQuery(unit: Unit, components: Component[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    unit.number,
    unit.plate ?? "",
    unit.notes,
    categoryById(unit.category)?.label ?? "",
    ...components.flatMap((component) => [component.label, component.serial ?? "", component.size ?? ""]),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function filterCategory(value: string | undefined): CategoryId | "all" {
  if (!value || value === "all") return "all";
  return categoryById(value) ? (value as CategoryId) : "all";
}

export function attentionForUnit(items: AttentionItem[], unitId: string) {
  return items.filter((item) => item.unitId === unitId);
}

export function importLog() {
  return listImportIssues();
}
