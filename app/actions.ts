"use server";

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearSessionCookie, credentialsMatch, loginConfig, requireUser, setSessionCookie } from "@/lib/auth";
import { categoryById, type CertField } from "@/lib/categories";
import { appliesTo, dateFromForm, type StoredDate } from "@/lib/cert-form";
import {
  findUnitByNumber,
  getComponent,
  getDb,
  getDocument,
  getDocumentsForUnit,
  getUnit,
  uploadPath,
  type Unit,
} from "@/lib/db";
import { safeNextPath } from "@/lib/params";

const CERT_FIELDS: CertField[] = ["registration", "state_inspection", "annual"];
const MAX_UPLOAD = 20 * 1024 * 1024;
const MIME_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "image/heif": ".heif",
  "application/pdf": ".pdf",
};

function refresh() {
  revalidatePath("/", "layout");
}

function fail(path: string, message: string): never {
  const url = new URL(path, "http://local");
  url.searchParams.set("error", message);
  redirect(`${url.pathname}${url.search}${url.hash}`);
}

function done(path: string): never {
  const url = new URL(path, "http://local");
  url.searchParams.set("saved", "1");
  redirect(`${url.pathname}${url.search}${url.hash}`);
}

export async function login(formData: FormData) {
  const next = safeNextPath(String(formData.get("next") ?? "/"));
  const config = loginConfig();
  if (config.locked || !config.password) {
    fail("/login", "Set APP_PASSWORD on the server before signing in.");
  }
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!credentialsMatch(username, password)) {
    const url = new URL("/login", "http://local");
    url.searchParams.set("error", "That name or password is not the yard login.");
    if (next !== "/") url.searchParams.set("next", next);
    redirect(`${url.pathname}${url.search}`);
  }
  await setSessionCookie(config.user);
  redirect(next);
}

export async function logout() {
  await clearSessionCookie();
  redirect("/login");
}

