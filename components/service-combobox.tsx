"use client";

import React, { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";

type Service = { id: number; slug: string; name: string; category_id?: number };

type Props = {
  value?: string; // slug or free text
  onChange?: (val: string) => void; // called with slug when selected, or typed text
  onSelect?: (service: Service | null) => void; // selected service object or null when free text
  initialSlug?: string;
  placeholder?: string;
};

export default function ServiceCombobox({ value = "", onChange, onSelect, initialSlug, placeholder = "Service (e.g. Interior painting)" }: Props) {
  const [services, setServices] = useState<Service[]>([]);
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const ref = useRef<HTMLDivElement | null>(null);
  const [selected, setSelected] = useState<Service | null>(null);

  useEffect(() => {
    // When the external `value` (slug or free text) changes, prefer showing
    // the friendly service name if we can resolve the slug from `services`.
    if (!value) {
      setInput("");
      setSelected(null);
      return;
    }
    const resolved = services.find((s) => s.slug === value);
    if (resolved) {
      setSelected(resolved);
      setInput(resolved.name);
      onSelect?.(resolved);
    } else {
      // free text or unknown slug — show raw value
      setSelected(null);
      setInput(value);
      onSelect?.(null);
    }
  }, [value, services]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("services")
        .select("id,slug,name,category_id")
        .eq("is_active", true)
        .order("category_id")
        .order("sort_order");
      if (!mounted) return;
      setServices((data as any) || []);
      // If an initialSlug was provided, try to resolve and set the input to the service name
      if (initialSlug && data) {
        const s = (data as any[]).find((x) => x.slug === initialSlug);
        if (s) {
          setSelected(s);
          setInput(s.name);
          onChange?.(s.slug);
          onSelect?.(s);
        }
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [initialSlug]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = input
    ? services.filter((s) => s.name.toLowerCase().includes(input.toLowerCase())).slice(0, 20)
    : services.slice(0, 20);

  function handleSelect(s: Service) {
    setSelected(s);
    setInput(s.name);
    setOpen(false);
    onChange?.(s.slug);
    onSelect?.(s);
  }

  function handleInputChange(next: string) {
    setInput(next);
    setSelected(null);
    onChange?.(next);
    onSelect?.(null);
    setOpen(true);
  }

  return (
    <div ref={ref} className="relative">
      <Input
        placeholder={placeholder}
        className="pr-8"
        value={input}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, filtered.length - 1));
            setOpen(true);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter") {
            if (open && filtered[highlight]) {
              e.preventDefault();
              handleSelect(filtered[highlight]);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />

      {selected && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setSelected(null);
            setInput("");
            onChange?.("");
            onSelect?.(null);
            setOpen(false);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-sm text-muted-foreground hover:text-foreground"
        >
          ×
        </button>
      )}

      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-60 w-full divide-y overflow-auto rounded-md border bg-background shadow-lg">
          {filtered.map((s, i) => (
            <li
              key={s.id}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(s)}
              className={`cursor-pointer px-3 py-2 text-sm ${i === highlight ? "bg-muted text-foreground" : ""}`}
            >
              <div className="font-medium">{s.name}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
