"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import ConfirmDialog from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type CredentialStatus = "pending" | "verified" | "rejected" | "revoked";

export type CredentialTypeOption = {
  id: string;
  slug: string;
  label: string;
  issuing_body: string | null;
  requires_number: boolean;
  number_label: string | null;
  sort_order: number;
  is_active: boolean;
};

export type ProviderCredentialItem = {
  id: string;
  credential_type_id: string;
  details: string | null;
  credential_number: string | null;
  file_path: string | null;
  status: CredentialStatus;
  review_notes: string | null;
  created_at: string;
  credential_types?: { label: string; issuing_body: string | null } | Array<{ label: string; issuing_body: string | null }> | null;
};

type CredentialFormValues = {
  typeId: string;
  number: string;
  details: string;
  file: File | null;
};

function logSupabaseError(context: string, error: { message: string; details?: string; hint?: string; code?: string }) {
  console.error(context, error.message, error.details, error.hint, error.code);
}

function getCredentialSchema(types: CredentialTypeOption[]) {
  return z.object({
    typeId: z.string().min(1, "Choose a credential type."),
    number: z.string(),
    details: z.string().max(300, "Details must be 300 characters or fewer."),
    file: z.custom<File | null>((value) => value === null || (typeof File !== "undefined" && value instanceof File)),
  }).superRefine((values, ctx) => {
    const selectedType = types.find((type) => type.id === values.typeId);
    if (selectedType?.requires_number && !values.number.trim()) {
      ctx.addIssue({ code: "custom", path: ["number"], message: "A number is required for this credential type." });
    }
    if (!values.file) {
      ctx.addIssue({ code: "custom", path: ["file"], message: "Choose a document to upload." });
      return;
    }
    if (values.file.size > 10 * 1024 * 1024) {
      ctx.addIssue({ code: "custom", path: ["file"], message: "The file must be 10 MB or smaller." });
    }
    const extension = values.file.name.split(".").pop()?.toLowerCase();
    const expectedMimeType = extension === "pdf" ? "application/pdf" :
      extension === "jpg" || extension === "jpeg" ? "image/jpeg" :
      extension === "png" ? "image/png" : null;
    if (!expectedMimeType || (values.file.type && values.file.type !== expectedMimeType)) {
      ctx.addIssue({ code: "custom", path: ["file"], message: "Choose a PDF, JPG, or PNG file." });
    }
  });
}

function getType(credential: ProviderCredentialItem) {
  return Array.isArray(credential.credential_types) ? credential.credential_types[0] ?? null : credential.credential_types ?? null;
}

