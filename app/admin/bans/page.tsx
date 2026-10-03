import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminBansList, { type UserBanListItem } from "@/components/admin-bans-list";

export default async function AdminBansPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) redirect("/login?redirect=/admin/bans");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userData.user.id).single();
  if (profile?.role !== "admin") redirect("/");

  const { data: bans, error: bansError } = await supabase
    .from("user_bans")
    .select("*")
    .order("created_at", { ascending: false });

  if (bansError) {
    console.error("user_bans query failed:", {
      message: bansError.message,
      details: bansError.details,
      hint: bansError.hint,
      code: bansError.code,
    });
  }

  const userIds = Array.from(new Set((bans ?? []).map((ban) => ban.user_id).filter(Boolean))) as string[];
  const adminIds = Array.from(new Set((bans ?? []).map((ban) => ban.created_by).filter(Boolean))) as string[];

  const [{ data: profileRows }, { data: providerRows }] = await Promise.all([
    userIds.length
      ? supabase.from("profiles").select("id, full_name, user_code").in("id", userIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name?: string | null; user_code?: string | null }> }),
    userIds.length
      ? supabase.from("providers").select("id, business_name, is_active").in("id", userIds)
      : Promise.resolve({ data: [] as Array<{ id: string; business_name?: string | null; is_active?: boolean | null }> }),
  ]);

  const adminRows = adminIds.length
    ? await supabase.from("profiles").select("id, full_name, user_code").in("id", adminIds)
    : { data: [] as Array<{ id: string; full_name?: string | null; user_code?: string | null }> };

  const profileMap = new Map((profileRows ?? []).map((profileRow) => [profileRow.id, profileRow]));
  const providerMap = new Map((providerRows ?? []).map((providerRow) => [providerRow.id, providerRow]));
  const adminMap = new Map((adminRows.data ?? []).map((adminRow) => [adminRow.id, adminRow]));

  const adminBans: UserBanListItem[] = (bans ?? []).map((ban) => ({
    id: ban.id,
    user_id: ban.user_id,
    report_id: ban.report_id,
    reason: ban.reason,
    duration: ban.duration,
    banned_until: ban.banned_until,
    provider_was_active: ban.provider_was_active,
    created_by: ban.created_by,
    created_at: ban.created_at,
    lifted_at: ban.lifted_at,
    lifted_by: ban.lifted_by,
    user: profileMap.get(ban.user_id) ?? null,
    provider: providerMap.get(ban.user_id) ?? null,
    admin: adminMap.get(ban.created_by) ?? null,
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-semibold">Bans (admin)</h1>
      <p className="mb-6 text-muted-foreground">Review active and historical account suspensions.</p>

      <AdminBansList bans={adminBans} />
    </div>
  );
}
