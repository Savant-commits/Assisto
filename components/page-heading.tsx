import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeadingProps = {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function PageHeading({ title, description, action, className }: PageHeadingProps) {
  return (
    <header className={cn("mb-6 pt-[calc(env(safe-area-inset-top)_+_1.5rem)]", className)}>
      <div className="flex items-start justify-between gap-4">
        <h1 className="min-w-0 font-display text-4xl font-medium tracking-tight text-foreground sm:text-5xl">{title}</h1>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {description && <p className="mt-2 truncate text-sm text-muted-foreground">{description}</p>}
    </header>
  );
}
