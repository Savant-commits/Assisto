import type { ProjectMessageAttachment } from "@/lib/types";

export type AdminReportProfile = {
  full_name?: string | null;
  user_code?: string | null;
};

export type AdminReportAttachment = ProjectMessageAttachment & {
  signedUrl?: string | null;
};

export type AdminReportTarget = {
  id: string;
  rating?: number | null;
  comment?: string | null;
  business_name?: string | null;
  full_name?: string | null;
  user_code?: string | null;
  body?: string | null;
  project_id?: string;
  project_code?: string | null;
  enquiry_code?: string | null;
  deleted_at?: string | null;
  attachments?: AdminReportAttachment[] | null;
  profiles?: AdminReportProfile | null;
  customer_id?: string | null;
  sender_id?: string | null;
  admin_removed_at?: string | null;
  role?: string | null;
};

export type AdminReportRow = {
  id: string;
  reportable_type: string;
  reportable_id: string;
  profiles: AdminReportProfile | null;
  target: AdminReportTarget | null;
  created_at: string;
  reason: string;
  status: string;
  admin_notes: string | null;
  updated_at: string;
};
