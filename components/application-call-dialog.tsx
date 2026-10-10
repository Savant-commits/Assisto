"use client";

import { useState } from "react";
import type { ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/confirm-dialog";
import { CredentialDocumentButton } from "@/components/credential-review-actions";
import { createClient } from "@/lib/supabase/client";

type CallOutcome = "verified" | "not_verified" | "unreachable";

type Props = {
  applicationId: string;
  applicantName: string;
  professionalType: string;
  city: string;
  businessName: string | null;
  yearsExperience: number | null;
  serviceAreaNotes: string | null;
  bio: string | null;
  credentials: { id: string; label: string; filePath: string | null }[];
};

const allowedAudioTypes = new Set([
  "audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/m4a", "audio/aac",
  "audio/wav", "audio/x-wav", "audio/webm", "audio/ogg", "audio/amr", "audio/3gpp",
]);
const allowedAudioExtensions = new Set(["m4a", "mp3", "amr", "3gp", "wav", "aac", "ogg", "webm"]);
const audioExtensionByType: Record<string, string> = {
  "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/m4a": "m4a",
  "audio/aac": "aac", "audio/wav": "wav", "audio/x-wav": "wav", "audio/webm": "webm",
  "audio/ogg": "ogg", "audio/amr": "amr", "audio/3gpp": "3gp",
};
const maxRecordingSize = 25 * 1024 * 1024;

function errorMetadata(error: unknown) {
  if (typeof error !== "object" || error === null) return {};
  const record = error as { details?: unknown; hint?: unknown; code?: unknown };
  return {
    details: record.details,
    hint: record.hint,
    code: record.code,
  };
}

const outcomeOptions: { value: CallOutcome; label: string }[] = [
  { value: "verified", label: "Confirmed" },
  { value: "not_verified", label: "Could not confirm (details don't match or something is wrong)" },
  { value: "unreachable", label: "Could not reach" },
];

export function ApplicationCallDialog({
  applicationId,
  applicantName,
  professionalType,
  city,
  businessName,
  yearsExperience,
  serviceAreaNotes,
  bio,
  credentials,
}: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [outcome, setOutcome] = useState<CallOutcome>("verified");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState<File | null>(null);
  const [recordingConsent, setRecordingConsent] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  function onRecordingChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setRecordingError(null);
    if (!file) {
      setRecording(null);
      setRecordingConsent(false);
      return;
    }
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const supported = file.type ? allowedAudioTypes.has(file.type) : allowedAudioExtensions.has(extension);
    if (!supported) {
      setRecordingError("That audio format is not supported. Use M4A, MP3, AMR, 3GP, WAV, AAC, OGG or WebM.");
      event.target.value = "";
      setRecording(null);
      setRecordingConsent(false);
      return;
    }
    if (file.size > maxRecordingSize) {
      setRecordingError("The recording must be 25 MB or smaller.");
      event.target.value = "";
      setRecording(null);
      setRecordingConsent(false);
      return;
    }
    setRecording(file);
    setRecordingConsent(false);
  }

  function openDialog() {
    setOutcome("verified");
    setNotes("");
    setError(null);
    setRecording(null);
    setRecordingConsent(false);
    setRecordingError(null);
    setIsOpen(true);
  }

  async function recordCall() {
    setError(null);
    setBusy(true);
    let uploadedRecordingPath: string | null = null;
    try {
      const supabase = createClient();
      if (recording) {
        const namedExtension = recording.name.split(".").pop()?.toLowerCase() ?? "";
        const extension = allowedAudioExtensions.has(namedExtension)
          ? namedExtension
          : audioExtensionByType[recording.type] ?? "m4a";
        uploadedRecordingPath = `${applicationId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("call-recordings")
          .upload(uploadedRecordingPath, recording, { upsert: false, contentType: recording.type || undefined });
        if (uploadError) {
          const metadata = errorMetadata(uploadError);
          console.error("call recording upload failed", {
            message: uploadError.message,
            ...metadata,
          });
          setError("Could not upload the recording. Please try again.");
          return;
        }
      }

      const { error: rpcError } = await supabase.rpc("admin_record_application_call", {
        p_application_id: applicationId,
        p_outcome: outcome,
        p_notes: notes.trim(),
        p_recording_path: uploadedRecordingPath,
        p_recording_consent: !!recording,
      });

      if (rpcError) {
        console.error("admin_record_application_call failed", {
          message: rpcError.message,
          details: rpcError.details,
          hint: rpcError.hint,
          code: rpcError.code,
        });
        const knownErrors: Record<string, string> = {
          NOTES_REQUIRED: "Please write what went wrong.",
          APPLICATION_NOT_PENDING: "This application has already been decided.",
          PHONE_NOT_VERIFIED: "This applicant never verified their number. Ask them to verify it first.",
          CONSENT_REQUIRED: "Please confirm the applicant agreed to the recording.",
          FILE_NOT_FOUND: "The recording could not be attached. Please try again.",
          INVALID_FILE_PATH: "The recording could not be attached. Please try again.",
        };
        if (uploadedRecordingPath) {
          try {
            const { error: cleanupError } = await supabase.storage.from("call-recordings").remove([uploadedRecordingPath]);
            if (cleanupError) {
              const metadata = errorMetadata(cleanupError);
              console.error("call recording cleanup failed", {
                message: cleanupError.message,
                ...metadata,
              });
            }
          } catch (cleanupCaughtError) {
            const cleanupErr = cleanupCaughtError instanceof Error ? cleanupCaughtError : new Error(String(cleanupCaughtError));
            console.error("call recording cleanup failed", {
              message: cleanupErr.message,
              ...errorMetadata(cleanupCaughtError),
            });
          }
        }
        setError(knownErrors[rpcError.message] || "Something went wrong. Please try again.");
        return;
      }

      setIsOpen(false);
      router.refresh();
    } catch (caughtError) {
      const err = caughtError instanceof Error ? caughtError : new Error(String(caughtError));
      const metadata = errorMetadata(caughtError);
      console.error("admin_record_application_call failed", {
        message: err.message,
        ...metadata,
      });
      if (uploadedRecordingPath) {
        try {
          const supabase = createClient();
          const { error: cleanupError } = await supabase.storage.from("call-recordings").remove([uploadedRecordingPath]);
          if (cleanupError) {
            const metadata = errorMetadata(cleanupError);
            console.error("call recording cleanup failed", {
              message: cleanupError.message,
              ...metadata,
            });
          }
        } catch (cleanupCaughtError) {
          const cleanupErr = cleanupCaughtError instanceof Error ? cleanupCaughtError : new Error(String(cleanupCaughtError));
          const cleanupMetadata = errorMetadata(cleanupCaughtError);
          console.error("call recording cleanup failed", {
            message: cleanupErr.message,
            ...cleanupMetadata,
          });
        }
      }
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="mt-3 rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
      >
        Verify
      </button>
      <ConfirmDialog
        isOpen={isOpen}
        title="Verify applicant by phone"
        message="Call the applicant and confirm their details, then save the result."
        busy={busy}
        confirmLabel="Save result"
        confirmDisabled={(outcome === "not_verified" && !notes.trim()) || (!!recording && !recordingConsent)}
        onConfirm={recordCall}
        onCancel={() => setIsOpen(false)}
      >
        <div className="max-h-[70vh] overflow-y-auto pr-1">
          <div className="mb-5 rounded-md bg-muted/50 p-3 text-sm">
            <p className="mb-2 font-medium">Confirm these details with the applicant</p>
            <ul className="space-y-2">
              <li>Are you <strong>{applicantName}</strong>?</li>
              <li>Did you apply as <strong>{professionalType}</strong> in <strong>{city}</strong>?</li>
              <li>Business name: <strong>{businessName?.trim() || "No business name given"}</strong>. Correct?</li>
              <li><strong>{yearsExperience == null ? "Not stated" : `${yearsExperience} ${yearsExperience === 1 ? "year" : "years"}`}</strong> of professional experience. Correct?</li>
              <li>Services you offer: <strong>{serviceAreaNotes?.split(",").map((service) => service.trim()).filter(Boolean).join(", ") || "None listed"}</strong>. Correct?</li>
              <li>
                <p>About you:</p>
                <div className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap rounded border bg-background p-2 text-muted-foreground break-words [overflow-wrap:anywhere]">{bio || "Not stated"}</div>
                <p>Is this accurate?</p>
              </li>
              <li>
                {credentials.length ? (
                  <>
                    Credentials submitted: <strong>{credentials.map((credential) => credential.label).join(", ")}</strong>. Ask about each.
                    <ul className="mt-1 space-y-1 pl-3">
                      {credentials.map((credential) => (
                        <li key={credential.id} className="flex items-center justify-between gap-2">
                          <span>{credential.label}</span>
                          <CredentialDocumentButton filePath={credential.filePath} />
                        </li>
                      ))}
                    </ul>
                  </>
                ) : "No credentials submitted."}
              </li>
              <li className="font-medium">Tell them Assisto lists them but does not guarantee their work.</li>
            </ul>
          </div>
          <fieldset className="mb-4 space-y-2">
            <legend className="mb-2 text-sm font-medium">Call result</legend>
            {outcomeOptions.map((option) => (
              <label key={option.value} className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="radio"
                  name={`call-outcome-${applicationId}`}
                  value={option.value}
                  checked={outcome === option.value}
                  onChange={() => setOutcome(option.value)}
                  className="mt-0.5"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </fieldset>
          <label className="mb-1 block text-sm font-medium" htmlFor={`call-notes-${applicationId}`}>
            Notes{outcome === "not_verified" ? " (required)" : " (optional)"}
          </label>
          <textarea
            id={`call-notes-${applicationId}`}
            value={notes}
            onChange={(event) => setNotes(event.target.value.slice(0, 500))}
            maxLength={500}
            rows={3}
            placeholder="Add a note about the call"
            className="mb-1 w-full rounded border p-2 text-sm"
          />
          <p className="mb-4 text-right text-xs text-muted-foreground">{notes.length}/500</p>
          <section className="mb-4 rounded-md border p-3">
            <h3 className="text-sm font-medium">Add recorded call</h3>
            <input
              type="file"
              accept="audio/*,.m4a,.mp3,.amr,.3gp,.wav,.aac,.ogg,.webm"
              onChange={onRecordingChange}
              className="mt-2 block w-full text-sm"
            />
            {recordingError && <p className="mt-1 text-sm text-destructive" role="alert">{recordingError}</p>}
            {recording && (
              <label className="mt-2 flex items-start gap-2 text-sm">
                <input type="checkbox" checked={recordingConsent} onChange={(event) => setRecordingConsent(event.target.checked)} className="mt-0.5" />
                <span>The applicant agreed to this call being recorded.</span>
              </label>
            )}
            <p className="mt-2 text-xs text-muted-foreground">Tell the applicant at the start of the call that it may be recorded and get their agreement. Recordings are visible only to Assisto admins.</p>
          </section>
          {error && <p className="mb-4 text-sm text-destructive" role="alert">{error}</p>}
        </div>
      </ConfirmDialog>
    </>
  );
}

export function CallRecordingPlayer({ recordingPath }: { recordingPath: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [playFailed, setPlayFailed] = useState(false);

  async function playRecording() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error: signedUrlError } = await supabase.storage.from("call-recordings").createSignedUrl(recordingPath, 600);
    setBusy(false);
    if (signedUrlError) {
      const metadata = errorMetadata(signedUrlError);
      console.error("call recording signed URL failed", {
        message: signedUrlError.message,
        ...metadata,
      });
      setError("Could not open the call recording. Please try again.");
      return;
    }
    if (!data?.signedUrl) {
      setError("Could not open the call recording. Please try again.");
      return;
    }
    setUrl(data.signedUrl);
    setPlayFailed(false);
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">Call recording</span>
        {!url && (
          <button type="button" onClick={() => void playRecording()} disabled={busy} className="rounded border bg-background px-3 py-1.5 text-sm">
            {busy ? "Loading…" : "Play recording"}
          </button>
        )}
      </div>
      {url && (
        <div className="mt-2 space-y-2">
          <audio controls src={url} onError={() => setPlayFailed(true)} className="w-full" />
          {playFailed && <a href={url} target="_blank" rel="noreferrer" className="text-sm text-primary underline">Open recording in a new tab</a>}
        </div>
      )}
      {error && <p className="mt-1 text-sm text-destructive" role="alert">{error}</p>}
    </div>
  );
}
