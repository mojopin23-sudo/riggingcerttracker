"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5">
      <p className="text-sm font-semibold tracking-[0.16em] text-[#9a3412] uppercase">331 Certs</p>
      <h1 className="font-heading mt-2 text-5xl font-bold">The yard board hit a snag</h1>
      <p className="mt-3 text-base text-muted-foreground">
        Try that again. If it keeps failing, check that the data folder is writable.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#e25b12] px-4 text-base font-semibold text-white"
      >
        Try again
      </button>
    </main>
  );
}
