"use client";

import React, { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { useServices, type Service } from "@/hooks/use-services";

export type { Service } from "@/hooks/use-services";

type Props = {
  value?: string; // slug or free text
  onChange?: (val: string) => void; // called with slug when selected, or typed text
  onSelect?: (service: Service | null) => void; // selected service object or null when free text
  initialSlug?: string;
  placeholder?: string;
};

export default function ServiceCombobox({ value, onChange, onSelect, initialSlug, placeholder = "Service (e.g. Interior painting)" }: Props) {
  const [uncontrolledInput, setUncontrolledInput] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const ref = useRef<HTMLDivElement | null>(null);
  const [uncontrolledSelected, setUncontrolledSelected] = useState<Service | null>(null);
  const { allServices, services: filteredServices } = useServices(value ?? uncontrolledInput);
  const latestPropsRef = useRef({ value, onChange, onSelect });
  const selected = value === undefined ? uncontrolledSelected : allServices.find((service) => service.slug === value) ?? null;
  const input = value === undefined ? uncontrolledInput : allServices.find((service) => service.slug === value)?.name ?? value;

  useEffect(() => {
    latestPropsRef.current = { value, onChange, onSelect };
  }, [value, onChange, onSelect]);

  useEffect(() => {
    if (value !== undefined && allServices.length > 0) {
      onSelect?.(allServices.find((service) => service.slug === value) ?? null);
    }
  }, [value, allServices, onSelect]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const loadedServices = allServices;
      const { value: currentValue, onChange: currentOnChange, onSelect: currentOnSelect } = latestPropsRef.current;
      // If an initialSlug was provided, try to resolve and set the input to the service name
      if (initialSlug && loadedServices.length > 0) {
        const s = loadedServices.find((service) => service.slug === initialSlug);
        if (s) {
          if (currentValue === undefined) {
            setUncontrolledSelected(s);
            setUncontrolledInput(s.name);
          }
          currentOnChange?.(s.slug);
          currentOnSelect?.(s);
        }
      }
      }, 0);
      return () => window.clearTimeout(timer);
  }, [initialSlug, allServices]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = filteredServices;

  function handleSelect(s: Service) {
    if (value === undefined) {
      setUncontrolledSelected(s);
      setUncontrolledInput(s.name);
    }
    setOpen(false);
    onChange?.(s.slug);
    onSelect?.(s);
  }

  function handleInputChange(next: string) {
    if (value === undefined) {
      setUncontrolledInput(next);
      setUncontrolledSelected(null);
    }
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
            if (value === undefined) {
              setUncontrolledSelected(null);
              setUncontrolledInput("");
            }
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
