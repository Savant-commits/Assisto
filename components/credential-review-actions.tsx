"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/confirm-dialog";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

type CredentialStatus = "pending" | "verified" | "rejected" | "revoked";
type ReviewDecision = "verified" | "rejected" | "revoked";

type Credential = {
  id: string;
  status: CredentialStatus;
  credential_number: string | null;
  file_path: string | null;
};

type DuplicateRow = {
  credential_id: string;
  provider_id: string;
  business_name: string | null;
  type_label: string | null;
  status: CredentialStatus;
  ever_banned: boolean;
  currently_banned: boolean;
};

function logSupabaseError(context: string, error: { message: string; details?: string; hint?: string; code?: string }) {
  console.error(context, error.message, error.details, error.hint, error.code);
}

function reviewErrorMessage(message: string) {
  if (message === "NOTES_REQUIRED") return "Please write a reason.";
  return "Something went wrong. Please try again.";
}

export function CredentialDocumentButton({
  filePath,
  onImageView,
}: {
  filePath: string | null;
  onImageView?: (url: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function viewDocument() {
    setError(null);
    if (!filePath) {
      setError("Document is unavailable.");
      return;
    }
    setBusy(true);
    const { data, error: signedUrlError } = await supabase.storage.from("credentials").createSignedUrl(filePath, 600);
    setBusy(false);
    if (signedUrlError) {
      logSupabaseError("admin credential signed URL failed:", signedUrlError);
      setError("Unable to open this document right now.");
      return;
    }
    const url = data?.signedUrl;
    if (!url) {
      setError("Unable to open this document right now.");
      return;
    }
    if (onImageView && /\.(jpe?g|png)$/i.test(filePath)) onImageView(url);
    else window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div>
      <button
        type="button"
        className="rounded border px-3 py-1.5 text-sm"
        disabled={busy}
        onClick={() => void viewDocument()}
      >
        {busy ? "Opening…" : "View document"}
      </button>
      {error && <p className="mt-1 text-sm text-destructive" role="alert">{error}</p>}
    </div>
  );
}

export function CredentialReviewActions({
  credential,
  onImageView,
  showRevoke = false,
}: {
  credential: Credential;
  onImageView?: (url: string) => void;
  showRevoke?: boolean;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [duplicates, setDuplicates] = useState<DuplicateRow[]>([]);
  const [selected, setSelected] = useState<ReviewDecision | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [duplicateConflict, setDuplicateConflict] = useState(false);

  useEffect(() => {
    if (credential.status !== "pending" || !credential.credential_number) {
      return;
    }
    let active = true;
    async function loadDuplicates() {
      const { data, error } = await supabase.rpc("admin_credential_duplicates", { p_id: credential.id });
      if (error) {
        logSupabaseError("credential duplicate lookup failed:", error);
        return;
      }
      if (active) setDuplicates((data ?? []) as DuplicateRow[]);
    }
    void loadDuplicates();
    return () => { active = false; };
  }, [credential.credential_number, credential.id, credential.status, supabase]);

  function openReview(decision: ReviewDecision) {
    setSelected(decision);
    setNotes("");
    setActionError(null);
    setDuplicateConflict(false);
  }

  async function submitReview(confirmDuplicate = false) {
    if (!selected) return;
    setBusy(true);
    setActionError(null);
    const { error } = await supabase.rpc("admin_review_credential", {
      p_id: credential.id,
      p_decision: selected,
      p_notes: notes.trim() || null,
      p_confirm_duplicate: confirmDuplicate,
    });
    if (error) {
      logSupabaseError("credential review RPC failed:", error);
      if (error.message === "DUPLICATE_CREDENTIAL" && selected === "verified") {
        setDuplicateConflict(true);
      } else {
        setActionError(reviewErrorMessage(error.message));
      }
      setBusy(false);
      return;
    }
    setBusy(false);
    setSelected(null);
    router.refresh();
  }

  const decisionLabel = selected === "verified" ? "Verify" : selected === "rejected" ? "Reject" : "Revoke";
  const notesRequired = selected !== "verified";

  return (
    <div className="space-y-2">
      {credential.status === "pending" && !!credential.credential_number && duplicates.length > 0 && (
        <div className="space-y-1 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {duplicates.map((duplicate) => (
            <p key={duplicate.credential_id} className="font-medium">
              Same number found on another account: {duplicate.business_name || "Unknown business"} ({duplicate.type_label || "Credential"}, {duplicate.status})
              {duplicate.currently_banned ? " — this account is currently banned" : duplicate.ever_banned ? " — this account has been banned" : ""}
            </p>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-start gap-2">
        <CredentialDocumentButton filePath={credential.file_path} onImageView={onImageView} />
        {credential.status === "pending" && (
          <>
            <button type="button" className="rounded bg-green-700 px-3 py-1.5 text-sm font-medium text-white" onClick={() => openReview("verified")}>Verify</button>
            <button type="button" className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white" onClick={() => openReview("rejected")}>Reject</button>
          </>
        )}
        {showRevoke && credential.status === "verified" && (
          <button type="button" className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white" onClick={() => openReview("revoked")}>Revoke</button>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!selected}
        title={`${decisionLabel} credential?`}
        message={selected === "verified" ? "Confirm that this credential document has been checked." : "Add a reason for this decision."}
        confirmLabel={duplicateConflict ? "Verify anyway" : decisionLabel}
        destructive={selected !== "verified"}
        busy={busy}
        confirmDisabled={notesRequired && !notes.trim()}
        onConfirm={() => void submitReview(duplicateConflict)}
        onCancel={() => { if (!busy) setSelected(null); }}
      >
        <div className="mb-5">
          <label htmlFor={`credential-review-notes-${credential.id}`} className="mb-1 block text-sm font-medium">Notes{notesRequired ? " (required)" : " (optional)"}</label>
          <Textarea
            id={`credential-review-notes-${credential.id}`}
            rows={4}
            maxLength={1000}
            value={notes}
            onChange={(event) => { setNotes(event.target.value); setActionError(null); }}
          />
          {duplicateConflict && (
            <p className="mt-2 text-sm text-amber-800" role="alert">
              Another verified account has the same number. If you have checked and they are different people, you can verify anyway.
            </p>
          )}
          {actionError && <p className="mt-2 text-sm text-destructive" role="alert">{actionError}</p>}
        </div>
      </ConfirmDialog>
    </div>
  );
}
