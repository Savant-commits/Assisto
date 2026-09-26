import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export default async function NotificationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return notFound();

  const { data: notification } = await supabase
    .from("notifications")
    .select("id,title,body,is_read,type,related_id,created_at,recipient_id")
    .eq("id", id)
    .maybeSingle();

  if (!notification || notification.recipient_id !== userData.user.id) return notFound();

  if (!notification.is_read) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">{notification.title}</h1>
        <div className="text-sm text-muted-foreground">{new Date(notification.created_at).toLocaleString()}</div>
      </div>
      <div className="prose max-w-full">{notification.body}</div>
    </main>
  );
}
