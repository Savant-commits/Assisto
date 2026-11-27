"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronDown, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";

type Category = { id: number; slug: string; name: string; sort_order: number };
type Service = { id: number; slug: string; name: string; category_id?: number; sort_order?: number };

export default function ManageServicesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  // Committed state: what's actually saved in Supabase
  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]);
  // Draft state: what the checkboxes currently show (local only)
  const [draftCategoryIds, setDraftCategoryIds] = useState<number[]>([]);
  const [draftServiceIds, setDraftServiceIds] = useState<number[]>([]);
  const [serviceEditCredits, setServiceEditCredits] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<number[]>([]);
  const [confirmCreditOpen, setConfirmCreditOpen] = useState(false);
  const selectedIds = new Set(draftServiceIds);
  const hasChanges = JSON.stringify([...draftServiceIds].sort((a, b) => a - b)) !== JSON.stringify([...selectedServiceIds].sort((a, b) => a - b));
  const selectedServiceCount = draftServiceIds.length;
  const selectedCategoryCount = draftCategoryIds.filter((categoryId) => categories.some((category) => category.id === categoryId)).length;

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setLoadError(null);
      const supabase = createClient();
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          router.push(`/login?redirect=/profile/services`);
          return;
        }

        // Ensure user is a provider and get service edit credits
        const { data: provider } = await supabase
          .from("providers")
          .select("id,service_edit_credits")
          .eq("id", userData.user.id)
          .single();
        if (!provider) {
          router.push("/apply");
          return;
        }

        setServiceEditCredits(provider.service_edit_credits ?? 0);

        // Fetch categories, services, and this provider's selections in parallel
        const [catRes, svcRes, provCatRes, provSvcRes] = await Promise.all([
          supabase.from("service_categories").select("id,slug,name,sort_order").order("sort_order"),
          supabase.from("services").select("id,slug,name,category_id,sort_order").eq("is_active", true).order("category_id").order("sort_order"),
          supabase.from("provider_categories").select("category_id").eq("provider_id", userData.user.id),
          supabase.from("provider_services").select("service_id").eq("provider_id", userData.user.id),
        ]);

        if (!mounted) return;
        const queryError = catRes.error || svcRes.error || provCatRes.error || provSvcRes.error;
        if (queryError) {
          setLoadError(queryError.message || "Unable to load categories and services.");
          setLoading(false);
          return;
        }

        setCategories(catRes.data ?? []);
        setServices(svcRes.data ?? []);
        const provCatIds = (provCatRes.data ?? []).map((row) => row.category_id);
        const provSvcIds = (provSvcRes.data ?? []).map((row) => row.service_id);
        setSelectedServiceIds(provSvcIds);
        setDraftCategoryIds(provCatIds);
        setDraftServiceIds(provSvcIds);
        const initiallyExpanded = (catRes.data ?? []).flatMap((category) =>
          (svcRes.data ?? []).some((service) => service.category_id === category.id && provSvcIds.includes(service.id)) ? [category.id] : []
        );
        setExpandedCategoryIds(initiallyExpanded);
        setLoading(false);
      } catch (loadFailure: unknown) {
        if (!mounted) return;
        setLoadError(loadFailure instanceof Error ? loadFailure.message : "Unable to load categories and services.");
        setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [loadAttempt, router]);

  function toggleService(service: Service, on: boolean) {
    if (on) {
      setDraftServiceIds((s) => Array.from(new Set([...s, service.id])));
      if (service.category_id !== undefined) setDraftCategoryIds((s) => Array.from(new Set([...s, service.category_id!])));
    } else {
      setDraftServiceIds((s) => s.filter((id) => id !== service.id));
      if (service.category_id !== undefined) {
        const remainingInCategory = services.some((item) => item.category_id === service.category_id && item.id !== service.id && selectedIds.has(item.id));
        if (!remainingInCategory) setDraftCategoryIds((s) => s.filter((id) => id !== service.category_id));
      }
    }
  }

  function toggleCategory(category: Category, on: boolean) {
    const svcIds = services.filter((s) => s.category_id === category.id).map((s) => s.id);

    if (on) {
      setDraftCategoryIds((s) => Array.from(new Set([...s, category.id])));
      setDraftServiceIds((s) => Array.from(new Set([...s, ...svcIds])));
    } else {
      setDraftCategoryIds((s) => s.filter((id) => id !== category.id));
      setDraftServiceIds((s) => s.filter((id) => !svcIds.includes(id)));
    }
  }

  async function saveChanges() {
    setError(null);
    setIsSaving(true);
    try {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc("save_provider_services", {
        p_service_ids: draftServiceIds,
      });

      if (rpcError) throw rpcError;

      // Update committed state to match draft
      setSelectedServiceIds(draftServiceIds);
      // Update credits with the returned value
      setServiceEditCredits(data);
    } catch (err: unknown) {
      setError(
        typeof err === "object" && err !== null && "message" in err && typeof err.message === "string"
          ? err.message
          : "Failed to save changes"
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (loading) {
    return (
      <main aria-busy="true" className="mx-auto max-w-3xl px-4 pb-32 pt-0 sm:px-6">
        <PageHeading title="Categories & services" description="Choose the services you offer so nearby customers can find you." />
        <div className="sticky top-0 z-20 mb-5 rounded-2xl border border-border bg-background/95 p-4 shadow-sm backdrop-blur">
          <div className="skeleton h-5 w-56 rounded" />
          <div className="skeleton mt-2 h-4 w-24 rounded" />
        </div>
        <div className="skeleton mb-5 h-11 rounded-xl" />
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, index) => <div key={index} className="skeleton h-16 rounded-2xl" />)}
        </div>
        <div className="fixed inset-x-0 bottom-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom))] z-30 border-t border-border bg-background/95 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-3xl gap-3"><div className="skeleton h-11 flex-1 rounded-full" /><div className="skeleton h-11 w-24 rounded-full" /></div>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="mx-auto max-w-3xl px-4 pb-28 pt-0 sm:px-6">
        <PageHeading title="Categories & services" description="Choose the services you offer so nearby customers can find you." />
        <section role="alert" className="rounded-2xl border border-border bg-card p-6 text-card-foreground">
          <p className="text-sm text-destructive">{loadError}</p>
          <Button type="button" variant="outline" className="mt-4 min-h-11" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Retry</Button>
        </section>
      </main>
    );
  }

  // group services by category id for rendering
  const servicesByCategory = new Map<number, Service[]>();
  for (const s of services) {
    const cid = s.category_id ?? 0;
    const arr = servicesByCategory.get(cid) || [];
    arr.push(s);
    servicesByCategory.set(cid, arr);
  }

  const serviceById = new Map(services.map((service) => [service.id, service]));
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredCategories = categories.map((category) => ({
    category,
    services: (servicesByCategory.get(category.id) ?? []).filter((service) => !normalizedSearch || service.name.toLocaleLowerCase().includes(normalizedSearch)),
  })).filter(({ services: categoryServices }) => categoryServices.length > 0);

  function toggleExpanded(categoryId: number) {
    setExpandedCategoryIds((ids) => ids.includes(categoryId) ? ids.filter((id) => id !== categoryId) : [...ids, categoryId]);
  }

  function discardChanges() {
    setDraftServiceIds([...selectedServiceIds]);
    setDraftCategoryIds(categories.flatMap((category) => services.some((service) => service.category_id === category.id && selectedServiceIds.includes(service.id)) ? [category.id] : []));
    setConfirmCreditOpen(false);
    setError(null);
  }

  function requestSave() {
    if (!hasChanges || isSaving || serviceEditCredits === 0) return;
    if (serviceEditCredits !== null && serviceEditCredits > 0) {
      setConfirmCreditOpen(true);
      return;
    }
    void saveChanges();
  }

  async function confirmSave() {
    setConfirmCreditOpen(false);
    await saveChanges();
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-[calc(var(--bottom-nav-height)+5rem+env(safe-area-inset-bottom))] pt-0 sm:px-6">
      <PageHeading title="Categories & services" description="Choose the services you offer so nearby customers can find you." />

      <div className="sticky top-[env(safe-area-inset-top)] z-20 mb-5 rounded-2xl border border-border bg-background/95 p-4 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold text-foreground">{selectedServiceCount} {selectedServiceCount === 1 ? "service" : "services"} selected in {selectedCategoryCount} {selectedCategoryCount === 1 ? "category" : "categories"}</p>
          <p className="text-sm text-muted-foreground">{serviceEditCredits ?? 0} edits left</p>
        </div>
        {draftServiceIds.length > 0 && (
          <div className="scrollbar-none mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Your selection">
            {draftServiceIds.flatMap((id) => {
              const service = serviceById.get(id);
              if (!service) return [];
              return (
                <button key={id} type="button" onClick={() => toggleService(service, false)} disabled={isSaving} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-primary/10 px-4 text-sm font-medium text-primary hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" aria-label={`Remove ${service.name}`}>
                  {service.name}<X aria-hidden="true" className="size-4" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      <label className="relative mb-5 block">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search services" aria-label="Search services" className="min-h-11 w-full rounded-xl border border-input bg-background pl-10 pr-3 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </label>

      {error && <p role="alert" className="mb-4 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {serviceEditCredits === 0 && <p className="mb-4 text-sm text-muted-foreground">You&apos;ve used all your service edits. Contact support to request more.</p>}

      {filteredCategories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">No services match “{search.trim()}”. Try another search.</div>
      ) : (
        <div className="space-y-3">
          {filteredCategories.map(({ category, services: categoryServices }) => {
            const allCategoryServices = servicesByCategory.get(category.id) ?? [];
            const selectedCount = allCategoryServices.filter((service) => selectedIds.has(service.id)).length;
            const expanded = normalizedSearch.length > 0 || expandedCategoryIds.includes(category.id);
            const allSelected = allCategoryServices.length > 0 && selectedCount === allCategoryServices.length;
            return (
              <section key={category.id} className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
                <div className="flex min-h-16 items-center gap-2 p-2 sm:p-3">
                  <button type="button" aria-expanded={expanded} onClick={() => toggleExpanded(category.id)} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <ChevronDown aria-hidden="true" className={`size-5 shrink-0 transition-transform motion-reduce:transition-none ${expanded ? "rotate-0" : "-rotate-90"}`} />
                    <span className="min-w-0 flex-1 truncate font-semibold">{category.name}</span>
                    <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{selectedCount} of {allCategoryServices.length}</span>
                  </button>
                  <button type="button" onClick={() => toggleCategory(category, !allSelected)} disabled={isSaving || allCategoryServices.length === 0} aria-pressed={allSelected} className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-border px-3 text-xs font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:px-4 sm:text-sm">
                    {allSelected ? "Clear all" : "Select all"}
                  </button>
                </div>
                {expanded && (
                  <div className="flex flex-wrap gap-2 border-t border-border p-3 sm:p-4">
                    {categoryServices.map((service) => {
                      const selected = selectedIds.has(service.id);
                      return <button key={service.id} type="button" onClick={() => toggleService(service, !selected)} disabled={isSaving} aria-pressed={selected} className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:bg-muted"}`}>{service.name}</button>;
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <Link href="/profile/provider" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft aria-hidden="true" className="size-4" />Back to Provider hub</Link>

      <div className="fixed inset-x-0 bottom-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom))] z-30 border-t border-border bg-background/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Button type="button" className="min-h-11 flex-1 rounded-full" disabled={!hasChanges || isSaving || serviceEditCredits === 0} onClick={requestSave}>{isSaving ? "Saving…" : "Save changes"}</Button>
          <Button type="button" variant="outline" className="min-h-11 rounded-full px-5" disabled={!hasChanges || isSaving} onClick={discardChanges}>Discard</Button>
        </div>
      </div>

      {confirmCreditOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={() => setConfirmCreditOpen(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="service-credit-title" className="w-full max-w-lg rounded-t-3xl border border-border bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-card-foreground shadow-lifted sm:rounded-2xl sm:pb-5" onClick={(event) => event.stopPropagation()}>
            <h2 id="service-credit-title" className="font-display text-2xl font-medium">Use one service edit?</h2>
            <p className="mt-2 text-sm text-muted-foreground">Saving these changes will use one edit credit. You&apos;ll have {Math.max(0, (serviceEditCredits ?? 0) - 1)} {Math.max(0, (serviceEditCredits ?? 0) - 1) === 1 ? "edit" : "edits"} left afterwards.</p>
            <div className="mt-5 flex gap-3">
              <Button type="button" variant="outline" className="min-h-11 flex-1 rounded-full" onClick={() => setConfirmCreditOpen(false)}>Keep editing</Button>
              <Button type="button" className="min-h-11 flex-1 rounded-full" disabled={isSaving} onClick={() => void confirmSave()}>{isSaving ? "Saving…" : "Confirm save"}</Button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
