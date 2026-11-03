import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5">
      <p className="text-sm font-semibold tracking-[0.16em] text-[#9a3412] uppercase">331 Certs</p>
      <h1 className="font-heading mt-2 text-5xl font-bold">That unit is not on file</h1>
      <p className="mt-3 text-base text-muted-foreground">It may have been deleted, or the link is old.</p>
      <Link href="/units" className="mt-6 inline-flex min-h-12 items-center font-semibold text-[#9a3412]">
        Back to units
      </Link>
    </main>
  );
}
