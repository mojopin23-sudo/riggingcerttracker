import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Banner } from "@/components/banner";
import { UnitEditor } from "@/components/unit-editor";
import { loadUnit } from "@/lib/fleet";
import { firstParam } from "@/lib/params";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const loaded = loadUnit(id);
  return { title: loaded ? `Unit ${loaded.unit.number}` : "Unit" };
}

export default async function UnitPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const loaded = loadUnit(id);
  if (!loaded) notFound();
  const query = await searchParams;
  return (
    <div className="flex flex-col gap-4">
      <Banner error={firstParam(query.error)} saved={firstParam(query.saved) === "1"} />
      <UnitEditor unit={loaded.unit} components={loaded.components} documents={loaded.documents} />
    </div>
  );
}
