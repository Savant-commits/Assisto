export function friendlyDbError(
  error: { message?: string; code?: string } | null | undefined,
  fallback: string
): string {
  const message = error?.message ?? "";

  if (error?.code === "54000" && message.includes("Too many requests")) {
    return "You're doing that too quickly. Please wait a few minutes and try again.";
  }

  if (error?.code === "54000" && message.includes("at most 5 attachments")) {
    return "A message can have at most 5 attachments.";
  }

  if (message.includes("Portfolio limit reached")) {
    return "You've reached the limit of 30 portfolio items. Remove one to add another.";
  }

  if (error?.code === "23514" && message.includes("_len_chk")) {
    return "That text is too long. Please shorten it.";
  }

  if (
    error?.code === "42501" &&
    (message.includes("cannot be changed") || message.includes("cannot set"))
  ) {
    return "This change isn't allowed.";
  }

  if (error?.code === "42501" || message.includes("Not authorized")) {
    return "You don't have permission to do that.";
  }

  return fallback;
}