"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import LoadingSpinner from "@/components/loading-spinner";

type Category = { id: number; slug: string; name: string; sort_order: number };
type Service = { id: number; slug: string; name: string; category_id?: number; sort_order?: number };

export default function ManageServicesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  // Committed state: what's actually saved in Supabase
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]);
  // Draft state: what the checkboxes currently show (local only)
  const [draftCategoryIds, setDraftCategoryIds] = useState<number[]>([]);
  const [draftServiceIds, setDraftServiceIds] = useState<number[]>([]);
  const [serviceEditCredits, setServiceEditCredits] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const supabase = createClient();
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

      setServiceEditCredits((provider as any)?.service_edit_credits ?? 0);

      // Fetch categories, services, and this provider's selections in parallel
      const [catRes, svcRes, provCatRes, provSvcRes] = await Promise.all([
        supabase.from("service_categories").select("id,slug,name,sort_order").order("sort_order"),
        supabase.from("services").select("id,slug,name,category_id,sort_order").eq("is_active", true).order("category_id").order("sort_order"),
        supabase.from("provider_categories").select("category_id").eq("provider_id", userData.user.id),
        supabase.from("provider_services").select("service_id").eq("provider_id", userData.user.id),
      ]);

      if (!mounted) return;

      setCategories((catRes.data as any) || []);
      setServices((svcRes.data as any) || []);
      const provCatIds = ((provCatRes.data as any) || []).map((r: any) => r.category_id);
      const provSvcIds = ((provSvcRes.data as any) || []).map((r: any) => r.service_id);
      setSelectedCategoryIds(provCatIds);
      setSelectedServiceIds(provSvcIds);
      setDraftCategoryIds(provCatIds);
      setDraftServiceIds(provSvcIds);
      setLoading(false);
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  function toggleService(service: Service, on: boolean) {
    if (on) {
      setDraftServiceIds((s) => Array.from(new Set([...s, service.id])));
    } else {
      setDraftServiceIds((s) => s.filter((id) => id !== service.id));
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
      setSelectedCategoryIds(draftCategoryIds);
      // Update credits with the returned value
      setServiceEditCredits(data);
    } catch (err: any) {
      setError(err?.message || "Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size={10} />
      </div>
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

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6">
        <h1 className="mb-1 text-2xl font-semibold">Categories & services</h1>
        <p className="text-muted-foreground">Choose which categories and services you offer. Your selections determine where you appear when customers search.</p>
      </div>

      {/* Service edits banner */}
      {serviceEditCredits !== null && (
        <div className="mb-4 rounded-md p-3">
          {serviceEditCredits > 0 ? (
            <p className="text-sm">You have {serviceEditCredits} edit{serviceEditCredits !== 1 ? "s" : ""} left for your services. Choose carefully.</p>
          ) : (
            <p className="text-sm text-muted-foreground">You've used all your service edits. Contact support to request more.</p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      <div className="space-y-4">
        {categories.map((cat) => (
          <div key={cat.id} className="rounded-lg border p-4">
            <label className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={draftCategoryIds.includes(cat.id)}
                  onChange={(e) => toggleCategory(cat, e.target.checked)}
                  disabled={isSaving}
                />
                <div className="font-medium">{cat.name}</div>
              </div>
            </label>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {(servicesByCategory.get(cat.id) || []).map((svc) => (
                <label key={svc.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draftServiceIds.includes(svc.id)}
                    onChange={(e) => toggleService(svc, e.target.checked)}
                    disabled={isSaving}
                  />
                  <span>{svc.name}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 space-y-4">
        <div className="flex items-center gap-4">
          <button
            onClick={saveChanges}
            disabled={
              isSaving ||
              serviceEditCredits === 0 ||
              JSON.stringify(draftServiceIds.sort((a, b) => a - b)) ===
                JSON.stringify(selectedServiceIds.sort((a, b) => a - b))
            }
            className="rounded-md bg-blue-600 px-4 py-2 text-white disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-blue-700"
          >
            {isSaving ? "Saving..." : "Save changes"}
          </button>
          {JSON.stringify(draftServiceIds.sort((a, b) => a - b)) !==
            JSON.stringify(selectedServiceIds.sort((a, b) => a - b)) && (
            <span className="text-sm text-amber-600">You have unsaved changes</span>
          )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <div className="mt-8">
        <Link href="/profile" className="text-sm text-blue-600 underline">
          Back to profile
        </Link>
      </div>
    </div>
  );
}
