import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildAttention } from "../lib/attention";
import { openDatabase } from "../lib/db";
import { readFleet, writeFleet } from "../lib/import-workbook";

const workbook = path.join(process.cwd(), "seed", "rigging_certs.xlsx");

test("imports the terminal workbook and flags messy dates", async () => {
  const fleet = await readFleet(workbook);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rr-certs-"));
  const db = openDatabase(path.join(dir, "rigrunner.db"));
  const report = writeFleet(db, fleet.units, fleet.issues, false);

  assert.equal(report.units, 198);
  assert.equal(report.byCategory.winch_truck.units, 38);
  assert.equal(report.byCategory.crane.units, 6);
  assert.equal(report.byCategory.forklift.units, 8);
  assert.equal(report.byCategory.tandem_pole.units, 12);
  assert.equal(report.byCategory.pickup.units, 42);
  assert.equal(report.byCategory.trailer.units, 92);

  const unit = (number: string, category: string) =>
    db.prepare("SELECT * FROM units WHERE number = ? AND category = ?").get(number, category) as {
      id: string;
      plate: string | null;
      slick_back: number;
      registration_exp: string | null;
      registration_status: string;
      registration_raw: string | null;
      state_inspection_exp: string | null;
      state_inspection_status: string;
      annual_exp: string | null;
      annual_status: string;
    notes: string;
    number: string;
  };

  const lines = (id: string) =>
    db
      .prepare(
        "SELECT label, serial, size, expiration, expiration_status, expiration_raw FROM components WHERE unit_id = ? ORDER BY sort_order",
      )
      .all(id) as {
      label: string;
      serial: string | null;
      size: string | null;
      expiration: string | null;
      expiration_status: string;
      expiration_raw: string | null;
    }[];

  const slick = unit("3000", "winch_truck");
  assert.equal(slick.slick_back, 1);
  assert.equal(slick.plate, "R876312");
  assert.equal(slick.registration_exp, "2027-03-31");
  assert.equal(lines(slick.id).length, 0);
  assert.match(slick.notes, /Slick back/);

  const winch = unit("3017", "winch_truck");
  const winchLines = lines(winch.id);
  assert.deepEqual(
    winchLines.map((line) => line.label),
    ["NUMBER 1", "NUMBER 2", "NUMBER 3", "FROG CHAIN", "FROG CHAIN"],
  );
  assert.equal(winchLines[0].serial, "P18.00947");
  assert.equal(winchLines[0].expiration, "2027-10-03");
  assert.equal(winchLines[1].serial, null);
  assert.equal(winchLines[1].expiration_status, "missing");
  assert.equal(winchLines[3].serial, "1113281");

  const pickup = unit("2136", "pickup");
  assert.equal(pickup.registration_status, "unparsed");
  assert.equal(pickup.registration_raw, "9/31/2027");
  assert.equal(pickup.registration_exp, null);

  const tandem = unit("5001", "tandem_pole");
  assert.equal(tandem.plate, "R876329");
  assert.equal(tandem.state_inspection_status, "na");
  const tandemLines = lines(tandem.id);
  assert.equal(tandemLines[0].label, "NUMBER 1");
  assert.equal(tandemLines[0].expiration, "2027-10-02");
  assert.equal(tandemLines[0].expiration_raw, "10/'2/2027");

  const frog = lines(unit("5010", "tandem_pole").id).find((line) => line.serial === "RC110325-02-PT");
  assert.ok(frog);
  assert.equal(frog.expiration, "2027-10-09");
  assert.equal(frog.expiration_raw, "10/9/2027r");

  const trailer = unit("1033", "trailer");
  assert.equal(trailer.registration_exp, "3031-02-28");
  assert.equal(trailer.registration_status, "suspicious");

  const forklift = unit("6000", "forklift");
  assert.equal(forklift.annual_exp, "2027-04-13");
  assert.equal(forklift.annual_status, "ok");
  assert.equal(forklift.registration_status, "na");

  const bareTrailer = unit("1201", "trailer");
  assert.equal(bareTrailer.registration_status, "missing");
  assert.equal(bareTrailer.state_inspection_exp, "2026-11-30");
  assert.equal(bareTrailer.plate, null);

  assert.equal(unit("1027A", "trailer").number, "1027A");
  assert.equal(unit("7004", "crane").annual_exp, "2027-09-30");
  const crane7004 = lines(unit("7004", "crane").id);
  assert.ok(crane7004.every((line) => line.label && line.serial));
  assert.ok(lines(unit("7001", "crane").id).length > 15);

  const errors = report.issues.filter((issue) => issue.severity === "error");
  assert.ok(errors.some((issue) => issue.rawValue === "9/31/2027"));
  assert.ok(report.issues.some((issue) => issue.rawValue === "10/'2/2027" && issue.severity === "cleaned"));
  assert.ok(report.issues.some((issue) => issue.unitNumber === "7004" && issue.severity === "warning"));
  assert.ok(report.issues.some((issue) => issue.unitNumber === "7007" && issue.severity === "warning"));

  const attention = buildAttention(
    [
      {
        id: pickup.id,
        number: "2136",
        category: "pickup",
        plate: null,
        slickBack: false,
        registrationExp: null,
        registrationRaw: "9/31/2027",
        registrationStatus: "unparsed",
        registrationNote: pickup.registration_status,
        stateInspectionExp: null,
        stateInspectionRaw: null,
        stateInspectionStatus: "missing",
        stateInspectionNote: null,
        annualExp: null,
        annualRaw: null,
        annualStatus: "na",
        annualNote: null,
        notes: "",
        sourceSheet: "Pickups",
        sourceRow: 38,
        createdAt: "",
        updatedAt: "",
      },
    ],
    [],
    "2026-11-03",
  );
  assert.equal(attention[0].status, "unparsed");
  assert.equal(attention[0].bucket, "missing");

  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
