"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";

export function ProviderRecruitment() {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <section aria-labelledby="recruitment-heading" className="grid items-center gap-6 rounded-3xl border border-border bg-card p-5 text-card-foreground shadow-soft sm:p-8 lg:grid-cols-2 lg:gap-10">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-sage">
        {!imageFailed && <Image src="/images/join/professional-at-work.jpg" alt="" fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" onError={() => setImageFailed(true)} />}
      </div>
      <div className="max-w-xl py-2 lg:py-8">
        <h2 id="recruitment-heading" className="font-display text-3xl sm:text-4xl">Are you a skilled professional?</h2>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">Showcase your work, build your profile and connect with customers looking for your skills.</p>
        <Link href="/apply" className={buttonVariants({ className: "mt-6 min-h-11 px-5" })}>Join Assisto</Link>
      </div>
    </section>
  );
}
