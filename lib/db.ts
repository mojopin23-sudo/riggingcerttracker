import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { CategoryId, CertField } from "@/lib/categories";
import type { DateStatus } from "@/lib/dates";

export type Unit = {
  id: string;
  number: string;
  category: CategoryId;
  plate: string | null;
  slickBack: boolean;
  registrationExp: string | null;
  registrationRaw: string | null;
  registrationStatus: DateStatus;
  registrationNote: string | null;
  stateInspectionExp: string | null;
  stateInspectionRaw: string | null;
  stateInspectionStatus: DateStatus;
  stateInspectionNote: string | null;
  annualExp: string | null;
  annualRaw: string | null;
  annualStatus: DateStatus;
  annualNote: string | null;
  notes: string;
  sourceSheet: string | null;
  sourceRow: number | null;
  createdAt: string;
  updatedAt: string;
};

export type Component = {
  id: string;
  unitId: string;
  label: string;
  serial: string | null;
  size: string | null;
  expiration: string | null;
  expirationRaw: string | null;
  expirationStatus: DateStatus;
  expirationNote: string | null;
  notes: string;
  sortOrder: number;
  sourceRow: number | null;
  createdAt: string;
  updatedAt: string;
};

export type CertKind = CertField | "line";

export type StoredDocument = {
  id: string;
  unitId: string;
  componentId: string | null;
  certKind: CertKind;
  originalName: string;
  storedName: string;
  mime: string;
  sizeBytes: number;
  createdAt: string;
};

export type ImportIssue = {
  id: string;
  sheet: string;
  rowNumber: number | null;
  unitNumber: string | null;
  field: string | null;
  rawValue: string | null;
  severity: "error" | "warning" | "cleaned";
  message: string;
  createdAt: string;
};

type UnitRow = {
  id: string;
  number: string;
  category: CategoryId;
  plate: string | null;
  slick_back: number;
  registration_exp: string | null;
  registration_raw: string | null;
  registration_status: DateStatus;
  registration_note: string | null;
  state_inspection_exp: string | null;
  state_inspection_raw: string | null;
  state_inspection_status: DateStatus;
  state_inspection_note: string | null;
  annual_exp: string | null;
  annual_raw: string | null;
  annual_status: DateStatus;
  annual_note: string | null;
  notes: string;
  source_sheet: string | null;
  source_row: number | null;
  created_at: string;
  updated_at: string;
};

type ComponentRow = {
  id: string;
  unit_id: string;
  label: string;
  serial: string | null;
  size: string | null;
  expiration: string | null;
  expiration_raw: string | null;
  expiration_status: DateStatus;
  expiration_note: string | null;
  notes: string;
  sort_order: number;
  source_row: number | null;
  created_at: string;
  updated_at: string;
};

type DocumentRow = {
  id: string;
  unit_id: string;
  component_id: string | null;
  cert_kind: CertKind;
  original_name: string;
  stored_name: string;
  mime: string;
  size_bytes: number;
  created_at: string;
};

type IssueRow = {
  id: string;
  sheet: string;
  row_number: number | null;
  unit_number: string | null;
  field: string | null;
  raw_value: string | null;
  severity: "error" | "warning" | "cleaned";
  message: string;
  created_at: string;
};

const globalDb = globalThis as unknown as { __rrDb?: Database.Database };

export function dataDir() {
  const dir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, "uploads"), { recursive: true });
  return dir;
}

export function uploadPath(storedName: string) {
  return path.join(dataDir(), "uploads", storedName);
}