function statusPresentation(status: CredentialStatus) {
  if (status === "verified") return { label: "Verified", className: "bg-green-100 text-green-800" };
  if (status === "rejected") return { label: "Not accepted", className: "bg-red-100 text-red-800" };
  if (status === "revoked") return { label: "Removed", className: "bg-red-100 text-red-800" };
  return { label: "Pending review", className: "bg-gray-100 text-gray-800" };
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatFileSize(size: number) {
  return size >= 1024 * 1024 ? `${(size / (1024 * 1024)).toFixed(1)} MB` : `${(size / 1024).toFixed(1)} KB`;
}

function rpcErrorMessage(message: string) {
  if (message === "CREDENTIAL_NUMBER_REQUIRED") return "This type needs a number.";
  if (message === "TOO_MANY_PENDING") return "You already have 5 credentials waiting for review.";
  if (message === "TOO_MANY_CREDENTIALS") return "You have reached the limit of 20 credentials.";
  return "Something went wrong. Please try again.";
}

export default function ProviderCredentialsManager({
  userId,
  credentialTypes,
  credentials,
}: {
  userId: string;
  credentialTypes: CredentialTypeOption[];
  credentials: ProviderCredentialItem[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [credentialToWithdraw, setCredentialToWithdraw] = useState<ProviderCredentialItem | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const schema = useMemo(() => getCredentialSchema(credentialTypes), [credentialTypes]);
  const form = useForm<CredentialFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { typeId: "", number: "", details: "", file: null },
  });
  const selectedTypeId = useWatch({ control: form.control, name: "typeId" });
  const selectedType = credentialTypes.find((type) => type.id === selectedTypeId);
  const supabase = useMemo(() => createClient(), []);

  async function onSubmit(values: CredentialFormValues) {
    setError(null);
    setSuccess(null);
    if (!values.file) return;

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      logSupabaseError("credential submit auth lookup failed:", userError);
      setError("Something went wrong. Please try again.");
      return;
    }
    if (!userData.user || userData.user.id !== userId) {
      setError("Something went wrong. Please try again.");
      return;
    }

    const extension = values.file.name.split(".").pop()?.toLowerCase();
    if (!extension) {
      setError("Choose a PDF, JPG, or PNG file.");
      return;
    }
    const path = `${userId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("credentials").upload(path, values.file, { upsert: false });
    if (uploadError) {
      logSupabaseError("credential document upload failed:", uploadError);
      setError("Something went wrong. Please try again.");
      return;
    }

    const { error: submitError } = await supabase.rpc("submit_credential", {
      p_type_id: values.typeId,
      p_number: values.number.trim() || null,
      p_details: values.details.trim() || null,
      p_file_path: path,
    });

    if (submitError) {
      logSupabaseError("credential submit RPC failed:", submitError);
      const { error: cleanupError } = await supabase.storage.from("credentials").remove([path]);
      if (cleanupError) logSupabaseError("credential upload cleanup failed:", cleanupError);
      setError(rpcErrorMessage(submitError.message));
      return;
    }

    form.reset({ typeId: "", number: "", details: "", file: null });
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setSuccess("Submitted. An admin will review it.");
    router.refresh();
  }

  async function viewDocument(credential: ProviderCredentialItem) {
    setDocumentError(null);
    if (!credential.file_path) {
      setDocumentError("Document is unavailable.");
      return;
    }
    const { data, error: signedUrlError } = await supabase.storage.from("credentials").createSignedUrl(credential.file_path, 600);
    if (signedUrlError) {
      logSupabaseError("credential signed URL failed:", signedUrlError);
      setDocumentError("Unable to open this document right now.");
      return;
    }
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    else setDocumentError("Unable to open this document right now.");
  }

  async function withdrawCredential() {
    if (!credentialToWithdraw) return;
    setIsWithdrawing(true);
    setWithdrawError(null);
    const { data: filePath, error: withdrawRpcError } = await supabase.rpc("withdraw_credential", { p_id: credentialToWithdraw.id });
    if (withdrawRpcError) {
      logSupabaseError("credential withdrawal RPC failed:", withdrawRpcError);
      setWithdrawError("Unable to withdraw this credential. Please try again.");
      setIsWithdrawing(false);
      return;
    }

    if (filePath) {
      const { error: removeError } = await supabase.storage.from("credentials").remove([filePath]);
      if (removeError) {
        logSupabaseError("withdrawn credential document removal failed:", removeError);
        setWithdrawError("The credential was withdrawn, but its document could not be removed. Please contact Assisto support.");
      }
    }
    setCredentialToWithdraw(null);
    setIsWithdrawing(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <p className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        Credentials are optional. Anything you upload is seen only by you and Assisto admins. A verified credential adds a &apos;Credential verified&apos; badge to your profile. It shows that an admin checked a document. It is not a guarantee of work quality.
      </p>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Your credentials</h2>
        {credentials.length === 0 ? (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">You have not submitted any credentials.</p>
        ) : credentials.map((credential) => {
          const type = getType(credential);
          const badge = statusPresentation(credential.status);
          return (
            <article key={credential.id} className="space-y-3 rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium">{type?.label ?? "Credential"}</h3>
                  {credential.credential_number && <p className="mt-1 text-sm">Number: {credential.credential_number}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">Submitted {formatDate(credential.created_at)}</p>
                </div>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${badge.className}`}>{badge.label}</span>
              </div>
              {credential.details && <p className="whitespace-pre-line text-sm text-muted-foreground">{credential.details}</p>}
              {(credential.status === "rejected" || credential.status === "revoked") && credential.review_notes && (
                <p className="text-sm text-muted-foreground">Reason: {credential.review_notes}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => void viewDocument(credential)}>View document</Button>
                {credential.status === "pending" && (
                  <Button type="button" variant="outline" size="sm" onClick={() => { setWithdrawError(null); setCredentialToWithdraw(credential); }}>Withdraw</Button>
                )}
              </div>
            </article>
          );
        })}
        {documentError && <p className="text-sm text-destructive" role="alert">{documentError}</p>}
        {withdrawError && <p className="text-sm text-destructive" role="alert">{withdrawError}</p>}
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="mb-4 text-lg font-semibold">Add a credential</h2>
        {credentialTypes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No credential types are currently available.</p>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="credential-type" className="mb-1 block text-sm font-medium">Credential type</label>
              <select
                id="credential-type"
                {...form.register("typeId")}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Choose a type</option>
                {credentialTypes.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
              </select>
              {selectedType?.issuing_body && <p className="mt-1 text-xs text-muted-foreground">Issued by {selectedType.issuing_body}</p>}
              {form.formState.errors.typeId && <p className="mt-1 text-sm text-destructive">{form.formState.errors.typeId.message}</p>}
            </div>

            <div>
              <label htmlFor="credential-number" className="mb-1 block text-sm font-medium">
                {selectedType?.number_label || "Credential number"}{selectedType?.requires_number ? " *" : " (optional)"}
              </label>
              <Input id="credential-number" {...form.register("number")} />
              {form.formState.errors.number && <p className="mt-1 text-sm text-destructive">{form.formState.errors.number.message}</p>}
            </div>

            <div>
              <label htmlFor="credential-details" className="mb-1 block text-sm font-medium">Details (optional)</label>
              <Textarea id="credential-details" rows={3} maxLength={300} {...form.register("details")} />
              <p className="mt-1 text-right text-xs text-muted-foreground">{(form.watch("details") ?? "").length}/300</p>
              {form.formState.errors.details && <p className="text-sm text-destructive">{form.formState.errors.details.message}</p>}
            </div>

            <div>
              <label htmlFor="credential-file" className="mb-1 block text-sm font-medium">Document</label>
              <Input
                ref={fileInputRef}
                id="credential-file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setSelectedFile(file);
                  form.setValue("file", file, { shouldValidate: true });
                }}
              />
              {selectedFile && <p className="mt-1 text-xs text-muted-foreground">{selectedFile.name} · {formatFileSize(selectedFile.size)}</p>}
              {form.formState.errors.file && <p className="mt-1 text-sm text-destructive">{form.formState.errors.file.message}</p>}
              <p className="mt-1 text-xs text-muted-foreground">PDF, JPG, or PNG. Maximum 10 MB.</p>
            </div>

            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            {success && <p className="text-sm text-green-700" role="status">{success}</p>}
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Submitting…" : "Submit for review"}
            </Button>
          </form>
        )}
      </section>

      <ConfirmDialog
        isOpen={!!credentialToWithdraw}
        title="Withdraw this credential?"
        message="This credential will no longer be under review and its uploaded document will be removed."
        confirmLabel="Withdraw"
        destructive
        busy={isWithdrawing}
        onConfirm={() => void withdrawCredential()}
        onCancel={() => { if (!isWithdrawing) setCredentialToWithdraw(null); }}
      />
    </div>
  );
}
