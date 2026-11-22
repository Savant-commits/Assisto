"use client";

import * as React from "react";

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string | null;
  profiles?: { full_name?: string | null } | null;
};

type Props = {
  reviews: Review[];
  avgRating: number | null;
  reviewCount: number | null;
  reviewAction?: React.ReactNode;
  renderReport: (review: Review) => React.ReactNode;
};

function displayName(fullName?: string | null) {
  const parts = fullName?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return "Customer";
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function ReviewComment({ comment }: { comment: string }) {
  const textRef = React.useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = React.useState(false);
  const [hasOverflow, setHasOverflow] = React.useState(false);

  React.useEffect(() => {
    const paragraph = textRef.current;
    if (!paragraph) return;
    const measure = () => setHasOverflow(paragraph.scrollHeight > paragraph.clientHeight + 1);
    const frame = window.requestAnimationFrame(measure);
    let observer: ResizeObserver | null = null;
    try {
      if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(measure);
        observer.observe(paragraph);
      }
    } catch {
      observer?.disconnect();
      observer = null;
    }
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [comment]);

  return (
    <div>
      <p ref={textRef} className={`whitespace-pre-line text-sm text-muted-foreground ${expanded ? "" : "line-clamp-4"}`}>{comment}</p>
      {hasOverflow && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="mt-1 min-h-11 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}

export default function ProviderReviewsSection({ reviews, avgRating, reviewCount, reviewAction, renderReport }: Props) {
  const [showAll, setShowAll] = React.useState(false);
  const visibleReviews = showAll ? reviews : reviews.slice(0, 3);

  return (
    <section aria-labelledby="provider-reviews-heading" className="mb-[var(--section-gap)] sm:hidden">
      <div className="mb-4">
        <h2 id="provider-reviews-heading" className="font-display text-xl text-foreground">Reviews</h2>
        {typeof reviewCount === "number" && reviewCount > 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            {typeof avgRating === "number" && Number.isFinite(avgRating) && (
              <>
                <span aria-hidden="true" className="text-primary">★</span> {avgRating.toFixed(1)} · {" "}
                <span className="sr-only">Rated {avgRating.toFixed(1)} out of 5. </span>
              </>
            )}
            {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
          </p>
        )}
      </div>

      {reviews.length === 0 ? (
        <div className="rounded-2xl border border-border bg-muted/40 p-4">
          <p className="text-sm text-muted-foreground">No reviews yet.</p>
          {reviewAction && <div className="mt-3">{reviewAction}</div>}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {visibleReviews.map((review) => (
              <article key={review.id} className="rounded-2xl border border-border bg-card p-4 text-card-foreground">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{displayName(review.profiles?.full_name)}</p>
                    {review.created_at && <p className="mt-0.5 text-xs text-muted-foreground">{new Date(review.created_at).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric" })}</p>}
                  </div>
                  <span className="shrink-0 text-sm" role="img" aria-label={`Rated ${review.rating} out of 5`}>
                    <span aria-hidden="true" className="text-primary">{"★".repeat(Math.max(0, Math.min(5, review.rating)))}</span>
                    <span aria-hidden="true" className="text-muted-foreground/50">{"☆".repeat(Math.max(0, 5 - Math.min(5, review.rating)))}</span>
                  </span>
                </div>
                {review.comment && <div className="mt-3"><ReviewComment comment={review.comment} /></div>}
                <div className="mt-2 flex justify-end">{renderReport(review)}</div>
              </article>
            ))}
          </div>
          {reviews.length > 3 && (
            <button
              type="button"
              aria-expanded={showAll}
              onClick={() => setShowAll((value) => !value)}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {showAll ? "Show fewer" : `Show all ${reviews.length} reviews`}
            </button>
          )}
          {reviewAction && <div className="mt-4">{reviewAction}</div>}
        </>
      )}
    </section>
  );
}
