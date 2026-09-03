import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center">
      <h1 className="mb-4 text-4xl font-semibold tracking-tight">
        Find the right person for the job.
      </h1>
      <p className="mb-8 max-w-xl text-muted-foreground">
        Assisto connects you with reviewed, verified service professionals in
        Cuddalore and Chidambaram — interior, construction, renovation,
        exterior and civil engineering work, done right.
      </p>
      <div className="flex gap-3">
        <Button asChild size="lg">
          <Link href="/requirements/new">Describe what you need</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/discover">Browse professionals</Link>
        </Button>
      </div>
    </div>
  );
}