export function openDatabase(file: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

export function getDb() {
  if (!globalDb.__rrDb) {
    globalDb.__rrDb = openDatabase(path.join(dataDir(), "rigrunner.db"));
  }
  return globalDb.__rrDb;
}

export function closeDb() {
  if (globalDb.__rrDb) {
    globalDb.__rrDb.close();
    globalDb.__rrDb = undefined;
  }
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS units (
      id TEXT PRIMARY KEY,
      number TEXT NOT NULL,
      category TEXT NOT NULL,
      plate TEXT,
      slick_back INTEGER NOT NULL DEFAULT 0,
      registration_exp TEXT,
      registration_raw TEXT,
      registration_status TEXT NOT NULL,
      registration_note TEXT,
      state_inspection_exp TEXT,
      state_inspection_raw TEXT,
      state_inspection_status TEXT NOT NULL,
      state_inspection_note TEXT,
      annual_exp TEXT,
      annual_raw TEXT,
      annual_status TEXT NOT NULL,
      annual_note TEXT,
      notes TEXT NOT NULL DEFAULT '',
      source_sheet TEXT,
      source_row INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(category, number)
    );

    CREATE TABLE IF NOT EXISTS components (
      id TEXT PRIMARY KEY,
      unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      serial TEXT,
      size TEXT,
      expiration TEXT,
      expiration_raw TEXT,
      expiration_status TEXT NOT NULL,
      expiration_note TEXT,
      notes TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      source_row INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
      component_id TEXT REFERENCES components(id) ON DELETE CASCADE,
      cert_kind TEXT NOT NULL,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS import_issues (
      id TEXT PRIMARY KEY,
      sheet TEXT NOT NULL,
      row_number INTEGER,
      unit_number TEXT,
      field TEXT,
      raw_value TEXT,
      severity TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_components_unit ON components(unit_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_documents_unit ON documents(unit_id);
    CREATE INDEX IF NOT EXISTS idx_documents_component ON documents(component_id);
  `);
}

export function mapUnit(row: UnitRow): Unit {
  return {
    id: row.id,
    number: row.number,
    category: row.category,
    plate: row.plate,
    slickBack: row.slick_back === 1,
    registrationExp: row.registration_exp,
    registrationRaw: row.registration_raw,
    registrationStatus: row.registration_status,
    registrationNote: row.registration_note,
    stateInspectionExp: row.state_inspection_exp,
    stateInspectionRaw: row.state_inspection_raw,
    stateInspectionStatus: row.state_inspection_status,
    stateInspectionNote: row.state_inspection_note,
    annualExp: row.annual_exp,
    annualRaw: row.annual_raw,
    annualStatus: row.annual_status,
    annualNote: row.annual_note,
    notes: row.notes,
    sourceSheet: row.source_sheet,
    sourceRow: row.source_row,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapComponent(row: ComponentRow): Component {
  return {
    id: row.id,
    unitId: row.unit_id,
    label: row.label,
    serial: row.serial,
    size: row.size,
    expiration: row.expiration,
    expirationRaw: row.expiration_raw,
    expirationStatus: row.expiration_status,
    expirationNote: row.expiration_note,
    notes: row.notes,
    sortOrder: row.sort_order,
    sourceRow: row.source_row,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDocument(row: DocumentRow): StoredDocument {
  return {
    id: row.id,
    unitId: row.unit_id,
    componentId: row.component_id,
    certKind: row.cert_kind,
    originalName: row.original_name,
    storedName: row.stored_name,
    mime: row.mime,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
  };
}

function mapIssue(row: IssueRow): ImportIssue {
  return {
    id: row.id,
    sheet: row.sheet,
    rowNumber: row.row_number,
    unitNumber: row.unit_number,
    field: row.field,
    rawValue: row.raw_value,
    severity: row.severity,
    message: row.message,
    createdAt: row.created_at,
  };
}

export function countUnits(db: Database.Database) {
  const row = db.prepare("SELECT COUNT(*) AS n FROM units").get() as { n: number };
  return row.n;
}

export function listUnits(db = getDb()) {
  return (db.prepare("SELECT * FROM units").all() as UnitRow[]).map(mapUnit);
}

export function listComponents(db = getDb()) {
  return (
    db.prepare("SELECT * FROM components ORDER BY sort_order, rowid").all() as ComponentRow[]
  ).map(mapComponent);
}

export function listDocuments(db = getDb()) {
  return (
    db.prepare("SELECT * FROM documents ORDER BY created_at").all() as DocumentRow[]
  ).map(mapDocument);
}

export function listImportIssues(db = getDb()) {
  return (
    db.prepare("SELECT * FROM import_issues ORDER BY severity, sheet, row_number").all() as IssueRow[]
  ).map(mapIssue);
}

export function getUnit(id: string, db = getDb()) {
  const row = db.prepare("SELECT * FROM units WHERE id = ?").get(id) as UnitRow | undefined;
  return row ? mapUnit(row) : null;
}

export function getComponentsForUnit(unitId: string, db = getDb()) {
  return (
    db
      .prepare("SELECT * FROM components WHERE unit_id = ? ORDER BY sort_order, rowid")
      .all(unitId) as ComponentRow[]
  ).map(mapComponent);
}

export function getComponent(id: string, db = getDb()) {
  const row = db.prepare("SELECT * FROM components WHERE id = ?").get(id) as ComponentRow | undefined;
  return row ? mapComponent(row) : null;
}

export function getDocumentsForUnit(unitId: string, db = getDb()) {
  return (
    db
      .prepare("SELECT * FROM documents WHERE unit_id = ? ORDER BY created_at")
      .all(unitId) as DocumentRow[]
  ).map(mapDocument);
}

export function getDocument(id: string, db = getDb()) {
  const row = db.prepare("SELECT * FROM documents WHERE id = ?").get(id) as DocumentRow | undefined;
  return row ? mapDocument(row) : null;
}

export function findUnitByNumber(category: CategoryId, number: string, db = getDb()) {
  const row = db
    .prepare("SELECT * FROM units WHERE category = ? AND number = ?")
    .get(category, number) as UnitRow | undefined;
  return row ? mapUnit(row) : null;
}

export function fieldColumns(field: CertField) {
  if (field === "registration") {
    return {
      exp: "registrationExp",
      raw: "registrationRaw",
      status: "registrationStatus",
      note: "registrationNote",
    } as const;
  }
  if (field === "state_inspection") {
    return {
      exp: "stateInspectionExp",
      raw: "stateInspectionRaw",
      status: "stateInspectionStatus",
      note: "stateInspectionNote",
    } as const;
  }
  return {
    exp: "annualExp",
    raw: "annualRaw",
    status: "annualStatus",
    note: "annualNote",
  } as const;
}
