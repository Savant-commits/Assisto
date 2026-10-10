"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CredentialReviewActions } from "@/components/credential-review-actions";
import { useEscapeKey } from "@/lib/use-escape-key";

type CredentialStatus = "pending" | "verified" | "rejected" | "revoked";
type CredentialType = { label: string; issuing_body: string | null };
type ProfileSummary = { full_name: string | null; user_code: string | null };
type ProviderSummary = {
  id: string;
  business_name: string | null;
  city: string | null;
  profiles?: ProfileSummary | ProfileSummary[] | null;
};

export type AdminCredentialItem = {
  id: string;
  provider_id: string;
  details: string | null;
  credential_number: string | null;
  issuer: string | null;
  file_path: string | null;
  status: CredentialStatus;
  review_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  credential_types?: CredentialType | CredentialType[] | null;
  providers?: ProviderSummary | ProviderSummary[] | null;
  isApplicant?: boolean;
};

const tabs: Array<{ key: CredentialStatus | "all"; label: string }> = [
  { key: "pending", label: "Pending" },
  { key: "verified", label: "Verified" },
  { key: "rejected", label: "Rejected" },
  { key: "revoked", label: "Revoked" },
  { key: "all", label: "All" },
];

function relationship<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function formatDate(date: string) {
  return new Date(date).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function statusClass(status: CredentialStatus) {
  if (status === "verified") return "bg-green-100 text-green-800";
  if (status === "rejected" || status === "revoked") return "bg-red-100 text-red-800";
  return "bg-gray-100 text-gray-800";
}

export default function AdminCredentialsList({
  credentials,
  deepLinkCredentialId,
}: {
  credentials: AdminCredentialItem[];
  deepLinkCredentialId: string | null;
}) {
  const [tab, setTab] = useState<CredentialStatus | "all">("pending");
  const [query, setQuery] = useState("");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});

  useEscapeKey(!!lightboxUrl, () => setLightboxUrl(null));

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const codeQuery = normalizedQuery.startsWith("#") ? normalizedQuery.slice(1) : normalizedQuery;
    return credentials.filter((credential) => {
      if (tab !== "all" && credential.status !== tab) return false;
      if (!normalizedQuery) return true;
      const provider = relationship(credential.providers);
      const profile = relationship(provider?.profiles);
      const type = relationship(credential.credential_types);
      const searchable = [
        profile?.full_name,
        provider?.business_name,
        profile?.user_code,
        credential.credential_number,
        type?.label,
      ].filter(Boolean).map((value) => String(value).toLowerCase());
      return searchable.some((value) => value.includes(normalizedQuery) || (codeQuery && value.includes(codeQuery)));
    });
  }, [credentials, query, tab]);

  useEffect(() => {
    if (!deepLinkCredentialId) return;
    const node = cardRefs.current[deepLinkCredentialId];
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [deepLinkCredentialId, filtered]);

  const tabCounts = (key: CredentialStatus | "all") => key === "all" ? credentials.length : credentials.filter((credential) => credential.status === key).length;

  return (
    <div>
      <label htmlFor="credential-search" className="sr-only">Search credentials</label>
      <input
        id="credential-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="mb-4 h-10 w-full rounded-md border bg-background px-3 text-sm"
        placeholder="Search by provider, #user code, number, or type"
      />

      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Credential status">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            className={`rounded border px-3 py-1.5 text-sm ${tab === item.key ? "bg-muted font-medium" : "bg-background"}`}
            onClick={() => setTab(item.key)}
          >
            {item.label}<span className="ml-2 text-xs text-muted-foreground">{tabCounts(item.key)}</span>
          </button>
        ))}
      </div>

      {!filtered.length ? (
        <div className="rounded border bg-muted/30 p-4 text-sm text-muted-foreground">No matching credentials.</div>
      ) : (
        <div className="space-y-4">
          {filtered.map((credential) => {
            const provider = relationship(credential.providers);
            const profile = relationship(provider?.profiles);
            const type = relationship(credential.credential_types);
            const providerName = profile?.full_name || provider?.business_name || "Provider";
            const isDeepLinked = deepLinkCredentialId === credential.id;
            return (
              <article
                key={credential.id}
                id={`credential-${credential.id}`}
                ref={(node) => { cardRefs.current[credential.id] = node; }}
                className={`space-y-3 rounded-lg border p-4 ${isDeepLinked ? "border-red-500 bg-red-50/40 ring-2 ring-red-200" : ""}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    {credential.isApplicant ? (
                      <p className="font-semibold">{providerName}</p>
                    ) : (
                      <Link href={`/providers/${credential.provider_id}`} className="font-semibold underline">{providerName}</Link>
                    )}
                    {credential.isApplicant && <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Applicant, not approved yet</span>}
                    {profile?.user_code && <span className="ml-2 text-sm text-muted-foreground">#{profile.user_code}</span>}
                    {provider?.business_name && profile?.full_name && <p className="text-sm text-muted-foreground">{provider.business_name}</p>}
                    {provider?.city && <p className="text-sm text-muted-foreground">{provider.city}</p>}
                  </div>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusClass(credential.status)}`}>{credential.status}</span>
                </div>
                <div className="space-y-1 text-sm">
                  <p><span className="font-medium">{type?.label ?? "Credential"}</span>{type?.issuing_body ? ` — ${type.issuing_body}` : ""}</p>
                  {credential.credential_number && <p><span className="font-medium">Number:</span> {credential.credential_number}</p>}
                  {credential.issuer && <p><span className="font-medium">Issuer:</span> {credential.issuer}</p>}
                  {credential.details && <p className="whitespace-pre-line text-muted-foreground">{credential.details}</p>}
                  <p className="text-muted-foreground">Submitted {formatDate(credential.created_at)}</p>
                  {credential.review_notes && <p><span className="font-medium">Review notes:</span> {credential.review_notes}</p>}
                  {credential.reviewed_at && <p className="text-muted-foreground">Reviewed {formatDate(credential.reviewed_at)}</p>}
                </div>

                <CredentialReviewActions credential={credential} showRevoke onImageView={setLightboxUrl} />
              </article>
            );
          })}
        </div>
      )}

      {lightboxUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={() => setLightboxUrl(null)}>
          <div className="relative max-h-[90vh] max-w-[90vw]" role="dialog" aria-modal="true" aria-label="Credential document image" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="absolute -right-3 -top-3 rounded-full bg-white px-3 py-1 text-sm font-semibold text-black" onClick={() => setLightboxUrl(null)} aria-label="Close image">×</button>
            {/* Signed storage URLs are external; a plain img keeps the private URL out of Next image configuration. */}
            <img src={lightboxUrl} alt="Credential document" className="max-h-[85vh] max-w-full rounded-md object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