export async function createUnit(formData: FormData) {
  await requireUser();
  const number = cleanNumber(formData.get("number"));
  const category = categoryById(String(formData.get("category") ?? ""));
  if (!number) fail("/units/new", "Enter a unit number.");
  if (!category) fail("/units/new", "Choose the kind of equipment.");
  if (findUnitByNumber(category.id, number)) {
    fail("/units/new", `Unit ${number} is already in ${category.label}.`);
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const registration = dateFromForm(formData, "registration", appliesTo(category.id, "registration"), null);
  const stateInspection = dateFromForm(
    formData,
    "state_inspection",
    appliesTo(category.id, "state_inspection"),
    null,
  );
  const annual = dateFromForm(formData, "annual", appliesTo(category.id, "annual"), null);
  const slick = category.slickBack && formData.get("slick_back") === "on";
  const db = getDb();
  db.prepare(
    `INSERT INTO units (
      id, number, category, plate, slick_back,
      registration_exp, registration_raw, registration_status, registration_note,
      state_inspection_exp, state_inspection_raw, state_inspection_status, state_inspection_note,
      annual_exp, annual_raw, annual_status, annual_note,
      notes, source_sheet, source_row, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, NULL, NULL, ?, ?
    )`,
  ).run(
    id,
    number,
    category.id,
    cleanPlate(formData.get("plate")),
    slick ? 1 : 0,
    registration.iso,
    registration.raw,
    registration.status,
    registration.note,
    stateInspection.iso,
    stateInspection.raw,
    stateInspection.status,
    stateInspection.note,
    annual.iso,
    annual.raw,
    annual.status,
    annual.note,
    cleanNotes(formData.get("notes")),
    now,
    now,
  );
  refresh();
  done(`/units/${id}`);
}

export async function updateUnitInfo(formData: FormData) {
  await requireUser();
  const unit = requireOwnedUnit(formData);
  const number = cleanNumber(formData.get("number"));
  if (!number) fail(unitPath(unit.id), "Enter a unit number.");
  const category = categoryById(unit.category);
  if (!category) fail(unitPath(unit.id), "This unit has an unknown category.");
  const existing = findUnitByNumber(unit.category, number);
  if (existing && existing.id !== unit.id) {
    fail(unitPath(unit.id), `Unit ${number} is already in ${category.label}.`);
  }
  const slick = category.slickBack && formData.get("slick_back") === "on";
  getDb()
    .prepare(
      `UPDATE units
       SET number = ?, plate = ?, notes = ?, slick_back = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(number, cleanPlate(formData.get("plate")), cleanNotes(formData.get("notes")), slick ? 1 : 0, now(), unit.id);
  refresh();
  done(unitPath(unit.id));
}

export async function updateCert(formData: FormData) {
  await requireUser();
  const unit = requireOwnedUnit(formData);
  const field = String(formData.get("field") ?? "") as CertField;
  if (!CERT_FIELDS.includes(field)) fail(unitPath(unit.id), "Unknown certificate.");
  const stored = dateFromForm(formData, field, appliesTo(unit.category, field), currentDate(unit, field));
  const column = field === "state_inspection" ? "state_inspection" : field;
  getDb()
    .prepare(
      `UPDATE units SET
        ${column}_exp = ?,
        ${column}_raw = ?,
        ${column}_status = ?,
        ${column}_note = ?,
        updated_at = ?
      WHERE id = ?`,
    )
    .run(stored.iso, stored.raw, stored.status, stored.note, now(), unit.id);
  refresh();
  done(`${unitPath(unit.id)}#${field}`);
}

export async function deleteUnit(formData: FormData) {
  await requireUser();
  const unit = requireOwnedUnit(formData);
  const db = getDb();
  const docs = getDocumentsForUnit(unit.id, db);
  for (const doc of docs) fs.rmSync(uploadPath(doc.storedName), { force: true });
  db.prepare("DELETE FROM units WHERE id = ?").run(unit.id);
  refresh();
  redirect("/units?saved=1");
}

export async function saveLine(formData: FormData) {
  await requireUser();
  const unit = requireOwnedUnit(formData);
  const componentId = String(formData.get("componentId") ?? "");
  const existing = componentId ? getComponent(componentId) : null;
  if (componentId && (!existing || existing.unitId !== unit.id)) {
    fail(unitPath(unit.id), "That line is not on this unit.");
  }
  const label = cleanNotes(formData.get("label")).slice(0, 80);
  const serial = blankToNull(cleanNotes(formData.get("serial")).slice(0, 80));
  const size = blankToNull(cleanNotes(formData.get("size")).slice(0, 80));
  const notes = cleanNotes(formData.get("line_notes"));
  if (!label && !serial && !size) {
    fail(unitPath(unit.id), "Add a position, serial, or size.");
  }
  const expiration = dateFromForm(
    formData,
    "expiration",
    true,
    existing
      ? {
          iso: existing.expiration,
          status: existing.expirationStatus,
          raw: existing.expirationRaw,
          note: existing.expirationNote,
        }
      : null,
  );
  const db = getDb();
  const stamp = now();
  let id = existing?.id;
  if (existing) {
    db.prepare(
      `UPDATE components SET
        label = ?, serial = ?, size = ?, expiration = ?, expiration_raw = ?,
        expiration_status = ?, expiration_note = ?, notes = ?, updated_at = ?
      WHERE id = ?`,
    ).run(
      label || "Line",
      serial,
      size,
      expiration.iso,
      expiration.raw,
      expiration.status,
      expiration.note,
      notes,
      stamp,
      existing.id,
    );
  } else {
    id = randomUUID();
    const max = db
      .prepare("SELECT COALESCE(MAX(sort_order), -1) AS n FROM components WHERE unit_id = ?")
      .get(unit.id) as { n: number };
    db.prepare(
      `INSERT INTO components (
        id, unit_id, label, serial, size, expiration, expiration_raw, expiration_status,
        expiration_note, notes, sort_order, source_row, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    ).run(
      id,
      unit.id,
      label || "Line",
      serial,
      size,
      expiration.iso,
      expiration.raw,
      expiration.status,
      expiration.note,
      notes,
      max.n + 1,
      stamp,
      stamp,
    );
  }
  refresh();
  done(`${unitPath(unit.id)}#${id}`);
}

export async function deleteLine(formData: FormData) {
  await requireUser();
  const unit = requireOwnedUnit(formData);
  const componentId = String(formData.get("componentId") ?? "");
  const component = getComponent(componentId);
  if (!component || component.unitId !== unit.id) fail(unitPath(unit.id), "That line is not on this unit.");
  const db = getDb();
  const docs = getDocumentsForUnit(unit.id, db).filter((doc) => doc.componentId === component.id);
  for (const doc of docs) fs.rmSync(uploadPath(doc.storedName), { force: true });
  db.prepare("DELETE FROM components WHERE id = ?").run(component.id);
  refresh();
  done(unitPath(unit.id));
}

export async function addDocument(formData: FormData) {
  await requireUser();
  const unit = requireOwnedUnit(formData);
  const certKind = String(formData.get("certKind") ?? "");
  const componentId = String(formData.get("componentId") ?? "");
  const back = componentId ? `${unitPath(unit.id)}#${componentId}` : `${unitPath(unit.id)}#${certKind}`;
  if (certKind !== "registration" && certKind !== "state_inspection" && certKind !== "annual" && certKind !== "line") {
    fail(unitPath(unit.id), "Unknown certificate.");
  }
  if (certKind === "line") {
    const component = getComponent(componentId);
    if (!component || component.unitId !== unit.id) fail(unitPath(unit.id), "That line is not on this unit.");
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    fail(back, "Choose a photo or PDF first.");
  }
  if (file.size > MAX_UPLOAD) fail(back, "That file is over 20 MB.");
  const mime = normalizeMime(file.type, file.name);
  const ext = MIME_EXT[mime];
  if (!ext) fail(back, "Use a JPEG, PNG, WebP, HEIC, or PDF.");

  const id = randomUUID();
  const storedName = `${id}${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(uploadPath(storedName), bytes);
  try {
    getDb()
      .prepare(
        `INSERT INTO documents (
          id, unit_id, component_id, cert_kind, original_name, stored_name, mime, size_bytes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        unit.id,
        certKind === "line" ? componentId : null,
        certKind,
        cleanFileName(file.name, ext),
        storedName,
        mime,
        bytes.length,
        now(),
      );
  } catch (error) {
    fs.rmSync(uploadPath(storedName), { force: true });
    throw error;
  }
  refresh();
  done(back);
}

export async function deleteDocument(formData: FormData) {
  await requireUser();
  const unit = requireOwnedUnit(formData);
  const doc = getDocument(String(formData.get("id") ?? ""));
  if (!doc || doc.unitId !== unit.id) fail(unitPath(unit.id), "That file is not on this unit.");
  fs.rmSync(uploadPath(doc.storedName), { force: true });
  getDb().prepare("DELETE FROM documents WHERE id = ?").run(doc.id);
  refresh();
  const anchor = doc.componentId ?? doc.certKind;
  done(`${unitPath(unit.id)}#${anchor}`);
}

function requireOwnedUnit(formData: FormData) {
  const unit = getUnit(String(formData.get("unitId") ?? ""));
  if (!unit) fail("/units", "That unit is no longer on file.");
  return unit;
}

function currentDate(unit: Unit, field: CertField): StoredDate {
  if (field === "registration") {
    return {
      iso: unit.registrationExp,
      status: unit.registrationStatus,
      raw: unit.registrationRaw,
      note: unit.registrationNote,
    };
  }
  if (field === "state_inspection") {
    return {
      iso: unit.stateInspectionExp,
      status: unit.stateInspectionStatus,
      raw: unit.stateInspectionRaw,
      note: unit.stateInspectionNote,
    };
  }
  return {
    iso: unit.annualExp,
    status: unit.annualStatus,
    raw: unit.annualRaw,
    note: unit.annualNote,
  };
}

function unitPath(id: string) {
  return `/units/${id}`;
}

function now() {
  return new Date().toISOString();
}

function cleanNumber(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().slice(0, 32);
}

function cleanPlate(value: FormDataEntryValue | null) {
  const plate = String(value ?? "").trim().slice(0, 40);
  return plate || null;
}

function cleanNotes(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().slice(0, 4000);
}

function blankToNull(value: string) {
  return value.trim() ? value.trim() : null;
}

function cleanFileName(name: string, ext: string) {
  const base = name.split(/[/\\]/).pop()?.replace(/[\r\n"]/g, "").trim() || "";
  return (base || `certificate${ext}`).slice(0, 180);
}

function normalizeMime(type: string, name: string) {
  const lower = type.toLowerCase();
  if (MIME_EXT[lower]) return lower;
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "heic") return "image/heic";
  if (ext === "heif") return "image/heif";
  if (ext === "pdf") return "application/pdf";
  return lower;
}
