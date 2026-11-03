import assert from "node:assert/strict";
import test from "node:test";
import { daysUntil, parseCertDate, todayISO } from "../lib/dates";

test("parses clean US dates", () => {
  const parsed = parseCertDate("01/26/2027");
  assert.equal(parsed.status, "ok");
  assert.equal(parsed.iso, "2027-01-26");
  assert.equal(parsed.raw, null);
});

test("parses forklift text dates", () => {
  const parsed = parseCertDate("04/13/2027");
  assert.equal(parsed.iso, "2027-04-13");
  assert.equal(parsed.status, "ok");
});

test("cleans a stray quote in 10/'2/2027", () => {
  const parsed = parseCertDate("10/'2/2027");
  assert.equal(parsed.iso, "2027-10-02");
  assert.equal(parsed.status, "ok");
  assert.equal(parsed.raw, "10/'2/2027");
  assert.match(parsed.note ?? "", /cleaning/);
});

test("cleans a trailing letter in 10/9/2027r", () => {
  const parsed = parseCertDate("10/9/2027r");
  assert.equal(parsed.iso, "2027-10-09");
  assert.equal(parsed.status, "ok");
  assert.equal(parsed.raw, "10/9/2027r");
});

test("keeps an impossible date instead of dropping it", () => {
  const parsed = parseCertDate("9/31/2027");
  assert.equal(parsed.status, "unparsed");
  assert.equal(parsed.iso, null);
  assert.equal(parsed.raw, "9/31/2027");
});

test("flags year 3031 but keeps the date", () => {
  const parsed = parseCertDate(new Date(Date.UTC(3031, 1, 28)));
  assert.equal(parsed.iso, "3031-02-28");
  assert.equal(parsed.status, "suspicious");
});

test("treats N/A and slick back", () => {
  assert.equal(parseCertDate("N/A").status, "na");
  assert.equal(parseCertDate("SLICK BACK ").status, "missing");
  assert.equal(parseCertDate("").status, "missing");
  assert.equal(parseCertDate(null).status, "missing");
});

test("counts calendar days in Chicago", () => {
  assert.equal(daysUntil("2026-11-03", "2026-11-03"), 0);
  assert.equal(daysUntil("2026-10-03", "2026-11-03"), -31);
  assert.match(todayISO(new Date("2026-11-03T18:00:00Z")), /^2026-11-03$/);
});
