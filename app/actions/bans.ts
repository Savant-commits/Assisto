"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

const VALID_DURATIONS = new Set(["1_week", "1_year", "permanent"]);
const BAN_DURATIONS: Record<"1_week" | "1_year" | "permanent", string> = {
  "1_week": "168h",
  "1_year": "8760h",
  permanent: "876000h",
};

async function requireAdmin() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Not signed in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (profile?.role !== "admin") throw new Error("Not authorized");
  return userData.user.id;
}

export async function banUser({
  userId,
  reportId,
  duration,
  reason,
}: {
  userId: string;
  reportId?: string;
  duration: "1_week" | "1_year" | "permanent";
  reason: string;
}) {
  await requireAdmin();

  if (!VALID_DURATIONS.has(duration)) {
    throw new Error("Invalid ban duration");
  }

  const cleanReason = reason.trim();
  if (cleanReason.length < 3) {
    throw new Error("Reason must be at least 3 characters");
  }

  const supabase = await createClient();
  const { data: banData, error: rpcError } = await supabase.rpc("admin_record_ban", {
    p_user_id: userId,
    p_report_id: reportId ?? null,
    p_duration: duration,
    p_reason: cleanReason,
  });

  if (rpcError) throw new Error(rpcError.message);

  const banId = (banData as { ban_id?: string } | null)?.ban_id;
  const bannedUntil = (banData as { banned_until?: string | null } | null)?.banned_until ?? null;

  const adminClient = createAdminClient();
  const { error: authError } = await adminClient.auth.admin.updateUserById(userId, {
    ban_duration: BAN_DURATIONS[duration],
  });

  if (authError) {
    try {
      await supabase.rpc("admin_lift_ban", { p_ban_id: banId });
    } catch {
      // Intentionally swallow rollback errors here so we can surface the original auth issue cleanly.
    }
    throw new Error(`Ban could not be applied in auth: ${authError.message}`);
  }

  let emailSent = false;
  try {
    const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(userId);
    if (userError || !userData?.user?.email) {
      console.error("Could not fetch suspended user email:", userError);
    } else {
      const durationLabel = duration === "permanent" ? "permanently" : `for ${duration === "1_week" ? "1 week" : "1 year"}`;
      const reasonText = `The reason given was: ${cleanReason}`;
      await sendEmail({
        to: userData.user.email,
        subject: "Your Assisto account has been suspended",
        html: `
          <p>Your Assisto account has been suspended ${durationLabel}.</p>
          <p>${reasonText}</p>
          <p>If you think this is a mistake, please reply to this email to appeal this decision.</p>
        `,
      });
      emailSent = true;
    }
  } catch (emailError) {
    console.error("Email send failed after ban was recorded:", emailError);
  }

  revalidatePath("/admin/bans");
  revalidatePath("/admin/chats");

  return { emailSent, banId, bannedUntil };
}

export async function liftBan(banId: string) {
  await requireAdmin();

  const supabase = await createClient();
  const { data: banRow, error: banRowError } = await supabase
    .from("user_bans")
    .select("user_id, banned_until, lifted_at")
    .eq("id", banId)
    .single();

  if (banRowError) throw new Error(banRowError.message);

  const { error: rpcError } = await supabase.rpc("admin_lift_ban", { p_ban_id: banId });
  if (rpcError) throw new Error(rpcError.message);

  const nowIso = new Date().toISOString();
  const { data: remainingActiveBans, error: remainingError } = await supabase
    .from("user_bans")
    .select("id")
    .eq("user_id", banRow.user_id)
    .is("lifted_at", null)
    .gt("banned_until", nowIso);

  if (remainingError) {
    console.error("Could not check remaining active bans:", {
      message: remainingError.message,
      details: remainingError.details,
      hint: remainingError.hint,
      code: remainingError.code,
    });
  }

  if (!remainingActiveBans || remainingActiveBans.length === 0) {
    const adminClient = createAdminClient();
    try {
      await adminClient.auth.admin.updateUserById(banRow.user_id, { ban_duration: "none" });
    } catch (error) {
      console.error("Could not clear auth ban on lift:", error);
    }
  }

  revalidatePath("/admin/bans");
  return { ok: true };
}
