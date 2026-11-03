export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-3" aria-busy="true" aria-live="polite">
      <div className="h-12 w-48 animate-pulse rounded-xl bg-[#e4d8c4]" />
      <div className="h-24 animate-pulse rounded-2xl bg-[#e4d8c4]" />
      <div className="h-24 animate-pulse rounded-2xl bg-[#e4d8c4]" />
      <p className="text-base text-muted-foreground">Loading the yard board…</p>
    </div>
  );
}
