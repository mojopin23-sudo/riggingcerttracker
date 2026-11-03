import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import type Database from "better-sqlite3";
import { categoryTracks, type CategoryId, type CertField } from "@/lib/categories";
import {
  collapseSpace,
  isBlank,
  isSlickBack,
  parseCertDate,
  textValue,
  type ParsedDate,
} from "@/lib/dates";
import { uploadPath } from "@/lib/db";
import fs from "node:fs";

export type ImportIssueDraft = {
  sheet: string;
  rowNumber: number | null;
  unitNumber: string | null;
  field: string | null;
  rawValue: string | null;
  severity: "error" | "warning" | "cleaned";
  message: string;
};

export type ParsedComponent = {
  label: string;
  serial: string | null;
  size: string | null;
  expiration: ParsedDate;
  sourceRow: number;
  sortOrder: number;
};

export type ParsedUnit = {
  number: string;
  category: CategoryId;
  plate: string | null;
  slickBack: boolean;
  registration: ParsedDate;
  stateInspection: ParsedDate;
  annual: ParsedDate;
  notes: string;
  sourceSheet: string;
  sourceRow: number;
  components: ParsedComponent[];
};

export type ImportReport = {
  units: number;
  components: number;
  issues: ImportIssueDraft[];
  byCategory: Record<string, { units: number; components: number }>;
};

type SheetConfig = {
  category: CategoryId;
  unit: {
    number: number;
    registration?: number;
    plate?: number;
    stateInspection?: number;
    annual?: number;
  };
  line?: {
    label: number;
    serial: number;
    expiration: number;
    size: number;
    plate?: number;
  };
};

const SHEETS: Record<string, SheetConfig> = {
  "winch trucks": {
    category: "winch_truck",
    unit: { number: 1, registration: 2, plate: 3, stateInspection: 4 },
    line: { serial: 5, expiration: 6, size: 7, label: 8 },
  },
  crane: {
    category: "crane",
    unit: { number: 1, annual: 2 },
    line: { label: 3, serial: 4, expiration: 5, size: 6 },
  },
  forklift: {
    category: "forklift",
    unit: { number: 1, annual: 2 },
  },
  "tandem pole trucks": {
    category: "tandem_pole",
    unit: { number: 1, registration: 2, stateInspection: 3 },
    line: { label: 4, serial: 5, expiration: 6, size: 7, plate: 2 },
  },
  pickups: {
    category: "pickup",
    unit: { number: 1, registration: 2, stateInspection: 3 },
  },
  trailers: {
    category: "trailer",
    unit: { number: 1, registration: 2, plate: 3, stateInspection: 4 },
  },
};

const naDate = (): ParsedDate => ({ iso: null, status: "na", raw: null, note: null });

export async function readFleet(filePath: string) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const units: ParsedUnit[] = [];
  const issues: ImportIssueDraft[] = [];

  for (const worksheet of workbook.worksheets) {
    const key = worksheet.name.trim().toLowerCase();
    const config = SHEETS[key];
    const sheet = worksheet.name.trim();
    if (!config) {
      issues.push({
        sheet,
        rowNumber: null,
        unitNumber: null,
        field: null,
        rawValue: worksheet.name,
        severity: "warning",
        message: `Sheet “${sheet}” is not a known equipment tab and was skipped.`,
      });
      continue;
    }
    parseSheet(worksheet, sheet, config, units, issues);
  }

  return { units, issues };
}

export async function importWorkbookFile(
  db: Database.Database,
  filePath: string,
  options: { replace?: boolean } = {},
): Promise<ImportReport> {
  const existing = db.prepare("SELECT COUNT(*) AS n FROM units").get() as { n: number };
  if (existing.n > 0 && !options.replace) {
    throw new Error(
      "The database already has units. Run the import again with --replace to replace units, lines, and the import log.",
    );
  }
  const fleet = await readFleet(filePath);
  return writeFleet(db, fleet.units, fleet.issues, options.replace === true);
}

