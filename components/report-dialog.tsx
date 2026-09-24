"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { FormControl, FormField, FormItem, FormLabel, FormMessage, Form } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const reportSchema = z.object({
  reason: z.string().trim().min(1, "Please provide a reason for your report"),
});

type ReportFormValues = z.infer<typeof reportSchema>;

type ReportDialogProps = {
  reportableType: "provider" | "review";
  reportableId: string;
  triggerLabel?: string;
  onSuccess?: () => void;
};

export function ReportDialog({
  reportableType,
  reportableId,
  triggerLabel = "Report",
  onSuccess,
}: ReportDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: { reason: "" },
  });

  async function onSubmit(values: ReportFormValues) {
    setIsSubmitting(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc("submit_report", {
        p_reportable_type: reportableType,
        p_reportable_id: reportableId,
        p_reason: values.reason,
      });

      if (rpcError) {
        // Handle specific error cases
        if (rpcError.code === "23505") {
          // Unique constraint violation
          setError("You've already reported this. Thank you for helping keep our community safe.");
        } else {
          setError(rpcError.message || "Failed to submit report");
        }
        return;
      }

      setIsOpen(false);
      form.reset();
      onSuccess?.();
    } catch (err) {
      setError((err as any)?.message || "Failed to submit report");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="text-xs text-muted-foreground hover:text-destructive"
      >
        {triggerLabel}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report {reportableType}</DialogTitle>
            <DialogDescription>
              Help us keep the community safe by letting us know about this {reportableType}.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason for report</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={4}
                        placeholder="Please explain why you're reporting this..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setIsOpen(false);
                    setError(null);
                    form.reset();
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Submit report"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
