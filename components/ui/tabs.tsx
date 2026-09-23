"use client";

import * as TabsPrimitive from "@base-ui/react/tabs";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Tabs.Root;

export const TabsList = ({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Tabs.List>) => (
  <TabsPrimitive.Tabs.List className={cn("flex gap-2", className)} {...props} />
);

export const TabsTrigger = ({ className, children, ...props }: React.ComponentProps<typeof TabsPrimitive.Tabs.Tab>) => (
  <TabsPrimitive.Tabs.Tab className={cn("inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium data-[selected]:bg-muted data-[selected]:text-foreground", className)} {...props}>
    {children}
  </TabsPrimitive.Tabs.Tab>
);

export const TabsContent = ({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Tabs.Panel>) => (
  <TabsPrimitive.Tabs.Panel className={cn("mt-4", className)} {...props} />
);
