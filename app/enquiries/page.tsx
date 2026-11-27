"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContactUnlock } from "@/components/contact-unlock";
import { EnquiryDirections } from "@/components/enquiry-directions";
import { CompletionActions } from "@/components/completion-actions";
import { ReviewModal } from "@/components/review-modal";
import { getEligibleEnquiriesForReview } from "@/lib/reviews";
import { friendlyDbError } from "@/lib/db-errors";
import { one } from "@/lib/relations";
import { useLocation } from "@/lib/location/provider";
import { CustomerSummarySheet, type CustomerSummary } from "@/components/enquiries/customer-summary-sheet";
import { RequestDetailsEditor } from "@/components/enquiries/request-details-editor";
import { CancellationSheet, type CancellationReasonCode } from "@/components/enquiries/cancellation-sheet";
import { PageHeading } from "@/components/page-heading";

type SentTab = "pending" | "active" | "history" | "reviews";
type ReceivedTab = "pending" | "active" | "history";

type SentEnquiry = {
  id: number;
  message: string | null;
  status: string;
  created_at: string | null;
  updated_at: string | null;
  decline_reason?: string | null;
  is_asap?: boolean | null;
  scheduled_start_at?: string | null;
  customer_completed_at: string | null;
  provider_completed_at: string | null;
  cancelled_by?: string | null;
  cancelled_at?: string | null;
  cancelled_from_status?: string | null;
  cancel_reason_code?: string | null;
  cancel_reason_note?: string | null;
  admin_cancelled_by?: string | null;
  providers?: {
    id: string;
    business_name?: string | null;
    profiles?: { full_name?: string | null; avatar_url?: string | null } | null;
    lat?: number | null;
    lng?: number | null;
    locality?: string | null;
    city?: string | null;
  } | null;
  customer_requirements?: { description: string | null; city?: string | null } | null;
  projects?: { id: string; project_code: string } | null;
};

type SentEnquiryRow = Omit<SentEnquiry, "providers" | "customer_requirements" | "projects"> & {
  providers?:
    | { id: string; business_name?: string | null; profiles?: { full_name?: string | null; avatar_url?: string | null } | { full_name?: string | null; avatar_url?: string | null }[] | null; lat?: number | null; lng?: number | null; locality?: string | null; city?: string | null }
    | { id: string; business_name?: string | null; profiles?: { full_name?: string | null; avatar_url?: string | null } | { full_name?: string | null; avatar_url?: string | null }[] | null; lat?: number | null; lng?: number | null; locality?: string | null; city?: string | null }[]
    | null;
  customer_requirements?: { description: string | null; city?: string | null } | { description: string | null; city?: string | null }[] | null;
  projects?: { id: string; project_code: string } | { id: string; project_code: string }[] | null;
};

type ReceivedEnquiry = {
  id: number;
  message: string | null;
  status: string;
  created_at: string | null;
  updated_at: string | null;
  decline_reason?: string | null;
  is_asap?: boolean | null;
  scheduled_start_at?: string | null;
  customer_id: string;
  customer_completed_at: string | null;
  provider_completed_at: string | null;
  cancelled_by?: string | null;
  cancelled_at?: string | null;
  cancelled_from_status?: string | null;
  cancel_reason_code?: string | null;
  cancel_reason_note?: string | null;
  admin_cancelled_by?: string | null;
  profiles?: { full_name: string | null; avatar_url?: string | null; city?: string | null; created_at?: string | null } | null;
  customer_requirements?: { description: string | null } | null;
  projects?: { id: string; project_code: string } | null;
};

type ReceivedEnquiryRow = Omit<ReceivedEnquiry, "profiles" | "customer_requirements" | "projects"> & {
  profiles?: { full_name: string | null; avatar_url?: string | null; city?: string | null; created_at?: string | null } | { full_name: string | null; avatar_url?: string | null; city?: string | null; created_at?: string | null }[] | null;
  customer_requirements?: { description: string | null } | { description: string | null }[] | null;
  projects?: { id: string; project_code: string } | { id: string; project_code: string }[] | null;
};

type ReviewRecord = {
  id: string;
  enquiry_id: string | number;
  rating: number;
  comment: string | null;
  created_at: string | null;
};

type ReviewPrompt = {
  enquiryId: number;
  providerName: string;
  existingReview?: ReviewRecord | null;
};

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function statusBadge(status: string) {
  const cls =
    status === "accepted" || status === "confirmed"
      ? "border-accent bg-accent text-accent-foreground"
      : status === "declined" || status === "cancelled"
      ? "border-destructive/20 bg-destructive/10 text-destructive"
      : status === "completed"
      ? "border-border bg-secondary text-secondary-foreground"
      : "border-border bg-muted text-foreground";
  return <Badge variant="outline" className={`capitalize ${cls}`}>{status === "sent" ? "New" : status}</Badge>;
}

function isWithdrawn(enquiry: { status: string; cancelled_from_status?: string | null; cancelled_by?: string | null }, customerId: string | null | undefined) {
  return enquiry.status === "cancelled" && enquiry.cancelled_from_status === "sent" && Boolean(customerId) && enquiry.cancelled_by === customerId;
}

function cancellationReasonLabel(code?: string | null) {
  const labels: Record<string, string> = {
    sent_by_mistake: "The enquiry was sent by mistake",
    work_arranged: "The work has already been arranged",
    timing_not_suitable: "The timing is no longer suitable",
    unable_to_take_work: "I am unable to take on this work at this time",
    scheduling_conflict: "I have a scheduling conflict",
    scope_not_suitable: "The scope of work is not suitable for me",
    other: "Other",
  };
  return code ? labels[code] ?? "Reason not provided" : "Reason not provided";
}

function enquiryStatusBadge(enquiry: { status: string; cancelled_from_status?: string | null; cancelled_by?: string | null }, customerId: string | null | undefined) {
  if (enquiry.status === "cancelled") {
    const withdrawn = isWithdrawn(enquiry, customerId);
    return <Badge variant="outline" className="border-destructive/20 bg-destructive/10 text-destructive">{withdrawn ? "Withdrawn" : "Cancelled"}</Badge>;
  }
  if (enquiry.status === "completed") return <Badge variant="outline" className="border-border bg-secondary text-secondary-foreground">Completed</Badge>;
  if (enquiry.status === "declined") return <Badge variant="outline" className="border-destructive/20 bg-destructive/10 text-destructive">Declined</Badge>;
  return statusBadge(enquiry.status);
}

function cancellationActorLabel(
  enquiry: { cancelled_by?: string | null; admin_cancelled_by?: string | null; cancelled_from_status?: string | null },
  customerId: string | null | undefined,
  currentUserId: string,
  otherPartyName: string,
) {
  if (enquiry.admin_cancelled_by) return "Cancelled by Assisto support";
  const withdrawn = enquiry.cancelled_from_status === "sent" && enquiry.cancelled_by === customerId;
  if (enquiry.cancelled_by === currentUserId) {
    return withdrawn ? "Withdrawn by you" : "Cancelled by you";
  }
  if (withdrawn) return otherPartyName ? `Withdrawn by ${otherPartyName}` : "Withdrawn by the customer";
  return otherPartyName ? `Cancelled by ${otherPartyName}` : "Cancelled by the other party";
}

