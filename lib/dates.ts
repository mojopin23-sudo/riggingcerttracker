export type DateStatus = "ok" | "missing" | "na" | "unparsed" | "suspicious";

export type ParsedDate = {
  iso: string | null;
  status: DateStatus;
  raw: string | null;
  note: string | null;
};

const NA_PATTERN = /^(n\/?a|none|not applicable|-+)$/i;
const SLICK_PATTERN = /^slick\s*back$/i;

export function isSlickBack(value: unknown) {
  return typeof value === "string" && SLICK_PATTERN.test(value.trim());
}

export function isBlank(value: unknown) {
  if (value == null) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  return false;
}

export function todayISO(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "No date";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function daysUntil(iso: string, today: string) {
  const target = Date.parse(`${iso}T00:00:00Z`);
  const start = Date.parse(`${today}T00:00:00Z`);
  return Math.round((target - start) / 86_400_000);
}

export function parseCertDate(value: unknown): ParsedDate {
  if (isBlank(value)) {
    return { iso: null, status: "missing", raw: null, note: null };
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return { iso: null, status: "unparsed", raw: null, note: "Invalid date" };
    }
    return classifyYear(isoFromDate(value), null);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return classifyYear(isoFromExcelSerial(value), String(value));
  }

  const original = String(value).trim();
  if (NA_PATTERN.test(original)) {
    return { iso: null, status: "na", raw: original, note: null };
  }
  if (SLICK_PATTERN.test(original)) {
    return {
      iso: null,
      status: "missing",
      raw: original,
      note: "SLICK BACK is a placeholder, not a date",
    };
  }

  const stripped = original.replace(/['’`]/g, "").replace(/[a-z]+$/i, "").trim();
  const compact = stripped.replace(/\s+/g, "");
  const match = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/.exec(compact);
  if (!match) {
    return {
      iso: null,
      status: "unparsed",
      raw: original,
      note: `Could not read “${original}” as a date`,
    };
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) year += 2000;
  if (!isValidYmd(year, month, day)) {
    return {
      iso: null,
      status: "unparsed",
      raw: original,
      note: `${original} is not a real calendar date`,
    };
  }

  const iso = formatYmd(year, month, day);
  const neededCleanup = stripped !== original || compact !== stripped;
  return classifyYear(iso, neededCleanup ? original : null);
}

export function collapseSpace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function textValue(value: unknown) {
  if (value == null) return "";
  if (value instanceof Date) return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number.isInteger(value) ? String(value) : String(value);
  }
  return collapseSpace(String(value));
}

function classifyYear(iso: string, raw: string | null): ParsedDate {
  const year = Number(iso.slice(0, 4));
  if (year >= 3000 || year < 1990) {
    return {
      iso,
      status: "suspicious",
      raw: raw ?? iso,
      note: `Year ${year} was kept as written. Nearby records use 2026–2031, so confirm it before you rely on it.`,
    };
  }
  if (raw) {
    return {
      iso,
      status: "ok",
      raw,
      note: `Read as ${formatDate(iso)} after cleaning “${raw}”`,
    };
  }
  return { iso, status: "ok", raw: null, note: null };
}

function isoFromDate(date: Date) {
  const utcHours = date.getUTCHours();
  const useUtc = utcHours === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0;
  if (useUtc) {
    return formatYmd(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }
  return formatYmd(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function isoFromExcelSerial(serial: number) {
  const utc = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return formatYmd(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate());
}

function formatYmd(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isValidYmd(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1 || year < 1000 || year > 9999) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
