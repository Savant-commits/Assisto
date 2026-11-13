export default function Loading() {
  return (
    <div aria-label="Loading" role="status" className="mx-auto flex w-full max-w-6xl items-center px-4 py-6 sm:px-6 sm:py-10">
      <div className="skeleton h-11 w-40 rounded-full" aria-hidden="true" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
