import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

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
        <Link href="/requirements/new" className={buttonVariants({ size: "lg" })}>
          Describe what you need
        </Link>
        <Link href="/discover" className={buttonVariants({ size: "lg", variant: "outline" })}>
          Browse professionals
        </Link>
      </div>
    </div>
  );
}
