import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { deleteLine, deleteUnit, saveLine, updateCert, updateUnitInfo } from "@/app/actions";
import { bucketLabel, buildAttention } from "@/lib/attention";
import { categoryById, categoryTracks, fieldLabel, type CertField } from "@/lib/categories";
import type { Component, StoredDocument, Unit } from "@/lib/db";
import { formatDate, type DateStatus } from "@/lib/dates";
import { Attachments } from "@/components/attachments";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function UnitEditor({
  unit,
  components,
  documents,
}: {
  unit: Unit;
  components: Component[];
  documents: StoredDocument[];
}) {
  const category = categoryById(unit.category);
  const attention = buildAttention([unit], components);
  const worst = attention.find((item) => item.bucket !== "ok") ?? attention[0];
  const fields: CertField[] = ["registration", "state_inspection", "annual"];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Link href="/units" className="inline-flex min-h-12 items-center gap-1 text-base font-semibold">
        <ChevronLeft className="size-5" />
        Units
      </Link>
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold tracking-wide text-[#9a3412] uppercase">{category?.label}</p>
          <h1 className="font-heading text-6xl leading-none font-bold tracking-wide">{unit.number}</h1>
          <p className="mt-2 text-base text-muted-foreground">
            {unit.plate ? `Plate ${unit.plate}` : "No plate on file"}
            {unit.slickBack ? " · Slick back" : ""}
          </p>
          {unit.sourceSheet ? (
            <p className="text-sm text-muted-foreground">
              Imported from {unit.sourceSheet}
              {unit.sourceRow ? `, row ${unit.sourceRow}` : ""}
            </p>
          ) : null}
        </div>
        {worst ? (
          <StatusPill bucket={worst.bucket} status={worst.status} className="mt-2">
            {worst.status === "unparsed" ? "Check" : bucketLabel(worst.bucket)}
          </StatusPill>
        ) : null}
      </header>

      <section className="space-y-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="text-lg font-semibold">Unit</h2>
        <form action={updateUnitInfo} className="space-y-4">
          <input type="hidden" name="unitId" value={unit.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="number" className="text-base">
                Unit number
              </Label>
              <Input id="number" name="number" defaultValue={unit.number} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plate" className="text-base">
                Plate
              </Label>
              <Input id="plate" name="plate" defaultValue={unit.plate ?? ""} />
            </div>
          </div>
          {category?.slickBack ? (
            <label className="flex min-h-12 items-center gap-3 text-base">
              <input type="checkbox" name="slick_back" defaultChecked={unit.slickBack} className="size-6 accent-[#e25b12]" />
              Slick back — no winch line
            </label>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-base">
              Notes
            </Label>
            <Textarea id="notes" name="notes" defaultValue={unit.notes} />
          </div>
          <Button type="submit" size="yard">
            Save unit
          </Button>
        </form>
      </section>

      {fields.map((field) => {
        const record = readField(unit, field);
        const tracked = category ? categoryTracks(unit.category, field) : false;
        if (!tracked && record.status === "na" && !record.iso && !record.raw) return null;
        const docs = documents.filter((doc) => doc.certKind === field && !doc.componentId);
        return (
          <section key={field} id={field} className="anchor-section space-y-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{fieldLabel(field)}</h2>
              <FieldPill status={record.status} iso={record.iso} />
            </div>
            <form action={updateCert} className="space-y-3">
              <input type="hidden" name="unitId" value={unit.id} />
              <input type="hidden" name="field" value={field} />
              {record.raw ? <input type="hidden" name={`${field}_raw`} value={record.raw} /> : null}
              <DateWarnings status={record.status} raw={record.raw} note={record.note} />
              <Label htmlFor={`${field}-date`} className="text-base">
                Expiration
              </Label>
              <Input id={`${field}-date`} name={field} type="date" defaultValue={record.iso ?? ""} />
              <label className="flex min-h-12 items-center gap-3 text-base">
                <input
                  type="checkbox"
                  name={`${field}_na`}
                  defaultChecked={record.status === "na"}
                  className="size-6 accent-[#e25b12]"
                />
                Not applicable
              </label>
              {record.status === "suspicious" ? (
                <label className="flex min-h-12 items-center gap-3 text-base">
                  <input type="checkbox" name={`${field}_confirm`} className="size-6 accent-[#e25b12]" />
                  I checked this date and it is right
                </label>
              ) : null}
              <Button type="submit" size="yard">
                Save date
              </Button>
            </form>
            <Attachments unitId={unit.id} certKind={field} docs={docs} />
          </section>
        );
      })}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Lines and slings</h2>
        <p className="text-sm text-muted-foreground">
          Winch lines, pendant lines, frog chains, and cable slings. Each one keeps its own expiration and photos.
        </p>
        {components.length === 0 ? (
          <p className="rounded-2xl bg-card px-4 py-5 text-base ring-1 ring-foreground/10">
            {unit.slickBack ? "Marked slick back, so no winch line is expected." : "No lines on this unit yet."}
          </p>
        ) : (
          components.map((component, index) => (
            <LineCard key={component.id} unitId={unit.id} component={component} index={index} documents={documents} />
          ))
        )}
        <details className="rounded-2xl bg-card ring-1 ring-foreground/10">
          <summary className="min-h-14 cursor-pointer list-none px-4 py-4 text-base font-semibold">Add a line or sling</summary>
          <div className="px-4 pb-4">
            <LineForm unitId={unit.id} />
          </div>
        </details>
      </section>

      <details className="rounded-2xl bg-card ring-1 ring-[#9f1239]/30">
        <summary className="min-h-14 cursor-pointer list-none px-4 py-4 text-base font-semibold text-[#9f1239]">
          Delete this unit
        </summary>
        <form action={deleteUnit} className="space-y-3 px-4 pb-4">
          <input type="hidden" name="unitId" value={unit.id} />
          <p className="text-base">
            Removes unit {unit.number}, every line, and every photo. This cannot be undone.
          </p>
          <Button type="submit" variant="destructive" size="yard" className="w-full">
            Delete unit {unit.number}
          </Button>
        </form>
      </details>
    </div>
  );
}

function LineCard({
  unitId,
  component,
  index,
  documents,
}: {
  unitId: string;
  component: Component;
  index: number;
  documents: StoredDocument[];
}) {
  const docs = documents.filter((doc) => doc.componentId === component.id);
  const status = component.expirationStatus;
  return (
    <article id={component.id} className="anchor-section space-y-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Line {index + 1}</p>
          <h3 className="text-xl font-semibold">{component.label}</h3>
          <p className="text-base text-muted-foreground">
            {[component.serial, component.size].filter(Boolean).join(" · ") || "No serial or size yet"}
          </p>
          <p className="text-sm">{status === "ok" || status === "suspicious" ? formatDate(component.expiration) : describeLoose(component)}</p>
        </div>
        <FieldPill status={status} iso={component.expiration} />
      </div>
      <Attachments unitId={unitId} certKind="line" componentId={component.id} docs={docs} />
      <details>
        <summary className="min-h-12 cursor-pointer text-base font-semibold">Edit this line</summary>
        <div className="pt-3">
          <LineForm unitId={unitId} component={component} />
          <form action={deleteLine} className="mt-3">
            <input type="hidden" name="unitId" value={unitId} />
            <input type="hidden" name="componentId" value={component.id} />
            <Button type="submit" variant="destructive" size="yard">
              Delete line
            </Button>
          </form>
        </div>
      </details>
    </article>
  );
}

function LineForm({ unitId, component }: { unitId: string; component?: Component }) {
  const status = component?.expirationStatus;
  return (
    <form action={saveLine} className="space-y-3">
      <input type="hidden" name="unitId" value={unitId} />
      {component ? <input type="hidden" name="componentId" value={component.id} /> : null}
      {component?.expirationRaw ? <input type="hidden" name="expiration_raw" value={component.expirationRaw} /> : null}
      <div className="space-y-2">
        <Label htmlFor={`label-${component?.id ?? "new"}`} className="text-base">
          Position
        </Label>
        <Input
          id={`label-${component?.id ?? "new"}`}
          name="label"
          defaultValue={component?.label ?? ""}
          placeholder="NUMBER 1, Pendant line, Frog chain"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`serial-${component?.id ?? "new"}`} className="text-base">
            Line or serial number
          </Label>
          <Input id={`serial-${component?.id ?? "new"}`} name="serial" defaultValue={component?.serial ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`size-${component?.id ?? "new"}`} className="text-base">
            Size
          </Label>
          <Input id={`size-${component?.id ?? "new"}`} name="size" defaultValue={component?.size ?? ""} placeholder="1-1/8 in x 135 ft" />
        </div>
      </div>
      {component ? <DateWarnings status={status ?? "missing"} raw={component.expirationRaw} note={component.expirationNote} /> : null}
      <div className="space-y-2">
        <Label htmlFor={`exp-${component?.id ?? "new"}`} className="text-base">
          Expiration
        </Label>
        <Input id={`exp-${component?.id ?? "new"}`} name="expiration" type="date" defaultValue={component?.expiration ?? ""} />
      </div>
      <label className="flex min-h-12 items-center gap-3 text-base">
        <input type="checkbox" name="expiration_na" defaultChecked={status === "na"} className="size-6 accent-[#e25b12]" />
        Not applicable
      </label>
      {status === "suspicious" ? (
        <label className="flex min-h-12 items-center gap-3 text-base">
          <input type="checkbox" name="expiration_confirm" className="size-6 accent-[#e25b12]" />
          I checked this date and it is right
        </label>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor={`notes-${component?.id ?? "new"}`} className="text-base">
          Notes
        </Label>
        <Textarea id={`notes-${component?.id ?? "new"}`} name="line_notes" defaultValue={component?.notes ?? ""} />
      </div>
      <Button type="submit" size="yard">
        {component ? "Save line" : "Add line"}
      </Button>
    </form>
  );
}

function DateWarnings({
  status,
  raw,
  note,
}: {
  status: DateStatus;
  raw: string | null;
  note: string | null;
}) {
  if (status === "unparsed") {
    return (
      <p className="rounded-xl bg-[#fff4e5] px-3 py-3 text-base text-[#7c2d12]">
        The sheet said “{raw ?? "a date"}” and that is not a real calendar date. Type the right date, then save.
      </p>
    );
  }
  if (status === "suspicious") {
    return (
      <p className="rounded-xl bg-[#fff4e5] px-3 py-3 text-base text-[#7c2d12]">
        {note ?? "This date looks off."} Leave it if you still need to check, or confirm it below.
      </p>
    );
  }
  if (note && raw) {
    return <p className="text-sm text-muted-foreground">{note}</p>;
  }
  return null;
}

function FieldPill({ status, iso }: { status: DateStatus; iso: string | null }) {
  if (status === "unparsed") return <StatusPill status="unparsed">Check</StatusPill>;
  if (status === "suspicious") return <StatusPill status="suspicious">Check year</StatusPill>;
  if (status === "na") return <StatusPill bucket="na">N/A</StatusPill>;
  if (status === "missing" || !iso) return <StatusPill bucket="missing">Missing</StatusPill>;
  const item = buildAttention(
    [
      {
        id: "x",
        number: "x",
        category: "pickup",
        plate: null,
        slickBack: false,
        registrationExp: iso,
        registrationRaw: null,
        registrationStatus: "ok",
        registrationNote: null,
        stateInspectionExp: null,
        stateInspectionRaw: null,
        stateInspectionStatus: "na",
        stateInspectionNote: null,
        annualExp: null,
        annualRaw: null,
        annualStatus: "na",
        annualNote: null,
        notes: "",
        sourceSheet: null,
        sourceRow: null,
        createdAt: "",
        updatedAt: "",
      },
    ],
    [],
  )[0];
  return <StatusPill bucket={item?.bucket}>{item ? bucketLabel(item.bucket) : formatDate(iso)}</StatusPill>;
}

function readField(unit: Unit, field: CertField) {
  if (field === "registration") {
    return {
      iso: unit.registrationExp,
      raw: unit.registrationRaw,
      status: unit.registrationStatus,
      note: unit.registrationNote,
    };
  }
  if (field === "state_inspection") {
    return {
      iso: unit.stateInspectionExp,
      raw: unit.stateInspectionRaw,
      status: unit.stateInspectionStatus,
      note: unit.stateInspectionNote,
    };
  }
  return {
    iso: unit.annualExp,
    raw: unit.annualRaw,
    status: unit.annualStatus,
    note: unit.annualNote,
  };
}

function describeLoose(component: Component) {
  if (component.expirationStatus === "unparsed") return `Couldn't read “${component.expirationRaw ?? "the sheet"}”`;
  if (component.expirationStatus === "na") return "Not applicable";
  if (component.expirationStatus === "suspicious") return `Check ${formatDate(component.expiration)}`;
  return "No expiration on file";
}
