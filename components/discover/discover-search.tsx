"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ServiceCombobox, { type Service } from "@/components/service-combobox";
import { useServices } from "@/hooks/use-services";

export default function DiscoverSearch({
  city,
  category,
  requirement,
  initialSlug,
}: {
  city?: string;
  category?: string;
  requirement?: string;
  initialSlug?: string;
}) {
  const router = useRouter();
  const { allServices } = useServices();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Service | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function navigateToService(service: Service) {
    const params = new URLSearchParams();
    if (city) params.set("city", city);
    if (category) params.set("category", category);
    params.set("service", service.slug);
    if (requirement) params.set("requirement", requirement);
    router.push(`/discover?${params.toString()}`);
  }

  function executeSearch() {
    if (selected) {
      navigateToService(selected);
      return;
    }

    const normalized = query.trim().toLocaleLowerCase();
    const match = allServices.find((service) =>
      service.name.toLocaleLowerCase() === normalized || service.slug.toLocaleLowerCase() === normalized,
    ) ?? allServices.find((service) =>
      service.name.toLocaleLowerCase().includes(normalized) || service.slug.toLocaleLowerCase().includes(normalized),
    );

    if (!normalized || !match) {
      setMessage("No matching service");
      return;
    }

    setMessage(null);
    navigateToService(match);
  }

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        executeSearch();
      }}
      className="relative z-[60] mb-3 flex min-w-0 items-start gap-2 [&_ul]:z-[70] [&_ul]:mt-2 [&_ul]:max-h-[min(16rem,calc(100dvh-var(--bottom-nav-height)-2rem))] [&_ul]:overflow-y-auto [&_ul]:rounded-xl [&_ul]:border [&_ul]:border-border [&_ul]:bg-card [&_ul]:text-card-foreground [&_ul]:shadow-lifted"
    >
      <div className="min-w-0 flex-1">
        <ServiceCombobox
          value={query}
          initialSlug={initialSlug}
          placeholder="Service (e.g. Interior painting)"
          ariaLabel="Search services"
          submitOnEnter
          showClearButton
          clearLabel="Clear search"
          inputClassName="h-11 pr-10"
          onChange={(next) => {
            setQuery(next);
            setSelected(null);
            setMessage(null);
          }}
          onSelect={(service) => {
            setSelected(service);
            if (service) setMessage(null);
          }}
        />
      </div>
      <button
        type="submit"
        className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Search
      </button>
      {message && <p role="status" className="absolute left-0 top-full mt-1 text-sm text-destructive">{message}</p>}
    </form>
  );
}
