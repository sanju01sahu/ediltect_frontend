"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "./input";

export interface SearchableSelectOption {
  value: string;
  label: string;
  keywords?: string[];
}

interface SearchableSelectProps {
  id?: string;
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
}

export function SearchableSelect({
  id,
  value,
  options,
  onChange,
  searchValue,
  onSearchChange,
  placeholder = "Select an option",
  searchPlaceholder = "Search...",
  emptyMessage = "No options found",
  disabled = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const resolvedQuery = searchValue ?? query;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value) ?? null;
  const closeDropdown = useCallback(() => {
    setOpen(false);
    if (searchValue === undefined) {
      setQuery("");
    }
    onSearchChange?.("");
  }, [onSearchChange, searchValue]);

  const filteredOptions = useMemo(() => {
    const normalized = resolvedQuery.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((option) =>
      [option.label, ...(option.keywords ?? [])].join(" ").toLowerCase().includes(normalized),
    );
  }, [options, resolvedQuery]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeDropdown();
      }
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeDropdown();
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [closeDropdown]);

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        className={cn(
          "relative flex h-11 w-full items-center rounded-xl border border-slate-300 bg-white px-3 pr-9 text-left text-sm text-slate-900 outline-none transition focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:h-10",
          open && "border-sky-500 ring-2 ring-sky-500",
        )}
        onClick={() => {
          if (open) {
            closeDropdown();
          } else {
            setOpen(true);
          }
        }}
      >
        <span className={cn(!selected ? "text-slate-400 dark:text-slate-500" : "")}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cn(
            "pointer-events-none absolute right-[5px] top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-transform",
            open ? "rotate-180" : "",
          )}
        />
      </button>

      {open ? (
        <div className="absolute z-50 mt-2 w-full rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              autoFocus
              value={resolvedQuery}
              onChange={(event) => {
                if (searchValue === undefined) {
                  setQuery(event.target.value);
                }
                onSearchChange?.(event.target.value);
              }}
              placeholder={searchPlaceholder}
              className="pl-9"
            />
          </div>
          <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-100 dark:border-slate-800">
            {filteredOptions.length === 0 ? (
              <p className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">{emptyMessage}</p>
            ) : (
              <ul role="listbox" className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredOptions.map((option) => (
                  <li key={option.value}>
                    <button
                      type="button"
                      className="flex min-h-11 w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 sm:min-h-0"
                      onClick={() => {
                        onChange(option.value);
                        closeDropdown();
                      }}
                    >
                      <span>{option.label}</span>
                      {option.value === value ? <Check className="h-4 w-4 text-emerald-500" /> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