function isHistoryFilterMatch(
  enquiry: { status: string; customer_id?: string; cancelled_by?: string | null; cancelled_from_status?: string | null },
  customerId: string | null | undefined,
  filter: "all" | "completed" | "cancelled" | "withdrawn",
) {
  const resolvedCustomerId = enquiry.customer_id ?? customerId;
  if (filter === "all") return ["completed", "declined", "cancelled"].includes(enquiry.status);
  if (filter === "completed") return enquiry.status === "completed";
  if (filter === "withdrawn") return isWithdrawn(enquiry, resolvedCustomerId);
  return enquiry.status === "cancelled" && !isWithdrawn(enquiry, resolvedCustomerId);
}

function getReviewDismissedKey(enquiryId: number) {
  return `reviews:dismissed:${enquiryId}`;
}

type SavedHomeAddress = {
  street: string | null;
  house_number: string | null;
  area: string | null;
  city: string | null;
  pincode: string | null;
  lat?: number | null;
  lng?: number | null;
};

function localDateValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function formatHomeAddress(address: SavedHomeAddress | null, profileCity: string | null, fallbackCity: string | null) {
  const parts = [address?.house_number, address?.street, address?.area, address?.city || profileCity || fallbackCity, address?.pincode]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return parts.filter((part, index) => parts.findIndex((other) => other.toLocaleLowerCase() === part.toLocaleLowerCase()) === index).join(", ");
}

