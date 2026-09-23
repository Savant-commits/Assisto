"use client";

import React from "react";
import { useRouter } from "next/navigation";
import ServiceCombobox from "@/components/service-combobox";

export default function ServicePicker({ initialSlug, category, city, requirement }: { initialSlug?: string; category?: string; city?: string; requirement?: string }) {
  const router = useRouter();

  function handleSelect(s: any | null) {
    const qp = new URLSearchParams();
    if (city) qp.set("city", city);
    if (category) qp.set("category", category);
    if (s && s.slug) qp.set("service", s.slug);
    if (requirement) qp.set("requirement", requirement);
    router.push(`/discover?${qp.toString()}`);
  }

  return <ServiceCombobox initialSlug={initialSlug} onSelect={handleSelect} />;
}
