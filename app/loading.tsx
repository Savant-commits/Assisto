import LoadingSpinner from "@/components/loading-spinner";

export default function Loading() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <LoadingSpinner size={12} />
        <div className="mt-4 text-sm text-muted-foreground">Loading…</div>
      </div>
    </div>
  );
}
