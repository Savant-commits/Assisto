export type NotificationRouteRecord = {
  type?: string | null;
  related_id?: string | null;
};

export type NotificationRouteContext = {
  currentPathname?: string;
};

export function getNotificationHref(
  notification: NotificationRouteRecord,
  ctx: NotificationRouteContext = {},
): string | null {
  void ctx;
  const relatedId = notification.related_id;
  switch (notification.type) {
    case "project_message":
      return relatedId ? `/messages/${encodeURIComponent(relatedId)}` : null;
    case "enquiry_created":
    case "enquiry_accepted":
    case "enquiry_declined":
    case "enquiry_confirmed":
    case "enquiry_completion_pending":
    case "enquiry_completed":
    case "enquiry_cancelled":
      return relatedId ? `/enquiries?enquiry=${encodeURIComponent(relatedId)}` : null;
    case "new_provider_in_region":
      return relatedId ? `/providers/${encodeURIComponent(relatedId)}` : null;
    case "welcome":
      return "/";
    default:
      return null;
  }
}