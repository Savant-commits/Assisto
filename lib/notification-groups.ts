export type NotificationGroupItem = {
  created_at?: string | null;
};

export type NotificationGroup<T extends NotificationGroupItem> = {
  key: "today" | "this-week" | "earlier";
  title: "Today" | "This week" | "Earlier";
  items: T[];
};

export function groupNotifications<T extends NotificationGroupItem>(items: readonly T[], now: Date): NotificationGroup<T>[] {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).getTime();
  const groups: NotificationGroup<T>[] = [
    { key: "today", title: "Today", items: [] },
    { key: "this-week", title: "This week", items: [] },
    { key: "earlier", title: "Earlier", items: [] },
  ];

  for (const item of items) {
    const timestamp = item.created_at ? new Date(item.created_at).getTime() : Number.NaN;
    const date = Number.isFinite(timestamp) ? new Date(timestamp) : null;
    const isToday = date !== null && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
    if (isToday) groups[0].items.push(item);
    else if (Number.isFinite(timestamp) && timestamp < todayStart && timestamp >= weekStart) groups[1].items.push(item);
    else groups[2].items.push(item);
  }

  for (const group of groups) {
    group.items.sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : Number.NaN;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : Number.NaN;
      return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
    });
  }

  return groups.filter((group) => group.items.length > 0);
}
