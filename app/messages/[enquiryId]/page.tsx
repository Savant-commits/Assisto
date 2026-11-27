"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/avatar";
import ProjectChat from "@/components/project-chat";

export default function MessageConversationPage({ params }: { params: Promise<{ enquiryId: string }> }) {
  const mainRef = useRef<HTMLElement>(null);
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
    const main = mainRef.current;
    if (!main) return;
    const viewport = window.visualViewport;
    const updateViewport = () => {
      main.style.height = `${viewport?.height ?? window.innerHeight}px`;
      main.style.top = `${viewport?.offsetTop ?? 0}px`;
    };

    updateViewport();
    viewport?.addEventListener("resize", updateViewport);
    viewport?.addEventListener("scroll", updateViewport);
    window.addEventListener("resize", updateViewport);
    return () => {
      viewport?.removeEventListener("resize", updateViewport);
      viewport?.removeEventListener("scroll", updateViewport);
      window.removeEventListener("resize", updateViewport);
    };
  }, []);

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
      <main ref={mainRef} className="fixed inset-x-0 top-0 z-30 flex h-[100dvh] flex-col overflow-hidden bg-background">
        <div className="mx-auto w-full max-w-[720px] shrink-0 px-3 pb-3 pt-[calc(env(safe-area-inset-top)+0.5rem)] sm:px-5">
          <div className="skeleton h-12 rounded-2xl" />
        </div>
        <div className="mx-auto flex min-h-0 w-full max-w-[720px] flex-1 flex-col gap-3 overflow-hidden px-3 sm:px-5">
          <div className="skeleton h-16 shrink-0 rounded-2xl" />
          <div className="skeleton h-16 shrink-0 rounded-2xl" />
          <div className="skeleton h-16 shrink-0 rounded-2xl" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main ref={mainRef} className="fixed inset-x-0 top-0 z-30 flex h-[100dvh] flex-col overflow-hidden bg-background">
        <div className="mx-auto w-full max-w-[720px] px-3 pb-3 pt-[calc(env(safe-area-inset-top)+0.5rem)] sm:px-5">
          <Link href="/messages" aria-label="Back to messages" className="inline-flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft aria-hidden="true" className="size-5" /></Link>
        </div>
        <div className="mx-auto w-full max-w-[720px] px-3 sm:px-5">
          <div role="alert" className="rounded-2xl border border-border bg-card p-6 text-sm text-destructive">{error}</div>
        </div>
      </main>
    );
  }

  const history = ["completed", "cancelled", "declined"].includes(status);
  const statusLabel = status === "sent" ? "New" : `${status.charAt(0).toLocaleUpperCase()}${status.slice(1)}`;

  return (
    <main ref={mainRef} className="fixed inset-x-0 top-0 z-30 flex h-[100dvh] flex-col overflow-hidden bg-background pb-[env(safe-area-inset-bottom)]">
      <header className="mx-auto flex w-full max-w-[720px] shrink-0 items-center gap-3 border-b border-border bg-background px-3 pb-3 pt-[calc(env(safe-area-inset-top)+0.5rem)] sm:px-5 sm:pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <Link href="/messages" aria-label="Back to messages" className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft aria-hidden="true" className="size-5" /></Link>
        <Avatar src={avatarUrl} name={name} size={44} className="size-11 shrink-0 rounded-full border border-border bg-muted text-sm text-muted-foreground" />
        <h1 className="min-w-0 flex-1 truncate font-display text-lg font-semibold text-foreground sm:text-xl">{name}</h1>
        <Link
          href={`/projects/${encodeURIComponent(projectId)}`}
          aria-label={`View enquiry, status ${statusLabel}`}
          title="View enquiry"
          className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4 sm:text-sm ${status === "cancelled" || status === "declined" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}
        >
          {statusLabel}
        </Link>
      </header>
      <section aria-label="Conversation" className="mx-auto flex min-h-0 w-full max-w-[720px] flex-1 flex-col overflow-hidden px-0 sm:px-5">
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
