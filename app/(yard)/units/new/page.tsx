import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createUnit } from "@/app/actions";
import { CATEGORIES, CERT_FIELDS } from "@/lib/categories";
import { firstParam } from "@/lib/params";
import { Banner } from "@/components/banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const metadata: Metadata = { title: "Add unit" };

export default async function NewUnitPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Link href="/units" className="inline-flex min-h-12 items-center gap-1 text-base font-semibold">
        <ChevronLeft className="size-5" />
        Units
      </Link>
      <div>
        <h1 className="font-heading text-5xl leading-none font-bold tracking-wide">Add a unit</h1>
        <p className="mt-2 text-base text-muted-foreground">
          Leave a date blank if you do not have it. You can add lines, slings, and photos on the next screen.
        </p>
      </div>
      <Banner error={firstParam(params.error)} />
      <form action={createUnit} className="space-y-5 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 md:p-6">
        <fieldset className="space-y-2">
          <legend className="text-base font-semibold">Equipment</legend>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map((category) => (
              <label key={category.id} className="choice-card flex min-h-14 cursor-pointer items-center rounded-xl bg-[#f3ecdf] px-3 text-base font-semibold ring-1 ring-foreground/10">
                <input type="radio" name="category" value={category.id} required className="sr-only" />
                {category.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="number" className="text-base">
              Unit number
            </Label>
            <Input id="number" name="number" required placeholder="3017" autoComplete="off" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="plate" className="text-base">
              Plate
            </Label>
            <Input id="plate" name="plate" placeholder="R876312" autoComplete="off" />
          </div>
        </div>
        {CERT_FIELDS.map((field) => (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id} className="text-base">
              {field.label} expiration
            </Label>
            <Input id={field.id} name={field.id} type="date" />
            <label className="flex min-h-12 items-center gap-3 text-base">
              <input type="checkbox" name={`${field.id}_na`} className="size-6 accent-[#e25b12]" />
              Not applicable
            </label>
          </div>
        ))}
        <label className="flex min-h-12 items-center gap-3 text-base">
          <input type="checkbox" name="slick_back" className="size-6 accent-[#e25b12]" />
          Slick back winch truck (no winch line)
        </label>
        <div className="space-y-2">
          <Label htmlFor="notes" className="text-base">
            Notes
          </Label>
          <Textarea id="notes" name="notes" placeholder="Anything the next shift should know" />
        </div>
        <Button type="submit" size="yard" className="w-full">
          Save unit
        </Button>
      </form>
    </div>
  );
}