export function writeFleet(
  db: Database.Database,
  units: ParsedUnit[],
  issues: ImportIssueDraft[],
  replace: boolean,
) {
  const now = new Date().toISOString();
  const insertUnit = db.prepare(`
    INSERT INTO units (
      id, number, category, plate, slick_back,
      registration_exp, registration_raw, registration_status, registration_note,
      state_inspection_exp, state_inspection_raw, state_inspection_status, state_inspection_note,
      annual_exp, annual_raw, annual_status, annual_note,
      notes, source_sheet, source_row, created_at, updated_at
    ) VALUES (
      @id, @number, @category, @plate, @slick_back,
      @registration_exp, @registration_raw, @registration_status, @registration_note,
      @state_inspection_exp, @state_inspection_raw, @state_inspection_status, @state_inspection_note,
      @annual_exp, @annual_raw, @annual_status, @annual_note,
      @notes, @source_sheet, @source_row, @created_at, @updated_at
    )
  `);
  const insertComponent = db.prepare(`
    INSERT INTO components (
      id, unit_id, label, serial, size, expiration, expiration_raw, expiration_status,
      expiration_note, notes, sort_order, source_row, created_at, updated_at
    ) VALUES (
      @id, @unit_id, @label, @serial, @size, @expiration, @expiration_raw, @expiration_status,
      @expiration_note, '', @sort_order, @source_row, @created_at, @updated_at
    )
  `);
  const insertIssue = db.prepare(`
    INSERT INTO import_issues (
      id, sheet, row_number, unit_number, field, raw_value, severity, message, created_at
    ) VALUES (
      @id, @sheet, @row_number, @unit_number, @field, @raw_value, @severity, @message, @created_at
    )
  `);

  const byCategory: ImportReport["byCategory"] = {};
  const transaction = db.transaction(() => {
    if (replace) {
      const docs = db.prepare("SELECT stored_name FROM documents").all() as { stored_name: string }[];
      for (const doc of docs) {
        fs.rmSync(uploadPath(doc.stored_name), { force: true });
      }
      db.exec("DELETE FROM documents; DELETE FROM components; DELETE FROM units; DELETE FROM import_issues;");
    }
    for (const unit of units) {
      const id = randomUUID();
      insertUnit.run({
        id,
        number: unit.number,
        category: unit.category,
        plate: unit.plate,
        slick_back: unit.slickBack ? 1 : 0,
        ...dateCols("registration", unit.registration),
        ...dateCols("state_inspection", unit.stateInspection),
        ...dateCols("annual", unit.annual),
        notes: unit.notes,
        source_sheet: unit.sourceSheet,
        source_row: unit.sourceRow,
        created_at: now,
        updated_at: now,
      });
      byCategory[unit.category] ??= { units: 0, components: 0 };
      byCategory[unit.category].units += 1;
      for (const component of unit.components) {
        insertComponent.run({
          id: randomUUID(),
          unit_id: id,
          label: component.label,
          serial: component.serial,
          size: component.size,
          expiration: component.expiration.iso,
          expiration_raw: component.expiration.raw,
          expiration_status: component.expiration.status,
          expiration_note: component.expiration.note,
          sort_order: component.sortOrder,
          source_row: component.sourceRow,
          created_at: now,
          updated_at: now,
        });
        byCategory[unit.category].components += 1;
      }
    }
    for (const issue of issues) {
      insertIssue.run({
        id: randomUUID(),
        sheet: issue.sheet,
        row_number: issue.rowNumber,
        unit_number: issue.unitNumber,
        field: issue.field,
        raw_value: issue.rawValue,
        severity: issue.severity,
        message: issue.message,
        created_at: now,
      });
    }
  });
  transaction();

  const componentCount = units.reduce((sum, unit) => sum + unit.components.length, 0);
  return { units: units.length, components: componentCount, issues, byCategory };
}

function dateCols(prefix: "registration" | "state_inspection" | "annual", parsed: ParsedDate) {
  return {
    [`${prefix}_exp`]: parsed.iso,
    [`${prefix}_raw`]: parsed.raw,
    [`${prefix}_status`]: parsed.status,
    [`${prefix}_note`]: parsed.note,
  };
}

