"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function SectionError({ label }: { label: string }) {
  const router = useRouter();
  return (
    <div role="alert" className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-soft">
      <p className="font-medium">{label} could not be loaded.</p>
      <Button type="button" variant="outline" className="mt-3 min-h-11" onClick={() => router.refresh()}>
        Try again
      </Button>
    </div>
  );
}
