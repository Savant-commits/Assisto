"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/avatar";
import ProjectChat from "@/components/project-chat";
import { PageHeading } from "@/components/page-heading";

export default function MessageConversationPage({ params }: { params: Promise<{ enquiryId: string }> }) {
  const [projectId, setProjectId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("Conversation");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [canSend, setCanSend] = useState(false);
  const [notificationRefreshVersion, setNotificationRefreshVersion] = useState(0);

  useEffect(() => {
    function handleNotificationRefresh(event: Event) {
      const href = (event as CustomEvent<{ href?: string }>).detail?.href;
      if (!href) return;
      const target = new URL(href, window.location.origin);
      if (target.pathname === window.location.pathname) {
        setNotificationRefreshVersion((version) => version + 1);
      }
    }
    window.addEventListener("app:notification-refresh", handleNotificationRefresh);
    return () => window.removeEventListener("app:notification-refresh", handleNotificationRefresh);
  }, []);

  useEffect(() => {
    let mounted = true;
    void params.then(({ enquiryId }) => {
      setProjectId(enquiryId);
      void load(enquiryId);
    });

    async function load(projectIdParam: string) {
      setLoading(true);
      setError(null);
      const supabase = createClient();
      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError || !userData.user) {
        if (mounted) {
          setError("Please sign in to view this conversation.");
          setLoading(false);
        }
        return;
      }

      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("id,enquiry_id,enquiries(id,status,customer_id,provider_id,profiles!enquiries_customer_id_fkey(full_name,avatar_url),providers(id,business_name,profiles!providers_id_fkey(full_name,avatar_url)))")
        .eq("id", projectIdParam)
        .maybeSingle();

      if (!mounted) return;
      if (projectError || !project) {
        setError("Conversation not found.");
        setLoading(false);
        return;
      }

      const enquiry = Array.isArray(project.enquiries) ? project.enquiries[0] : project.enquiries;
      if (!enquiry) {
        setError("Conversation not found.");
        setLoading(false);
        return;
      }

      const isCustomer = enquiry.customer_id === userData.user.id;
      let displayName = "Conversation";
      let displayAvatar: string | null = null;
      if (isCustomer) {
        const provider = Array.isArray(enquiry.providers) ? enquiry.providers[0] : enquiry.providers;
        const providerProfiles = provider?.profiles;
        const profile = Array.isArray(providerProfiles) ? providerProfiles[0] : providerProfiles;
        displayName = provider?.business_name?.trim() || profile?.full_name?.trim() || "Provider";
        displayAvatar = profile?.avatar_url ?? null;
      } else {
        const profiles = Array.isArray(enquiry.profiles) ? enquiry.profiles[0] : enquiry.profiles;
        displayName = profiles?.full_name?.trim() || "Customer";
        displayAvatar = profiles?.avatar_url ?? null;
      }

      setCurrentUserId(userData.user.id);
      setName(displayName);
      setAvatarUrl(displayAvatar);
      setStatus(String(enquiry.status));
      setCanSend(String(enquiry.status) === "confirmed");
      setLoading(false);
    }

    return () => { mounted = false; };
  }, [notificationRefreshVersion, params]);

  if (loading) {
    return (
      <main className="mx-auto flex min-h-[calc(100dvh-var(--bottom-nav-height))] w-full max-w-3xl flex-col px-4 py-6">
        <div className="skeleton h-20 rounded-2xl" />
        <div className="mt-4 flex-1 space-y-3"><div className="skeleton h-16 rounded-2xl" /><div className="skeleton h-16 rounded-2xl" /><div className="skeleton h-16 rounded-2xl" /></div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Link href="/messages" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted"><ArrowLeft className="size-4" />Back to messages</Link>
        <div role="alert" className="mt-5 rounded-2xl border border-border bg-card p-6 text-sm text-destructive">{error}</div>
      </main>
    );
  }

  const history = ["completed", "cancelled", "declined"].includes(status);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-[calc(env(safe-area-inset-top)_+_1.5rem)] pb-[calc(var(--bottom-nav-height)+2rem)] sm:pb-6">
      <header className="mb-4 flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
        <Link href="/messages" aria-label="Back to messages" className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft className="size-5" /></Link>
        <Avatar src={avatarUrl} name={name} size={44} className="size-11 rounded-full border border-border bg-muted text-sm text-muted-foreground" />
        <PageHeading title={name} description={<span className="capitalize">{status === "sent" ? "New" : status}</span>} className="mb-0 min-w-0 flex-1 pt-0" />
      </header>
      <section className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-5">
        <ProjectChat
          key={`${projectId}:${notificationRefreshVersion}`}
          projectId={projectId}
          currentUserId={currentUserId}
          canSend={canSend && !history}
          otherPartyName={name}
          readOnlyReason={status === "cancelled" ? "This enquiry was cancelled. Messaging is closed." : history ? "This conversation is read-only." : null}
        />
      </section>
    </main>
  );
}