function parseSheet(
  worksheet: ExcelJS.Worksheet,
  sheet: string,
  config: SheetConfig,
  units: ParsedUnit[],
  issues: ImportIssueDraft[],
) {
  let current: ParsedUnit | null = null;
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const numberValue = cellValue(row.getCell(config.unit.number));
    const unitNumber = textValue(numberValue);
    if (unitNumber && !/^unit$/i.test(unitNumber)) {
      current = blankUnit(config, sheet, rowNumber, unitNumber);
      current.plate = readPlate(row, config.unit.plate);
      current.registration = readTrackedDate(row, config, "registration", config.unit.registration);
      current.stateInspection = readTrackedDate(
        row,
        config,
        "state_inspection",
        config.unit.stateInspection,
      );
      current.annual = readTrackedDate(row, config, "annual", config.unit.annual);
      noteDate(issues, sheet, rowNumber, unitNumber, "registration", current.registration);
      noteDate(issues, sheet, rowNumber, unitNumber, "state_inspection", current.stateInspection);
      noteDate(issues, sheet, rowNumber, unitNumber, "annual", current.annual);
      notePlate(issues, sheet, rowNumber, unitNumber, current.plate);

      if (config.line) {
        const lineValues = readLineValues(row, config);
        if (isSlickLine(lineValues)) {
          current.slickBack = true;
          current.notes = "Slick back — no winch line on the sheet.";
          issues.push({
            sheet,
            rowNumber,
            unitNumber,
            field: "line",
            rawValue: "SLICK BACK",
            severity: "cleaned",
            message: "SLICK BACK was saved as a note. No winch line was created for this unit.",
          });
        } else if (lineHasContent(lineValues) && !lineValues.label && !lineValues.serial) {
          issues.push({
            sheet,
            rowNumber,
            unitNumber,
            field: "line",
            rawValue: [lineValues.expirationText, lineValues.size].filter(Boolean).join(" · ") || null,
            severity: "warning",
            message:
              "This unit row has a line expiration or size but no line label or serial, so it was not saved as a line. It may be a cell filled down from the row above.",
          });
        } else if (lineHasContent(lineValues)) {
          pushLine(current, issues, sheet, rowNumber, lineValues);
        }
      }
      units.push(current);
      return;
    }

    if (!config.line) return;
    if (!current) {
      issues.push({
        sheet,
        rowNumber,
        unitNumber: null,
        field: "line",
        rawValue: null,
        severity: "error",
        message: "A line row appeared before any unit row and was skipped.",
      });
      return;
    }

    const lineValues = readLineValues(row, config);
    if (config.line.plate) {
      const plate = textValue(cellValue(row.getCell(config.line.plate)));
      if (plate && !isSlickBack(plate) && !looksLikeDate(plate)) {
        if (!current.plate) {
          current.plate = plate;
          issues.push({
            sheet,
            rowNumber,
            unitNumber: current.number,
            field: "plate",
            rawValue: plate,
            severity: "cleaned",
            message: `Plate ${plate} was written on the first line row and was saved on the unit.`,
          });
          notePlate(issues, sheet, rowNumber, current.number, plate);
        } else if (plate !== current.plate) {
          issues.push({
            sheet,
            rowNumber,
            unitNumber: current.number,
            field: "plate",
            rawValue: plate,
            severity: "warning",
            message: `Extra plate “${plate}” on a line row was left off the unit, which already has plate ${current.plate}.`,
          });
        }
      }
    }

    if (!lineHasContent(lineValues) || isSlickLine(lineValues)) return;
    if (!lineValues.label && !lineValues.serial && (lineValues.expirationText || lineValues.size)) {
      issues.push({
        sheet,
        rowNumber,
        unitNumber: current.number,
        field: "line",
        rawValue: [lineValues.expirationText, lineValues.size].filter(Boolean).join(" · ") || null,
        severity: "warning",
        message: "A row had a size or expiration without a line label or serial and was not saved as a line.",
      });
      return;
    }
    pushLine(current, issues, sheet, rowNumber, lineValues);
  });
}

function blankUnit(config: SheetConfig, sheet: string, rowNumber: number, number: string): ParsedUnit {
  return {
    number,
    category: config.category,
    plate: null,
    slickBack: false,
    registration: unusedOrMissing(config.category, "registration"),
    stateInspection: unusedOrMissing(config.category, "state_inspection"),
    annual: unusedOrMissing(config.category, "annual"),
    notes: "",
    sourceSheet: sheet,
    sourceRow: rowNumber,
    components: [],
  };
}

function unusedOrMissing(category: CategoryId, field: CertField): ParsedDate {
  if (!categoryTracks(category, field)) return naDate();
  return { iso: null, status: "missing", raw: null, note: null };
}

function readTrackedDate(
  row: ExcelJS.Row,
  config: SheetConfig,
  field: CertField,
  column: number | undefined,
): ParsedDate {
  if (!categoryTracks(config.category, field)) {
    if (!column) return naDate();
    const value = cellValue(row.getCell(column));
    if (isBlank(value)) return naDate();
    return parseCertDate(value);
  }
  if (!column) return { iso: null, status: "missing", raw: null, note: null };
  return parseCertDate(cellValue(row.getCell(column)));
}

function readPlate(row: ExcelJS.Row, column: number | undefined) {
  if (!column) return null;
  const plate = textValue(cellValue(row.getCell(column)));
  if (!plate || isSlickBack(plate)) return null;
  return plate;
}

