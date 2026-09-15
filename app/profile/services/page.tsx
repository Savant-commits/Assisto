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
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]);
  const [serviceEditCredits, setServiceEditCredits] = useState<number | null>(null);
  const [pending, setPending] = useState<Record<string, boolean>>({});
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
      setSelectedCategoryIds(((provCatRes.data as any) || []).map((r: any) => r.category_id));
      setSelectedServiceIds(((provSvcRes.data as any) || []).map((r: any) => r.service_id));
      setLoading(false);
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  // Helpers to mark pending by key
  function setPendingFor(key: string, v: boolean) {
    setPending((p) => ({ ...p, [key]: v }));
  }

  async function toggleService(service: Service, on: boolean) {
    setError(null);
    const supabase = createClient();
    const key = `service:${service.id}`;
    setPendingFor(key, true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push(`/login?redirect=/profile/services`);
        return;
      }

      if (on) {
        // insert provider_services
        const { error: insertErr } = await supabase.from("provider_services").insert({ provider_id: userData.user.id, service_id: service.id });
        if (insertErr) throw insertErr;

        // ensure category row exists
        const catId = service.category_id;
        if (catId && !selectedCategoryIds.includes(catId)) {
          const { error: catErr } = await supabase.from("provider_categories").insert({ provider_id: userData.user.id, category_id: catId });
          if (catErr) throw catErr;
          setSelectedCategoryIds((s) => [...s, catId]);
        }

        setSelectedServiceIds((s) => Array.from(new Set([...s, service.id])));
      } else {
        // delete provider_services row
        const { error: delErr } = await supabase.from("provider_services").delete().eq("provider_id", userData.user.id).eq("service_id", service.id);
        if (delErr) throw delErr;
        setSelectedServiceIds((s) => s.filter((id) => id !== service.id));
      }
      // On any successful service toggle (add or remove), decrement local credits
      setServiceEditCredits((c) => (c !== null ? Math.max(0, c - 1) : c));
    } catch (err: any) {
      // If the trigger raised an exception about edits, show that message inline
      setError(err?.message || "Action failed");
    } finally {
      setPendingFor(key, false);
    }
  }

  async function toggleCategory(category: Category, on: boolean) {
    setError(null);
    const supabase = createClient();
    const key = `category:${category.id}`;
    setPendingFor(key, true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push(`/login?redirect=/profile/services`);
        return;
      }

      if (on) {
        const { error: insertErr } = await supabase.from("provider_categories").insert({ provider_id: userData.user.id, category_id: category.id });
        if (insertErr) throw insertErr;
        setSelectedCategoryIds((s) => Array.from(new Set([...s, category.id])));
      } else {
        // find services under this category
        const svcIds = services.filter((s) => s.category_id === category.id).map((s) => s.id);
        if (svcIds.length > 0) {
          const { error: delSvErr } = await supabase.from("provider_services").delete().eq("provider_id", userData.user.id).in("service_id", svcIds);
          if (delSvErr) throw delSvErr;
          setSelectedServiceIds((s) => s.filter((id) => !svcIds.includes(id)));
        }

        const { error: delCatErr } = await supabase.from("provider_categories").delete().eq("provider_id", userData.user.id).eq("category_id", category.id);
        if (delCatErr) throw delCatErr;
        setSelectedCategoryIds((s) => s.filter((id) => id !== category.id));
      }
    } catch (err: any) {
      setError(err?.message || "Action failed");
    } finally {
      setPendingFor(key, false);
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
                  checked={selectedCategoryIds.includes(cat.id)}
                  onChange={(e) => toggleCategory(cat, e.target.checked)}
                  disabled={(serviceEditCredits === 0) || !!pending[`category:${cat.id}`]}
                />
                <div className="font-medium">{cat.name}</div>
              </div>
            </label>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {(servicesByCategory.get(cat.id) || []).map((svc) => (
                <label key={svc.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedServiceIds.includes(svc.id)}
                    onChange={(e) => toggleService(svc, e.target.checked)}
                    disabled={(serviceEditCredits === 0) || !!pending[`service:${svc.id}`]}
                  />
                  <span>{svc.name}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <Link href="/profile" className="text-sm text-blue-600 underline">
          Back to profile
        </Link>
      </div>
    </div>
  );
}
