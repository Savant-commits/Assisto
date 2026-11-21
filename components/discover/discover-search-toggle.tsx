"use client";

import { Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ServiceCombobox, { type Service } from "@/components/service-combobox";
import { useServices } from "@/hooks/use-services";

export default function DiscoverSearchToggle({
  city,
  category,
  requirement,
}: {
  city?: string;
  category?: string;
  requirement?: string;
}) {
  const router = useRouter();
  const { allServices } = useServices();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Service | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const panelId = useId();
  const headerButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      setMessage(null);
      window.setTimeout(() => headerButtonRef.current?.focus(), 0);
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open]);

  function closeAndFocus() {
    setOpen(false);
    setMessage(null);
    window.setTimeout(() => headerButtonRef.current?.focus(), 0);
  }

  function toggleSearch() {
    if (open) {
      closeAndFocus();
    } else {
      setOpen(true);
      setMessage(null);
    }
  }

  function navigateToService(service: Service) {
    const params = new URLSearchParams();
    if (city) params.set("city", city);
    if (category) params.set("category", category);
    if (service.slug) params.set("service", service.slug);
    if (requirement) params.set("requirement", requirement);
    router.push(`/discover?${params.toString()}`);
  }

  function executeSearch() {
    if (selected) {
      navigateToService(selected);
      return;
    }

    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) {
      setMessage("No matching service");
      return;
    }

    const exact = allServices.find((service) =>
      service.name.toLocaleLowerCase() === normalized ||
      service.slug.toLocaleLowerCase() === normalized
    );
    const match = exact ?? allServices.find((service) =>
      service.name.toLocaleLowerCase().includes(normalized) ||
      service.slug.toLocaleLowerCase().includes(normalized)
    );

    if (!match) {
      setMessage("No matching service");
      return;
    }

    setMessage(null);
    navigateToService(match);
  }

  return (
    <div className="sm:block">
      <div className="flex items-center justify-between gap-3 sm:block">
        <h1 className="mb-1 text-2xl font-semibold">Find a professional</h1>
        <button
          ref={headerButtonRef}
          type="button"
          aria-label="Search services"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={toggleSearch}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground sm:hidden"
        >
          <Search aria-hidden="true" className="size-5" />
        </button>
      </div>

      <p className="mb-6 max-sm:mb-3 text-muted-foreground">
        Browse verified professionals in Cuddalore and Chidambaram.
      </p>

      <div
        id={panelId}
        ref={panelRef}
        inert={!open}
        aria-hidden={!open}
        className={`grid transition-[grid-template-rows,opacity] duration-300 motion-reduce:transition-none sm:hidden ${open ? "visible grid-rows-[1fr] overflow-visible opacity-100" : "invisible grid-rows-[0fr] overflow-hidden opacity-0"}`}
      >
        <div className="min-h-0">
          <div
            className="relative z-[60] mb-6 flex items-end gap-2 px-0.5 py-1 [&_ul]:z-[70] [&_ul]:mt-2 [&_ul]:max-h-[min(16rem,calc(100dvh-var(--bottom-nav-height)-2rem))] [&_ul]:overflow-y-auto [&_ul]:rounded-xl [&_ul]:border [&_ul]:border-border [&_ul]:bg-card [&_ul]:text-card-foreground [&_ul]:shadow-lifted"
            onKeyDownCapture={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                executeSearch();
              }
            }}
          >
            <div className="min-w-0 flex-1">
              <ServiceCombobox
                value={query}
                initialSlug={selected?.slug}
                placeholder="Service (e.g. Interior painting)"
                onChange={(next) => {
                  setQuery(next);
                  setSelected(null);
                  setMessage(null);
                }}
                onSelect={(service) => {
                  setSelected(service);
                  setMessage(null);
                  if (service) setQuery(service.name);
                }}
              />
            </div>
            <button
              type="button"
              aria-label="Execute service search"
              onClick={executeSearch}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <Search aria-hidden="true" className="size-5" />
            </button>
          </div>

          {message && <p role="status" className="mb-6 text-sm text-destructive">{message}</p>}
        </div>
      </div>
    </div>
  );
}