type LineValues = {
  label: string;
  serial: string;
  size: string;
  expiration: ParsedDate;
  expirationText: string;
  rawFields: unknown[];
};

function readLineValues(row: ExcelJS.Row, config: SheetConfig): LineValues {
  const line = config.line!;
  const labelValue = cellValue(row.getCell(line.label));
  const serialValue = cellValue(row.getCell(line.serial));
  const sizeValue = cellValue(row.getCell(line.size));
  const expirationValue = cellValue(row.getCell(line.expiration));
  const serial = textValue(serialValue);
  const size = textValue(sizeValue);
  const label = collapseSpace(textValue(labelValue));
  const expiration = isSlickBack(expirationValue)
    ? { iso: null, status: "missing" as const, raw: "SLICK BACK", note: null }
    : parseCertDate(expirationValue);
  return {
    label: isSlickBack(labelValue) ? "" : label,
    serial: isSlickBack(serialValue) ? "" : serial,
    size: isSlickBack(sizeValue) ? "" : size,
    expiration,
    expirationText: expiration.raw || expiration.iso || "",
    rawFields: [labelValue, serialValue, sizeValue, expirationValue],
  };
}

function isSlickLine(values: LineValues) {
  const present = values.rawFields.filter((value) => !isBlank(value));
  return present.length > 0 && present.every((value) => isSlickBack(value));
}

function lineHasContent(values: LineValues) {
  return Boolean(values.label || values.serial || values.size || values.expiration.iso || values.expiration.raw);
}

function pushLine(
  unit: ParsedUnit,
  issues: ImportIssueDraft[],
  sheet: string,
  rowNumber: number,
  values: LineValues,
) {
  const expiration = values.expiration.status === "missing" && values.expiration.raw === "SLICK BACK"
    ? { iso: null, status: "missing" as const, raw: null, note: null }
    : values.expiration;
  unit.components.push({
    label: values.label || "Line",
    serial: values.serial || null,
    size: values.size || null,
    expiration,
    sourceRow: rowNumber,
    sortOrder: unit.components.length,
  });
  if (expiration.raw !== "SLICK BACK") {
    noteDate(issues, sheet, rowNumber, unit.number, values.label || "line", expiration);
  }
}

function noteDate(
  issues: ImportIssueDraft[],
  sheet: string,
  rowNumber: number,
  unitNumber: string,
  field: string,
  parsed: ParsedDate,
) {
  if (parsed.status === "unparsed") {
    issues.push({
      sheet,
      rowNumber,
      unitNumber,
      field,
      rawValue: parsed.raw,
      severity: "error",
      message: parsed.note ?? `Could not read a date for ${field}. The original text was kept.`,
    });
  } else if (parsed.status === "suspicious") {
    issues.push({
      sheet,
      rowNumber,
      unitNumber,
      field,
      rawValue: parsed.raw ?? parsed.iso,
      severity: "warning",
      message: parsed.note ?? `Date ${parsed.iso} needs a look.`,
    });
  } else if (parsed.status === "ok" && parsed.raw && parsed.note) {
    issues.push({
      sheet,
      rowNumber,
      unitNumber,
      field,
      rawValue: parsed.raw,
      severity: "cleaned",
      message: parsed.note,
    });
  }
}

function notePlate(
  issues: ImportIssueDraft[],
  sheet: string,
  rowNumber: number,
  unitNumber: string,
  plate: string | null,
) {
  if (!plate) return;
  if (plate === "R8177845") {
    issues.push({
      sheet,
      rowNumber,
      unitNumber,
      field: "plate",
      rawValue: plate,
      severity: "warning",
      message:
        "Plate R8177845 was imported as written. Nearby tandem plates are R817844 and R817846, so the extra 7 may be a typo.",
    });
  }
  if (/^\d{3}-\d{5,}$/.test(plate)) {
    issues.push({
      sheet,
      rowNumber,
      unitNumber,
      field: "plate",
      rawValue: plate,
      severity: "warning",
      message: `Plate ${plate} is longer than the usual 000-0000 pattern. It was imported as written.`,
    });
  }
}

function looksLikeDate(value: string) {
  return /^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}$/.test(value.replace(/['’`]/g, ""));
}

function cellValue(cell: ExcelJS.Cell): unknown {
  const value = cell.value;
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object") {
    if ("result" in value && value.result != null && value.result !== undefined) {
      return value.result as unknown;
    }
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("");
    }
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("error" in value) return null;
  }
  return value;
}
