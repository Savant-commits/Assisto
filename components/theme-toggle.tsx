"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  readThemePreference,
  setThemePreference,
  subscribeToTheme,
  type ThemePreference,
} from "@/lib/theme";

const options: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

export default function ThemeToggle() {
  const preference = useSyncExternalStore(
    subscribeToTheme,
    readThemePreference,
    () => "system",
  );

  return (
    <div
      aria-label="Color theme"
      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted p-1"
      role="radiogroup"
    >
      {options.map(({ value, label, Icon }) => {
        const selected = preference === value;

        return (
          <button
            key={value}
            aria-checked={selected}
            aria-label={label}
            className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${selected ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-background hover:text-foreground"}`}
            onClick={() => setThemePreference(value)}
            role="radio"
            type="button"
          >
            <Icon aria-hidden="true" className="size-4" />
            <span className="sr-only">{label}</span>
          </button>
        );
      })}
    </div>
  );
}