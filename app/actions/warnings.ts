"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

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

export async function sendWarning({
  recipientId,
  title,
  body,
  reportId,
}: {
  recipientId: string;
  title: string;
  body: string;
  reportId?: string;
}) {
  await requireAdmin();

  const supabase = await createClient();
  const { error: rpcError } = await supabase.rpc("admin_send_warning", {
    p_recipient_id: recipientId,
    p_title: title,
    p_body: body,
    p_report_id: reportId ?? null,
  });
  if (rpcError) throw new Error(rpcError.message);

  const adminClient = createAdminClient();
  const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(recipientId);

  if (userError || !userData?.user?.email) {
    console.error("Could not fetch recipient email:", userError);
    return { emailSent: false };
  }

  try {
    await sendEmail({
      to: userData.user.email,
      subject: title,
      html: `<p>${body}</p><p style="color:#888;font-size:12px">This is an official warning from the Assisto team.</p>`,
    });
    return { emailSent: true };
  } catch (emailError) {
    console.error("Email send failed (in-app notification still sent):", emailError);
    return { emailSent: false };
  }
}