export default function EnquiriesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const enquiryParam = searchParams.get("enquiry");
  const { location: selectedLocation } = useLocation();
  const [loading, setLoading] = useState(true);
  const [isProvider, setIsProvider] = useState(false);
  const [view, setView] = useState<"sent" | "received">("sent");
  const [sentTab, setSentTab] = useState<SentTab>("pending");
  const [receivedTab, setReceivedTab] = useState<ReceivedTab>("pending");
  const [sent, setSent] = useState<SentEnquiry[]>([]);
  const [received, setReceived] = useState<ReceivedEnquiry[]>([]);
  const [sentHistoryFilter, setSentHistoryFilter] = useState<"all" | "completed" | "cancelled" | "withdrawn">("all");
  const [receivedHistoryFilter, setReceivedHistoryFilter] = useState<"all" | "completed" | "cancelled" | "withdrawn">("all");
  const [lastSeenHistory, setLastSeenHistory] = useState<{ sent: string; received: string }>({ sent: "", received: "" });
  const [pendingMap, setPendingMap] = useState<Record<string, boolean>>({});
  const [requestEditorOpen, setRequestEditorOpen] = useState<Record<number, boolean>>({});
  const [confirmingDecline, setConfirmingDecline] = useState<Record<number, { open: boolean; reason: string }>>({});
  const [customerCity, setCustomerCity] = useState<string | null>(null);
  const [customerHomeAddress, setCustomerHomeAddress] = useState<SavedHomeAddress | null>(null);
  const [customerSummary, setCustomerSummary] = useState<CustomerSummary | null>(null);
  const [isCustomerSummaryOpen, setIsCustomerSummaryOpen] = useState(false);
  const [reviewsByEnquiry, setReviewsByEnquiry] = useState<Record<string, ReviewRecord>>({});
  const [receivedReviewsByEnquiry, setReceivedReviewsByEnquiry] = useState<Record<string, ReviewRecord>>({});
  const [reviewPromptQueue, setReviewPromptQueue] = useState<ReviewPrompt[]>([]);
  const [activeReviewPrompt, setActiveReviewPrompt] = useState<ReviewPrompt | null>(null);
  const [todayLocal] = useState(() => localDateValue(new Date()));
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [unreadByProject, setUnreadByProject] = useState<Record<string, number>>({});
  const [actionToast, setActionToast] = useState<{ message: string; actionLabel: string; view: "sent" | "received"; tab: "active" | "history"; enquiryId: number } | null>(null);
  const [highlightedEnquiry, setHighlightedEnquiry] = useState<{ view: "sent" | "received"; enquiryId: string | number } | null>(null);
  const [unavailableToast, setUnavailableToast] = useState(false);
  const [pendingScrollEnquiry, setPendingScrollEnquiry] = useState<{ view: "sent" | "received"; enquiryId: string | number } | null>(null);
  const [cancellationTarget, setCancellationTarget] = useState<{ id: number; view: "sent" | "received"; role: "customer" | "provider"; fromStatus: string } | null>(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const unreadDebounceRef = useRef<number | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unavailableToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deepLinkHandledRef = useRef<string | null>(null);
  const deepLinkInFlightRef = useRef<string | null>(null);
  const completionToastKeysRef = useRef<Set<string>>(new Set());
  const reviewPromptedEnquiryIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => () => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    if (unavailableToastTimeoutRef.current) clearTimeout(unavailableToastTimeoutRef.current);
  }, []);

  const showUnavailableToast = useCallback(() => {
    setUnavailableToast(true);
    if (unavailableToastTimeoutRef.current) clearTimeout(unavailableToastTimeoutRef.current);
    unavailableToastTimeoutRef.current = setTimeout(() => setUnavailableToast(false), 5000);
  }, []);

  function showActionToast(message: string, actionLabel: string, targetView: "sent" | "received", tab: "active" | "history", enquiryId: number) {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setActionToast({ message, actionLabel, view: targetView, tab, enquiryId });
    toastTimeoutRef.current = setTimeout(() => setActionToast(null), 8000);
  }

  function openToastDestination() {
    if (!actionToast) return;
    setView(actionToast.view);
    if (actionToast.view === "sent") setSentTab(actionToast.tab);
    else setReceivedTab(actionToast.tab);
    setSentHistoryFilter("all");
    setReceivedHistoryFilter("all");
    setHighlightedEnquiry({ view: actionToast.view, enquiryId: actionToast.enquiryId });
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = setTimeout(() => setHighlightedEnquiry(null), 3500);
    setActionToast(null);
  }

  const loadUnread = useCallback(async (userId: string, sentList: SentEnquiry[], receivedList: ReceivedEnquiry[]) => {
    try {
      if (!userId) return;
      const supabase = createClient();
      const { data, error } = await supabase
        .from("project_messages")
        .select("project_id")
        .is("read_at", null)
        .is("deleted_at", null)
        .neq("sender_id", userId);

      if (error) {
        console.error("project_messages unread query failed:", error.message, error.details, error.hint, error.code);
        return;
      }

      const rows = (data as { project_id: string }[]) || [];
      const counts: Record<string, number> = {};
      for (const row of rows) {
        if (!row.project_id) continue;
        counts[row.project_id] = (counts[row.project_id] || 0) + 1;
      }

      const sentIds = new Set(sentList.map((enquiry) => enquiry.projects?.id).filter(Boolean) as string[]);
      const receivedIds = new Set(receivedList.map((enquiry) => enquiry.projects?.id).filter(Boolean) as string[]);
      const keep = new Set<string>([...sentIds, ...receivedIds]);
      const filtered: Record<string, number> = {};
      for (const [projectId, count] of Object.entries(counts)) {
        if (keep.has(projectId)) filtered[projectId] = count;
      }

      setUnreadByProject(filtered);
    } catch {
      console.error("loadUnread failed");
    }
  }, []);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.push(`/login?redirect=/enquiries`);
      setLoading(false);
      return;
    }

    const { data: providerRow } = await supabase.from("providers").select("id").eq("id", userData.user.id).maybeSingle();
    const amProvider = !!providerRow;
    const [ownProfileResult, homeAddressResult] = await Promise.all([
      supabase.from("profiles").select("city").eq("id", userData.user.id).maybeSingle(),
      supabase.from("profile_private_addresses").select("street,house_number,area,city,pincode,lat,lng").eq("profile_id", userData.user.id).maybeSingle(),
    ]);

    const { data: sentData, error: sentError } = await supabase
      .from("enquiries")
      .select(
        `id,message,status,created_at,updated_at,decline_reason,is_asap,scheduled_start_at,customer_completed_at,provider_completed_at,cancelled_by,cancelled_at,cancelled_from_status,cancel_reason_code,cancel_reason_note,admin_cancelled_by,providers(id,business_name,lat,lng,locality,city,profiles!providers_id_fkey(full_name,avatar_url)),customer_requirements(description,city),projects(id,project_code)`
      )
      .eq("customer_id", userData.user.id)
      .order("created_at", { ascending: false });

    if (sentError) {
      console.error("sent enquiries cancellation history query failed:", sentError.message, sentError.details, sentError.hint, sentError.code);
      setSchemaError("Unable to load enquiry cancellation details. Confirm migration 041 is applied and reload this page.");
      setLoading(false);
      return;
    }
    setSchemaError(null);

    const sentList: SentEnquiry[] = ((sentData ?? []) as SentEnquiryRow[]).map((row) => ({
      ...row,
      providers: (() => {
        const provider = one(row.providers);
        return provider ? { ...provider, profiles: one(provider.profiles) } : null;
      })(),
      customer_requirements: one(row.customer_requirements),
      projects: one(row.projects),
    }));
    const eligibleReviewEnquiries = await getEligibleEnquiriesForReview(supabase, userData.user.id);
    const eligibleReviewIds = new Set(eligibleReviewEnquiries.map((enquiry) => String(enquiry.id)));
    const completedEnquiryIds = sentList.filter((enquiry) => enquiry.customer_completed_at).map((enquiry) => String(enquiry.id));
    const reviewsMap: Record<string, ReviewRecord> = {};

    if (completedEnquiryIds.length > 0) {
      const { data: reviewRows, error: reviewError } = await supabase
        .from("reviews")
        .select("id,enquiry_id,rating,comment,created_at")
        .eq("customer_id", userData.user.id)
        .in("enquiry_id", completedEnquiryIds);

      if (reviewError) {
        console.error("reviews query failed:", {
          message: reviewError.message,
          code: reviewError.code,
          details: reviewError.details,
          hint: reviewError.hint,
        });
      }

      for (const row of reviewRows || []) {
        reviewsMap[String(row.enquiry_id)] = {
          id: row.id,
          enquiry_id: row.enquiry_id,
          rating: row.rating,
          comment: row.comment,
          created_at: row.created_at,
        };
      }
    }

    let receivedData: ReceivedEnquiry[] = [];
    const receivedReviewsMap: Record<string, ReviewRecord> = {};
    if (amProvider) {
      const { data, error } = await supabase
        .from("enquiries")
        .select(
          `id,message,status,created_at,updated_at,decline_reason,is_asap,scheduled_start_at,customer_id,customer_completed_at,provider_completed_at,cancelled_by,cancelled_at,cancelled_from_status,cancel_reason_code,cancel_reason_note,admin_cancelled_by,profiles!enquiries_customer_id_fkey(full_name,avatar_url,city,created_at),customer_requirements(description),projects(id,project_code)`
        )
        .eq("provider_id", userData.user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("received enquiries cancellation history query failed:", error.message, error.details, error.hint, error.code);
        setSchemaError("Unable to load enquiry cancellation details. Confirm migration 041 is applied and reload this page.");
        setLoading(false);
        return;
      }
      receivedData = ((data ?? []) as ReceivedEnquiryRow[]).map((row) => ({
        ...row,
        profiles: one(row.profiles),
        customer_requirements: one(row.customer_requirements),
        projects: one(row.projects),
      }));

      const completedReceivedEnquiryIds = receivedData.filter((enquiry) => enquiry.status === "completed").map((enquiry) => String(enquiry.id));
      if (completedReceivedEnquiryIds.length > 0) {
        const { data: receivedReviewRows, error: receivedReviewError } = await supabase
          .from("reviews")
          .select("id,enquiry_id,rating,comment,created_at")
          .in("enquiry_id", completedReceivedEnquiryIds)
          .eq("provider_id", userData.user.id);

        if (receivedReviewError) {
          console.error("provider reviews query failed:", {
            message: receivedReviewError.message,
            code: receivedReviewError.code,
            details: receivedReviewError.details,
            hint: receivedReviewError.hint,
          });
        }

        for (const row of receivedReviewRows || []) {
          receivedReviewsMap[String(row.enquiry_id)] = {
            id: row.id,
            enquiry_id: row.enquiry_id,
            rating: row.rating,
            comment: row.comment,
            created_at: row.created_at,
          };
        }
      }
    }

    if (!mountedRef.current) return;

    const queuedPrompts = sentList
      .filter((enquiry) => eligibleReviewIds.has(String(enquiry.id)))
      .filter((enquiry) => (typeof window === "undefined" ? true : localStorage.getItem(getReviewDismissedKey(enquiry.id)) !== "true"))
      .map((enquiry) => ({
        enquiryId: enquiry.id,
        providerName: enquiry.providers?.business_name || "Provider",
        existingReview: null,
      }));

    const [firstPrompt, ...remainingPrompts] = queuedPrompts;

    setIsProvider(amProvider);
    setCurrentUserId(userData.user.id);
    setCustomerCity(typeof ownProfileResult.data?.city === "string" ? ownProfileResult.data.city.trim() || null : null);
    setCustomerHomeAddress((homeAddressResult.data as SavedHomeAddress | null) ?? null);
    localStorage.setItem("enquiries:lastSeenSentActivity", new Date().toISOString());
    const now = new Date().toISOString();
    const storedSent = localStorage.getItem("enquiries:lastSeenHistory:sent");
    const storedReceived = localStorage.getItem("enquiries:lastSeenHistory:received");
    if (!storedSent) localStorage.setItem("enquiries:lastSeenHistory:sent", now);
    if (!storedReceived) localStorage.setItem("enquiries:lastSeenHistory:received", now);

    setLastSeenHistory({
      sent: storedSent || now,
      received: storedReceived || now,
    });
    setSent(sentList);
    setReceived(receivedData);
    setReviewsByEnquiry(reviewsMap);
    setReceivedReviewsByEnquiry(receivedReviewsMap);
    setReviewPromptQueue(remainingPrompts);
    setActiveReviewPrompt((current) => current ?? firstPrompt ?? null);
    setView(amProvider ? "received" : "sent");
    setLoading(false);
    // Load unread counts for visible projects
    // pass the freshly-loaded lists so we count only projects shown
    void loadUnread(userData.user.id, sentList, receivedData);
  }, [loadUnread, router]);

  useEffect(() => {
    mountedRef.current = true;
    const initialLoad = window.setTimeout(() => void load(), 0);
    return () => {
      clearTimeout(initialLoad);
      mountedRef.current = false;
    };
  }, [load]);

  const processEnquiryDeepLink = useCallback(async (requestedId: string, sourceHref: string) => {
    if (deepLinkInFlightRef.current === requestedId) return;
    deepLinkInFlightRef.current = requestedId;
    try {
      const targetUrl = new URL(sourceHref, window.location.origin);
      const clearQueryParam = () => {
        targetUrl.searchParams.delete("enquiry");
        router.replace(`${pathname}${targetUrl.searchParams.size ? `?${targetUrl.searchParams.toString()}` : ""}`, { scroll: false });
      };
      await load();
      if (!requestedId.trim()) {
        deepLinkHandledRef.current = requestedId;
        showUnavailableToast();
        clearQueryParam();
        return;
      }

      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      const { data: enquiry, error } = user
        ? await supabase.from("enquiries")
            .select("id,status,customer_id,provider_id")
            .eq("id", requestedId)
            .maybeSingle()
        : { data: null, error: null };
      const targetView: "sent" | "received" | null = enquiry && user
        ? enquiry.customer_id === user.id
          ? "sent"
          : enquiry.provider_id === user.id
            ? "received"
            : null
        : null;

      deepLinkHandledRef.current = requestedId;
      if (error || !enquiry || !targetView) {
        showUnavailableToast();
        clearQueryParam();
        return;
      }

      const targetTab = enquiry.status === "sent"
        ? "pending"
        : ["accepted", "confirmed"].includes(enquiry.status)
          ? "active"
          : ["completed", "declined", "cancelled"].includes(enquiry.status)
            ? "history"
            : null;
      if (!targetTab) {
        showUnavailableToast();
        clearQueryParam();
        return;
      }

      setView(targetView);
      setSentHistoryFilter("all");
      setReceivedHistoryFilter("all");
      if (targetView === "sent") setSentTab(targetTab);
      else setReceivedTab(targetTab);
      const highlight = { view: targetView, enquiryId: String(enquiry.id) };
      setHighlightedEnquiry(highlight);
      setPendingScrollEnquiry(highlight);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = setTimeout(() => setHighlightedEnquiry(null), 3500);
      clearQueryParam();
    } finally {
      deepLinkInFlightRef.current = null;
    }
  }, [load, pathname, router, showUnavailableToast]);

  useEffect(() => {
    if (!enquiryParam || loading || deepLinkHandledRef.current === enquiryParam) return;
    void processEnquiryDeepLink(enquiryParam, window.location.href);
  }, [enquiryParam, loading, processEnquiryDeepLink]);

  useEffect(() => {
    function handleNotificationRefresh(event: Event) {
      const href = (event as CustomEvent<{ href?: string }>).detail?.href;
      if (!href) return;
      const targetUrl = new URL(href, window.location.origin);
      if (targetUrl.pathname !== "/enquiries") return;
      const targetId = targetUrl.searchParams.get("enquiry");
      if (targetId) {
        deepLinkHandledRef.current = null;
        void processEnquiryDeepLink(targetId, targetUrl.href);
      } else {
        void load();
      }
    }
    window.addEventListener("app:notification-refresh", handleNotificationRefresh);
    return () => window.removeEventListener("app:notification-refresh", handleNotificationRefresh);
  }, [load, processEnquiryDeepLink]);

  useEffect(() => {
    if (!pendingScrollEnquiry || loading) return;
    const frame = window.requestAnimationFrame(() => {
      const element = document.getElementById(`enquiry-${pendingScrollEnquiry.view}-${pendingScrollEnquiry.enquiryId}`);
      setPendingScrollEnquiry(null);
      if (!element) {
        setHighlightedEnquiry(null);
        showUnavailableToast();
        return;
      }
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      element.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loading, pendingScrollEnquiry, showUnavailableToast]);

  // Realtime subscription to update unread counts when project_messages change
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel("project_messages_unread");

    const scheduleLoad = () => {
      if (unreadDebounceRef.current) window.clearTimeout(unreadDebounceRef.current);
      unreadDebounceRef.current = window.setTimeout(() => {
        loadUnread(currentUserId, sent, received);
        unreadDebounceRef.current = null;
      }, 300);
    };

    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "project_messages" },
        () => scheduleLoad()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "project_messages" },
        () => scheduleLoad()
      )
      .subscribe();

    return () => {
      if (unreadDebounceRef.current) window.clearTimeout(unreadDebounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [currentUserId, loadUnread, received, sent]);

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        load();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [load]);

  useEffect(() => {
    const handlePullRefresh = () => {
      const hasOpenDeclineDialog = Object.values(confirmingDecline).some((item) => item.open);
      const hasOpenRequestEditor = Object.values(requestEditorOpen).some(Boolean);
      if (isCustomerSummaryOpen || activeReviewPrompt || cancellationTarget || hasOpenDeclineDialog || hasOpenRequestEditor) return;
      void load();
    };
    window.addEventListener("app:pull-refresh", handlePullRefresh);
    return () => window.removeEventListener("app:pull-refresh", handlePullRefresh);
  }, [activeReviewPrompt, cancellationTarget, confirmingDecline, isCustomerSummaryOpen, load, requestEditorOpen]);

  function setPending(key: string, v: boolean) {
    setPendingMap((s) => ({ ...s, [key]: v }));
  }

  function setCardError(key: string, msg: string | null) {
    setErrors((s) => ({ ...s, [key]: msg }));
  }

  useEffect(() => {
    if (loading) return;
    const chatProjectId = new URLSearchParams(window.location.search).get("chat");
    if (chatProjectId) router.replace(`/messages/${encodeURIComponent(chatProjectId)}`);
  }, [loading, router]);

  async function updateReceivedStatus(id: number, status: string, declineReason?: string | null) {
    const key = `received-${id}`;
    setPending(key, true);
    setCardError(key, null);
    try {
      const supabase = createClient();
      if (status === "accepted") {
        const { error } = await supabase.from("enquiries").update({ status: "confirmed" }).eq("id", id).eq("status", "sent");
        if (error) {
          setCardError(key, error.code === "23514"
            ? "This enquiry has no timing details. Ask the customer to send a new enquiry."
            : error.code === "42501"
              ? "You can't accept this enquiry."
              : friendlyDbError(error, "Unable to accept this enquiry."));
          return;
        }
        await load();
        setView("received");
        setReceivedTab("active");
        showActionToast("Enquiry accepted. Contact details and job location are now available.", "View in Active", "received", "active", id);
        return;
      }
      const nextReason = status === "declined" ? (declineReason?.trim() || null) : null;
      const { error } = await supabase.from("enquiries").update({ status, decline_reason: nextReason }).eq("id", id);
      if (error) throw error;
      setReceived((prev) => prev.map((p) => (p.id === id ? { ...p, status, decline_reason: status === "declined" ? nextReason : p.decline_reason } : p)));
      if (status === "declined") showActionToast("Enquiry declined. Moved to History.", "View History", "received", "history", id);
    } catch (err: unknown) {
      setCardError(key, friendlyDbError(err && typeof err === "object" ? err as { message?: string; code?: string } : null, "Update failed"));
    } finally {
      setPending(key, false);
    }
  }

  async function cancelEnquiry(reasonCode: CancellationReasonCode, reasonNote: string | null) {
    if (!cancellationTarget) return "This cancellation could not be completed. Please try again.";
    const { id, view: targetView, fromStatus } = cancellationTarget;
    const key = `${targetView}-${id}`;
    setPending(key, true);
    setCardError(key, null);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("enquiries").update({
        status: "cancelled",
        cancel_reason_code: reasonCode,
        cancel_reason_note: reasonCode === "other" ? reasonNote : null,
      }).eq("id", id);
      if (error) {
        if (error.code === "23514") return "Choose a valid reason and provide a note for Other.";
        if (error.code === "42501") return "You can no longer cancel this enquiry. Refresh and try again.";
        return friendlyDbError(error, "Unable to cancel this enquiry. Please try again.");
      }

      const message = fromStatus === "sent" ? "Enquiry withdrawn" : "Enquiry cancelled";
      setCancellationTarget(null);
      setView(targetView);
      setSentTab("history");
      setReceivedTab("history");
      setSentHistoryFilter("all");
      setReceivedHistoryFilter("all");
      await load();
      setView(targetView);
      setSentTab("history");
      setReceivedTab("history");
      setSentHistoryFilter("all");
      setReceivedHistoryFilter("all");
      setHighlightedEnquiry({ view: targetView, enquiryId: id });
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = setTimeout(() => setHighlightedEnquiry(null), 3500);
      showActionToast(message, "View in History", targetView, "history", id);
      return null;
    } catch (error) {
      console.error("enquiry cancellation failed:", error);
      return "Unable to cancel this enquiry right now. Please try again.";
    } finally {
      setPending(key, false);
    }
  }

  if (loading) {
    return (
      <main aria-label="Loading enquiries" aria-busy="true" className="mx-auto w-full max-w-3xl space-y-5 px-4 py-8">
        <div className="space-y-2"><div className="skeleton h-9 w-48 rounded-lg" /><div className="skeleton h-4 w-72 max-w-full rounded" /></div>
        <div className="skeleton h-12 w-full max-w-sm rounded-full" />
        <div className="flex gap-2"><div className="skeleton h-11 w-24 rounded-full" /><div className="skeleton h-11 w-24 rounded-full" /><div className="skeleton h-11 w-24 rounded-full" /></div>
        {[0, 1, 2].map((item) => <div key={item} className="skeleton h-36 rounded-2xl border border-border" />)}
      </main>
    );
  }

  function scheduleLine(enq: { is_asap?: boolean | null; scheduled_start_at?: string | null }) {
    if (enq.is_asap) return "When: ASAP";
    if (enq.scheduled_start_at) return `When: ${formatDateTime(enq.scheduled_start_at)}`;
    return null;
  }

  function unseenHistoryCount(list: { status: string; updated_at?: string | null; created_at: string | null }[], lastSeen: string) {
    return list.filter(
      (e) => ["completed", "declined", "cancelled"].includes(e.status) && e.updated_at && e.updated_at > lastSeen
    ).length;
  }

  const bucket = <T extends { status: string; customer_id?: string; cancelled_from_status?: string | null; cancelled_by?: string | null },>(list: T[], t: "pending" | "active" | "history", customerId?: string | null, filter: "all" | "completed" | "cancelled" | "withdrawn" = "all") =>
    t === "pending"
      ? list.filter((e) => e.status === "sent")
      : t === "active"
      ? list.filter((e) => e.status === "accepted" || e.status === "confirmed")
      : list.filter((e) => isHistoryFilterMatch(e, customerId, filter));

  const sentPendingCount = bucket(sent, "pending").length;
  const sentActiveCount = bucket(sent, "active").length;
  const receivedPendingCount = bucket(received, "pending").length;
  const receivedActiveCount = bucket(received, "active").length;
  const sentHistoryUnseen = unseenHistoryCount(sent, lastSeenHistory.sent);
  const receivedHistoryUnseen = unseenHistoryCount(received, lastSeenHistory.received);
  const historyUnseen = view === "sent" ? sentHistoryUnseen : receivedHistoryUnseen;

  const activeTab = view === "sent" ? sentTab : receivedTab;
  const handleSentTabChange = (tab: SentTab) => setSentTab(tab);
  const handleReceivedTabChange = (tab: ReceivedTab) => setReceivedTab(tab);
  const pendingCount = view === "sent" ? sentPendingCount : receivedPendingCount;
  const activeCount = view === "sent" ? sentActiveCount : receivedActiveCount;
  const historyCount = bucket(view === "sent" ? sent : received, "history", currentUserId, "all").length;

  const shownSent = view === "sent" && sentTab !== "reviews" ? bucket(sent, sentTab, currentUserId, sentHistoryFilter) : [];
  const shownReceived = view === "received" ? bucket(received, receivedTab, currentUserId, receivedHistoryFilter) : [];
  const activeHistoryFilter = view === "sent" ? sentHistoryFilter : receivedHistoryFilter;
  const historyRows = view === "sent" ? sent : received;
  const historyCounts = {
    all: bucket(historyRows, "history", currentUserId, "all").length,
    completed: bucket(historyRows, "history", currentUserId, "completed").length,
    cancelled: bucket(historyRows, "history", currentUserId, "cancelled").length,
    withdrawn: bucket(historyRows, "history", currentUserId, "withdrawn").length,
  };

  const pendingReviews =
    typeof window !== "undefined"
      ? sent
          .filter((enquiry) => enquiry.status === "completed")
          .filter((enquiry) => !reviewsByEnquiry[String(enquiry.id)])
          .filter((enquiry) => localStorage.getItem(getReviewDismissedKey(enquiry.id)) !== "true")
          .map((enquiry) => ({
            enquiryId: enquiry.id,
            providerName: enquiry.providers?.business_name || "Provider",
            existingReview: null,
          }))
      : [];

  const submittedReviews = sent
    .filter((enquiry) => enquiry.status === "completed")
    .map((enquiry) => ({ enquiry, review: reviewsByEnquiry[String(enquiry.id)] }))
    .filter(({ review }) => !!review)
    .map(({ enquiry, review }) => ({
      enquiryId: enquiry.id,
      providerName: enquiry.providers?.business_name || "Provider",
      existingReview: review as ReviewRecord,
    }));

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-0 pb-12 sm:pb-10">
      <PageHeading title="Enquiries" description="Track messages, decisions, and work in progress." />

      {unavailableToast && <p role="status" aria-live="polite" className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[70] mx-auto max-w-lg rounded-2xl border border-border bg-card p-4 text-center text-sm font-medium text-card-foreground shadow-lifted">This request is no longer available</p>}
      {schemaError && <p role="alert" className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{schemaError}</p>}

      {isProvider && (
        <div role="group" aria-label="Enquiry direction" className="mb-6 flex w-full max-w-sm rounded-full border border-border bg-card p-1 shadow-sm">
          <button
            type="button"
            aria-pressed={view === "received"}
            onClick={() => setView("received")}
            className={`min-h-11 flex-1 rounded-full px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${view === "received" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            Received
          </button>
          <button
            type="button"
            aria-pressed={view === "sent"}
            onClick={() => setView("sent")}
            className={`min-h-11 flex-1 rounded-full px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${view === "sent" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            Sent by me
          </button>
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => {
            if (view === "sent") handleSentTabChange("pending");
            else handleReceivedTabChange("pending");
          }}
          aria-pressed={activeTab === "pending"}
          className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeTab === "pending" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted"}`}
        >
          New <span className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs ${activeTab === "pending" ? "bg-primary-foreground/15 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{pendingCount}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            if (view === "sent") handleSentTabChange("active");
            else handleReceivedTabChange("active");
          }}
          aria-pressed={activeTab === "active"}
          className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeTab === "active" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted"}`}
        >
          Active <span className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs ${activeTab === "active" ? "bg-primary-foreground/15 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{activeCount}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            if (view === "sent") handleSentTabChange("history");
            else handleReceivedTabChange("history");
          }}
          aria-pressed={activeTab === "history"}
          className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeTab === "history" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted"}`}
        >
          History <span className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs ${activeTab === "history" ? "bg-primary-foreground/15 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{historyCount}</span>
        </button>
        {view === "sent" && (
          <button
            type="button"
            onClick={() => handleSentTabChange("reviews")}
            aria-pressed={activeTab === "reviews"}
            className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeTab === "reviews" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted"}`}
          >
            Your Reviews
          </button>
        )}
        {activeTab === "history" && historyUnseen > 0 && (
          <button
            type="button"
            onClick={() => {
              const now = new Date().toISOString();
              localStorage.setItem(`enquiries:lastSeenHistory:${view}`, now);
              setLastSeenHistory((s) => ({ ...s, [view]: now }));
            }}
            className="ml-auto inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Done
          </button>
        )}
      </div>

      {activeTab === "history" && (
        <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
          {(["all", "completed", "cancelled", "withdrawn"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => view === "sent" ? setSentHistoryFilter(f) : setReceivedHistoryFilter(f)}
              aria-pressed={activeHistoryFilter === f}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeHistoryFilter === f ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card text-foreground hover:bg-muted"}`}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              <span className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs ${activeHistoryFilter === f ? "bg-accent-foreground/10" : "bg-muted text-muted-foreground"}`}>{historyCounts[f]}</span>
            </button>
          ))}
        </div>
      )}

      {view === "sent" && activeTab === "reviews" ? (
        <div className="space-y-6">
          <div className="space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Pending</h2>
            {pendingReviews.length > 0 ? (
              pendingReviews.map((prompt) => (
                <div key={prompt.enquiryId} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{prompt.providerName}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {sent.find((enquiry) => enquiry.id === prompt.enquiryId)?.customer_requirements?.description || "Completed project"}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {(() => {
                        const enquiry = sent.find((item) => item.id === prompt.enquiryId);
                        const completedAt = enquiry?.customer_completed_at ?? enquiry?.updated_at;
                        return completedAt ? `Completed ${formatDateTime(completedAt)}` : "Completed";
                      })()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveReviewPrompt({ enquiryId: prompt.enquiryId, providerName: prompt.providerName, existingReview: null })}
                    className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Leave a review
                  </button>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">No reviews left to submit.</div>
            )}
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Submitted</h2>
            {submittedReviews.length > 0 ? (
              submittedReviews.map((prompt) => (
                <div key={prompt.enquiryId} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{prompt.providerName}</div>
                      <div className="mt-1 text-sm text-foreground" aria-label={`${prompt.existingReview.rating} out of 5 stars`}>{"★".repeat(prompt.existingReview.rating)}{"☆".repeat(5 - prompt.existingReview.rating)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveReviewPrompt({ enquiryId: prompt.enquiryId, providerName: prompt.providerName, existingReview: prompt.existingReview })}
                      className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Edit
                    </button>
                  </div>
                  {prompt.existingReview?.comment && <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{prompt.existingReview.comment}</p>}
                  <div className="mt-2 text-xs text-muted-foreground">Submitted {formatDateTime(prompt.existingReview?.created_at ?? sent.find((enquiry) => enquiry.id === prompt.enquiryId)?.updated_at)}</div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">No reviews submitted yet.</div>
            )}
          </div>
        </div>
      ) : view === "sent" ? (
        shownSent.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">
              {sentTab === "pending" ? "You have not sent any enquiries yet." : sentTab === "active" ? "No active work right now." : "No history yet."}
            </p>
            <div className="mt-4">
              <Link href="/discover" className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {sentTab === "pending" ? "Discover providers" : "Find another provider"}
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {shownSent.map((enq) => {
              const key = `sent-${enq.id}`;
              const providerProfile = enq.providers?.profiles;
              const providerName = enq.providers?.business_name || providerProfile?.full_name || "Provider";
              const isHighlighted = highlightedEnquiry?.view === "sent" && String(highlightedEnquiry.enquiryId) === String(enq.id);
              return (
                <article id={`enquiry-sent-${enq.id}`} key={enq.id} className={`scroll-mt-24 rounded-2xl border border-border bg-card p-4 shadow-sm transition-shadow sm:p-5 ${isHighlighted ? "ring-2 ring-ring" : ""}`}>
                  <div className="flex min-w-0 items-center gap-3">
                    <Link href={`/providers/${enq.providers?.id ?? ""}`} aria-label={`View ${providerName}'s provider profile`} className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card">
                      <Avatar src={providerProfile?.avatar_url} name={providerName} size={44} className="size-11 rounded-full border border-border bg-muted text-sm text-muted-foreground" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link href={`/providers/${enq.providers?.id ?? ""}`} className="block min-h-11 truncate py-2 font-semibold text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{providerName}</Link>
                      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Provider</span>
                    </div>
                    {enquiryStatusBadge(enq, currentUserId)}
                  </div>

                  <p title={enq.message || undefined} className="mt-4 whitespace-pre-line text-sm text-foreground">{enq.message || "No message provided."}</p>
                  {scheduleLine(enq) && <p className="mt-2 text-sm text-muted-foreground">{scheduleLine(enq)}</p>}
                  {sentTab === "history" && enq.status === "declined" && enq.decline_reason && (
                    <div className="mt-2 text-sm text-muted-foreground">Reason: {enq.decline_reason}</div>
                  )}
                  {sentTab === "history" && enq.status === "cancelled" && (
                    <div className="mt-3 rounded-xl border border-border bg-muted/40 p-3 text-sm">
                      <p className="font-medium text-foreground">{cancellationActorLabel(enq, currentUserId, currentUserId, providerName)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(enq.cancelled_at)}</p>
                      <p className="mt-2 text-muted-foreground">{cancellationReasonLabel(enq.cancel_reason_code)}</p>
                      {enq.cancel_reason_note && <p className="mt-1 whitespace-pre-line text-muted-foreground">{enq.cancel_reason_note}</p>}
                    </div>
                  )}

                  {sentTab === "active" && enq.status === "confirmed" && (
                    <div className="mt-4"><EnquiryDirections enquiryId={enq.id} role="customer" providerLocation={enq.providers} /></div>
                  )}

                  {enq.status === "accepted" && <p className="mt-3 text-sm text-muted-foreground">Accepted before the new flow. Confirmation is no longer needed.</p>}

                  {enq.status === "sent" && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => setRequestEditorOpen((current) => ({ ...current, [enq.id]: !current[enq.id] }))}
                        className="min-h-11 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {requestEditorOpen[enq.id] ? "Close details editor" : "Edit details"}
                      </button>
                      {requestEditorOpen[enq.id] && (
                        <RequestDetailsEditor
                          enquiryId={enq.id}
                          isAsap={enq.is_asap ?? null}
                          scheduledStartAt={enq.scheduled_start_at ?? null}
                          homeAddress={formatHomeAddress(customerHomeAddress, customerCity, selectedLocation.city || selectedLocation.locality)}
                          homeCity={customerCity || customerHomeAddress?.city || selectedLocation.city || selectedLocation.locality}
                          homePin={customerHomeAddress?.lat != null && customerHomeAddress.lng != null
                            ? { lat: customerHomeAddress.lat, lng: customerHomeAddress.lng }
                            : null}
                          today={todayLocal}
                          onClose={() => setRequestEditorOpen((current) => ({ ...current, [enq.id]: false }))}
                          onSaved={(details) => setSent((current) => current.map((item) => item.id === enq.id
                            ? { ...item, is_asap: details.isAsap, scheduled_start_at: details.isAsap ? null : details.scheduledStartAt }
                            : item))}
                        />
                      )}
                    </div>
                  )}

                  {enq.status === "accepted" ? (
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                      <button type="button" onClick={() => setCancellationTarget({ id: enq.id, view: "sent", role: "customer", fromStatus: enq.status })} className="inline-flex min-h-11 items-center rounded-full border border-destructive/30 bg-destructive/10 px-4 text-sm font-medium text-destructive hover:bg-destructive/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Cancel enquiry</button>
                    </div>
                  ) : (
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    {(enq.status === "sent" || enq.status === "confirmed") && <button type="button" onClick={() => setCancellationTarget({ id: enq.id, view: "sent", role: "customer", fromStatus: enq.status })} className="inline-flex min-h-11 items-center rounded-full border border-destructive/30 bg-destructive/10 px-4 text-sm font-medium text-destructive hover:bg-destructive/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{enq.status === "sent" ? "Withdraw enquiry" : "Cancel enquiry"}</button>}
                    {enq.status === "confirmed" && !enq.customer_completed_at && <CompletionActions
                        enquiryId={enq.id}
                        role="customer"
                        customerCompletedAt={enq.customer_completed_at}
                        providerCompletedAt={enq.provider_completed_at}
                        onUpdated={(patch) => {
                          setSent((prev) => prev.map((p) => (p.id === enq.id ? { ...p, ...patch } : p)));
                          if (patch.customer_completed_at) {
                            if (!reviewsByEnquiry[String(enq.id)] && !reviewPromptedEnquiryIdsRef.current.has(enq.id)) {
                              reviewPromptedEnquiryIdsRef.current.add(enq.id);
                              setActiveReviewPrompt({ enquiryId: enq.id, providerName, existingReview: null });
                            }
                            const key = `customer:${enq.id}:${patch.customer_completed_at}`;
                            if (!completionToastKeysRef.current.has(key)) {
                              completionToastKeysRef.current.add(key);
                              const completed = patch.status === "completed";
                              showActionToast(completed ? "Work completed. Moved to History." : "Completion noted. Find it under Active.", completed ? "View History" : "View Active", "sent", completed ? "history" : "active", enq.id);
                            }
                          }
                        }}
                        onReviewNeeded={(enquiryId) => {
                          const enquiry = sent.find((item) => item.id === enquiryId);
                          if (!enquiry || reviewsByEnquiry[String(enquiryId)] || reviewPromptedEnquiryIdsRef.current.has(enquiryId)) return;
                          reviewPromptedEnquiryIdsRef.current.add(enquiryId);
                          setActiveReviewPrompt({ enquiryId, providerName: enquiry.providers?.business_name || providerName, existingReview: null });
                        }}
                      />}
                    {enq.customer_completed_at && reviewsByEnquiry[String(enq.id)] && <p role="status" className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-primary">Thanks for your review</p>}
                    {enq.customer_completed_at && !reviewsByEnquiry[String(enq.id)] && <Button type="button" onClick={() => setActiveReviewPrompt({ enquiryId: enq.id, providerName, existingReview: null })} className="min-h-11 rounded-full px-4">Leave a review</Button>}
                    {enq.status !== "accepted" && enq.projects && <Link href={`/messages/${encodeURIComponent(enq.projects.id)}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><MessageCircle aria-hidden="true" className="size-4" />Message{(unreadByProject[enq.projects.id] ?? 0) > 0 && <span className="rounded-full bg-destructive px-1.5 text-xs font-semibold text-destructive-foreground">{unreadByProject[enq.projects.id] > 9 ? "9+" : unreadByProject[enq.projects.id]}</span>}</Link>}
                    {enq.status === "confirmed" && <div className="[&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_a]:rounded-full [&_a]:px-4"><ContactUnlock profileId={enq.providers?.id ?? ""} showUnavailable /></div>}
                  </div>
                  )}

                  <footer className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                    <span>Sent {formatDateTime(enq.created_at)}</span>
                    {(enq.status === "confirmed" || enq.status === "completed") && enq.projects && <Link href={`/projects/${enq.projects.id}`} className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">View Project ({enq.projects.project_code})</Link>}
                  </footer>

                  {errors[key] && <p className="mt-2 text-sm text-destructive">{errors[key]}</p>}
                </article>
              );
            })}
          </div>
        )
      ) : shownReceived.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">{receivedTab === "pending" ? "No new enquiries yet" : receivedTab === "active" ? "No active work right now" : "No history yet"}</p>
          <Link href={`/providers/${currentUserId}`} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">View your public profile</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {shownReceived.map((enq) => {
            const key = `received-${enq.id}`;
            const review = receivedReviewsByEnquiry[String(enq.id)] ?? null;
            const customerName = enq.profiles?.full_name || "Anonymous";
            const isHighlighted = highlightedEnquiry?.view === "received" && String(highlightedEnquiry.enquiryId) === String(enq.id);
            const safeCustomerSummary: CustomerSummary = {
              fullName: enq.profiles?.full_name ?? null,
              avatarUrl: enq.profiles?.avatar_url ?? null,
              city: enq.profiles?.city ?? null,
              createdAt: enq.profiles?.created_at ?? null,
            };
            return (
              <article id={`enquiry-received-${enq.id}`} key={enq.id} className={`scroll-mt-24 rounded-2xl border border-border bg-card p-4 shadow-sm transition-shadow sm:p-5 ${isHighlighted ? "ring-2 ring-ring" : ""}`}>
                <div className="flex min-w-0 items-center gap-3">
                  <button type="button" onClick={() => { setCustomerSummary(safeCustomerSummary); setIsCustomerSummaryOpen(true); }} aria-label={`View ${customerName}'s public details`} className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card">
                    <Avatar src={enq.profiles?.avatar_url} name={customerName} size={44} className="size-11 rounded-full border border-border bg-muted text-sm text-muted-foreground" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => { setCustomerSummary(safeCustomerSummary); setIsCustomerSummaryOpen(true); }} className="block min-h-11 max-w-full truncate py-2 text-left font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{customerName}</button>
                    <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Customer</span>
                  </div>
                  {enquiryStatusBadge(enq, enq.customer_id)}
                </div>

                <p title={enq.message || undefined} className="mt-4 whitespace-pre-line text-sm text-foreground">{enq.message || "No message provided."}</p>
                {scheduleLine(enq) && <p className="mt-2 text-sm text-muted-foreground">{scheduleLine(enq)}</p>}
                {receivedTab === "history" && enq.status === "completed" && review && (
                  <div className="mt-3 rounded-md border border-muted bg-muted/30 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-foreground" aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</div>
                      <div className="text-xs text-muted-foreground">Reviewed {formatDateTime(review.created_at)}</div>
                    </div>
                    {review.comment && <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{review.comment}</p>}
                  </div>
                )}
                {receivedTab === "history" && enq.status === "declined" && enq.decline_reason && (
                  <div className="mt-2 text-sm text-muted-foreground">Reason: {enq.decline_reason}</div>
                )}
                {receivedTab === "history" && enq.status === "cancelled" && (
                  <div className="mt-3 rounded-xl border border-border bg-muted/40 p-3 text-sm">
                    <p className="font-medium text-foreground">{cancellationActorLabel(enq, enq.customer_id, currentUserId, customerName)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(enq.cancelled_at)}</p>
                    <p className="mt-2 text-muted-foreground">{cancellationReasonLabel(enq.cancel_reason_code)}</p>
                    {enq.cancel_reason_note && <p className="mt-1 whitespace-pre-line text-muted-foreground">{enq.cancel_reason_note}</p>}
                  </div>
                )}
                {enq.status === "confirmed" && <div className="mt-4"><EnquiryDirections enquiryId={enq.id} role="provider" /></div>}

                {receivedTab === "pending" && (
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    <button
                      type="button"
                      onClick={() => updateReceivedStatus(enq.id, "accepted")}
                      disabled={!!pendingMap[key]}
                      className="inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {pendingMap[key] ? "Accepting…" : "Accept"}
                    </button>
                    {confirmingDecline[enq.id]?.open ? (
                      <div className="flex items-center gap-2">
                        <input
                          value={confirmingDecline[enq.id]?.reason ?? ""}
                          onChange={(e) =>
                            setConfirmingDecline((s) => ({
                              ...s,
                              [enq.id]: { open: true, reason: e.target.value },
                            }))
                          }
                          placeholder="Optional reason"
                          className="min-h-11 w-full max-w-48 rounded-full border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                        <button
                          onClick={() => {
                            const reason = confirmingDecline[enq.id]?.reason ?? "";
                            setConfirmingDecline((s) => ({ ...s, [enq.id]: { open: false, reason: "" } }));
                            updateReceivedStatus(enq.id, "declined", reason);
                          }}
                          disabled={!!pendingMap[key]}
                          className="inline-flex min-h-11 items-center rounded-full bg-destructive px-4 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {pendingMap[key] ? "Declining…" : "Confirm decline"}
                        </button>
                        <button
                          onClick={() => setConfirmingDecline((s) => ({ ...s, [enq.id]: { open: false, reason: "" } }))}
                          className="inline-flex min-h-11 items-center rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmingDecline((s) => ({ ...s, [enq.id]: { open: true, reason: "" } }))}
                        disabled={!!pendingMap[key]}
                        className="inline-flex min-h-11 items-center rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {pendingMap[key] ? "Declining…" : "Decline"}
                      </button>
                    )}
                  </div>
                )}

                {enq.status === "accepted" && <p className="mt-3 text-sm text-muted-foreground">Accepted before the new flow. Confirmation is no longer needed.</p>}

                {enq.status === "confirmed" && (
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    <CompletionActions
                      enquiryId={enq.id}
                      role="provider"
                      customerCompletedAt={enq.customer_completed_at}
                      providerCompletedAt={enq.provider_completed_at}
                      onUpdated={(patch) => {
                        setReceived((prev) => prev.map((p) => (p.id === enq.id ? { ...p, ...patch } : p)));
                        if (patch.provider_completed_at) {
                          const key = `provider:${enq.id}:${patch.provider_completed_at}`;
                          if (!completionToastKeysRef.current.has(key)) {
                            completionToastKeysRef.current.add(key);
                            const completed = patch.status === "completed";
                            showActionToast(completed ? "Work completed. Moved to History." : "Completion noted. Find it under Active.", completed ? "View History" : "View Active", "received", completed ? "history" : "active", enq.id);
                          }
                        }
                      }}
                    />
                    {enq.projects && <Link href={`/messages/${encodeURIComponent(enq.projects.id)}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><MessageCircle aria-hidden="true" className="size-4" />Message{(unreadByProject[enq.projects.id] ?? 0) > 0 && <span className="rounded-full bg-destructive px-1.5 text-xs font-semibold text-destructive-foreground">{unreadByProject[enq.projects.id] > 9 ? "9+" : unreadByProject[enq.projects.id]}</span>}</Link>}
                    <div className="[&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_a]:rounded-full [&_a]:px-4"><ContactUnlock profileId={enq.customer_id} showUnavailable /></div>
                    <button type="button" onClick={() => setCancellationTarget({ id: enq.id, view: "received", role: "provider", fromStatus: enq.status })} className="inline-flex min-h-11 items-center rounded-full border border-destructive/30 bg-destructive/10 px-4 text-sm font-medium text-destructive hover:bg-destructive/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Cancel enquiry</button>
                  </div>
                )}

                {enq.status === "accepted" && (
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    <button type="button" onClick={() => setCancellationTarget({ id: enq.id, view: "received", role: "provider", fromStatus: enq.status })} className="inline-flex min-h-11 items-center rounded-full border border-destructive/30 bg-destructive/10 px-4 text-sm font-medium text-destructive hover:bg-destructive/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Cancel enquiry</button>
                  </div>
                )}

                {enq.status !== "confirmed" && enq.status !== "accepted" && enq.projects && (
                  <div className="mt-4 border-t border-border pt-3">
                    <Link href={`/messages/${encodeURIComponent(enq.projects.id)}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><MessageCircle aria-hidden="true" className="size-4" />Message{(unreadByProject[enq.projects.id] ?? 0) > 0 && <span className="rounded-full bg-destructive px-1.5 text-xs font-semibold text-destructive-foreground">{unreadByProject[enq.projects.id] > 9 ? "9+" : unreadByProject[enq.projects.id]}</span>}</Link>
                  </div>
                )}

                <footer className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                  <span>Sent {formatDateTime(enq.created_at)}</span>
                  {(enq.status === "confirmed" || enq.status === "completed") && enq.projects && <Link href={`/projects/${enq.projects.id}`} className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">View Project ({enq.projects.project_code})</Link>}
                </footer>

                {errors[key] && <p className="mt-2 text-sm text-destructive">{errors[key]}</p>}
              </article>
            );
            })}
        </div>
      )}

      <CustomerSummarySheet open={isCustomerSummaryOpen} customer={customerSummary} onClose={() => setIsCustomerSummaryOpen(false)} />
      <CancellationSheet
        key={cancellationTarget ? `${cancellationTarget.view}-${cancellationTarget.id}-${cancellationTarget.fromStatus}` : "closed"}
        open={cancellationTarget !== null}
        role={cancellationTarget?.role ?? "customer"}
        isWithdraw={cancellationTarget?.fromStatus === "sent"}
        isConfirmed={cancellationTarget?.fromStatus === "confirmed"}
        saving={cancellationTarget ? !!pendingMap[`${cancellationTarget.view}-${cancellationTarget.id}`] : false}
        onClose={() => setCancellationTarget(null)}
        onConfirm={cancelEnquiry}
      />

      {activeReviewPrompt && (
        <ReviewModal
          enquiryId={activeReviewPrompt.enquiryId}
          providerName={activeReviewPrompt.providerName}
          existingReview={activeReviewPrompt.existingReview ?? null}
          onClose={() => {
            const currentId = activeReviewPrompt.enquiryId;
            if (!activeReviewPrompt.existingReview) {
              localStorage.setItem(getReviewDismissedKey(currentId), "true");
            }
            const remaining = reviewPromptQueue.filter((item) => item.enquiryId !== currentId);
            setReviewPromptQueue(remaining);
            setActiveReviewPrompt(remaining[0] ?? null);
          }}
          onSubmitted={async () => {
            await load();
            const currentId = activeReviewPrompt?.enquiryId;
            const remaining = reviewPromptQueue.filter((item) => item.enquiryId !== currentId);
            setReviewPromptQueue(remaining);
            setActiveReviewPrompt(remaining[0] ?? null);
          }}
        />
      )}
      {actionToast && (
        <div role="status" aria-live="polite" className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[70] mx-auto flex max-w-lg flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-lifted sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium">{actionToast.message}</p>
          <button type="button" onClick={openToastDestination} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {actionToast.actionLabel}<ArrowRight aria-hidden="true" className="size-4" />
          </button>
        </div>
      )}
    </main>
  );
}
