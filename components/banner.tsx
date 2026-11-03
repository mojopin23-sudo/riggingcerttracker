export function Banner({ error, saved }: { error?: string; saved?: boolean }) {
  if (error) {
    return (
      <p role="alert" className="rounded-xl bg-[#9f1239] px-4 py-3 text-base font-medium text-white">
        {error}
      </p>
    );
  }
  if (saved) {
    return (
      <p className="rounded-xl bg-[#3f6212] px-4 py-3 text-base font-medium text-white">Saved.</p>
    );
  }
  return null;
}
