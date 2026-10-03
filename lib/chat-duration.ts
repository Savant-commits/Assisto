export function formatDurationMs(ms: number): string {
  if (!ms || ms <= 0) return "under 1 min";

  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "under 1 min";
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remHours = hours % 24;
    return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
  }

  const remMinutes = minutes % 60;
  return remMinutes > 0 ? `${hours}h ${remMinutes}m` : `${hours}h`;
}

export function humanDuration(startIso: string | null | undefined, endIso?: string | null | undefined): string {
  if (!startIso) return "";
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const ms = Math.max(0, end - start);
  return formatDurationMs(ms);
}

export function formatDateTime(dateStr?: string | null) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
