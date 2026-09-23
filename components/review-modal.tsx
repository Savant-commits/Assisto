"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

export type ReviewModalProps = {
  enquiryId: number;
  providerName: string;
  existingReview?: {
    id: string;
    enquiry_id: string | number;
    rating: number;
    comment: string | null;
    created_at: string | null;
  } | null;
  onClose: () => void;
  onSubmitted: () => void | Promise<void>;
};

export function ReviewModal({ enquiryId, providerName, existingReview, onClose, onSubmitted }: ReviewModalProps) {
  const [rating, setRating] = useState<number>(() => existingReview?.rating ?? 5);
  const [comment, setComment] = useState<string>(() => existingReview?.comment ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!rating || rating < 1 || rating > 5) {
      setError("Please choose a star rating.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();
      if (existingReview) {
        const { error: updateError } = await supabase
          .from("reviews")
          .update({
            rating,
            comment: comment.trim() || null,
          })
          .eq("id", existingReview.id);

        if (updateError) throw updateError;
      } else {
        const { error: submitError } = await supabase.rpc("submit_review", {
          p_enquiry_id: enquiryId,
          p_rating: rating,
          p_comment: comment.trim() || null,
        });

        if (submitError) throw submitError;
      }

      await onSubmitted();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to save your review right now.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleMaybeLater() {
    if (!existingReview) {
      localStorage.setItem(`reviews:dismissed:${enquiryId}`, "true");
    }
    onClose();
  }

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <div className="flex items-start justify-between gap-4">
          <DialogHeader className="mb-0">
            <DialogTitle>{existingReview ? "Edit your review" : "Leave a review"}</DialogTitle>
            <DialogDescription>
              {existingReview ? `Update your feedback for ${providerName}.` : `Tell us how ${providerName} did.`}
            </DialogDescription>
          </DialogHeader>
          <DialogClose aria-label="Close review form" />
        </div>

        <div className="mt-6 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium">Your rating</label>
            <div className="flex items-center gap-2 text-3xl text-yellow-500">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                  onClick={() => setRating(star)}
                  className={star <= rating ? "text-yellow-500" : "text-gray-300"}
                >
                  {star <= rating ? "★" : "☆"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="review-comment" className="mb-2 block text-sm font-medium">
              Comment <span className="text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              id="review-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={5}
              placeholder="Share a few details about your experience"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex items-center justify-between gap-3 pt-2">
            {!existingReview && (
              <Button type="button" variant="ghost" onClick={handleMaybeLater}>
                Maybe later
              </Button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Button type="button" variant="outline" onClick={onClose} className={existingReview ? "" : "hidden"}>
                Close
              </Button>
              <Button type="button" onClick={handleSubmit} disabled={submitting}>
                {submitting ? (existingReview ? "Saving…" : "Submitting…") : existingReview ? "Save changes" : "Submit review"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
