"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Input } from "./input";

type SelectOption = {
  value: string;
  label: string;
  disabled: boolean;
};

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  searchable?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  emptyMessage?: string;
};

function flattenText(content: React.ReactNode): string {
  if (typeof content === "string" || typeof content === "number") return String(content);
  if (Array.isArray(content)) return content.map((item) => flattenText(item)).join("");
  if (React.isValidElement(content)) {
    return flattenText((content as React.ReactElement<{ children?: React.ReactNode }>).props.children);
  }
  return "";
}

function parseOptions(children: React.ReactNode): SelectOption[] {
  return React.Children.toArray(children).flatMap((child) => {
    if (!React.isValidElement<React.OptionHTMLAttributes<HTMLOptionElement>>(child)) return [];
    if (child.type !== "option") return [];
    const value = child.props.value === undefined ? "" : String(child.props.value);
    const label = flattenText(child.props.children);
    return [{ value, label, disabled: Boolean(child.props.disabled) }];
  });
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      children,
      searchable = false,
      searchValue,
      onSearchChange,
      searchPlaceholder = "Search options...",
      emptyMessage = "No options found",
      value,
      defaultValue,
      onChange,
      onBlur,
      disabled,
      id,
      name,
      ...props
    },
    ref,
  ) => {
    const rootRef = React.useRef<HTMLDivElement | null>(null);
    const nativeSelectRef = React.useRef<HTMLSelectElement | null>(null);
    const triggerRef = React.useRef<HTMLButtonElement | null>(null);
    const menuRef = React.useRef<HTMLDivElement | null>(null);
    const options = React.useMemo(() => parseOptions(children), [children]);
    const isControlled = value !== undefined;
    const initialValue = defaultValue === undefined ? options[0]?.value ?? "" : String(defaultValue);
    const [internalValue, setInternalValue] = React.useState(initialValue);
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState("");
    const [menuStyle, setMenuStyle] = React.useState<{
      top: number;
      left: number;
      width: number;
      listMaxHeight: number;
      panelMaxHeight: number;
    } | null>(null);
    const resolvedQuery = searchValue ?? query;

    const selectedValue = isControlled ? String(value ?? "") : internalValue;
    const selected = options.find((option) => option.value === selectedValue) ?? null;

    React.useEffect(() => {
      if (isControlled) return;
      setInternalValue(initialValue);
    }, [initialValue, isControlled]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    React.useEffect(() => {
      if (isControlled) return;
      const externalValue = nativeSelectRef.current?.value;
      if (externalValue !== undefined && externalValue !== internalValue) {
        setInternalValue(externalValue);
      }
      // We intentionally run this on every render to mirror programmatic value updates
      // (e.g. react-hook-form reset/setValue) from the hidden native select.
    });

    const filteredOptions = React.useMemo(() => {
      if (!searchable) return options;
      const normalized = resolvedQuery.trim().toLowerCase();
      if (!normalized) return options;
      return options.filter((option) => option.label.toLowerCase().includes(normalized));
    }, [options, resolvedQuery, searchable]);

    const emitBlur = React.useCallback(() => {
      const syntheticEvent = {
        target: { value: selectedValue, name: name ?? "" },
        currentTarget: { value: selectedValue, name: name ?? "" },
      } as unknown as React.FocusEvent<HTMLSelectElement>;
      onBlur?.(syntheticEvent);
    }, [name, onBlur, selectedValue]);

    const clearSearch = React.useCallback(() => {
      if (searchValue === undefined) {
        setQuery("");
      }
      onSearchChange?.("");
    }, [onSearchChange, searchValue]);

    const closeDropdown = React.useCallback(
      (shouldEmitBlur = true) => {
        setOpen(false);
        clearSearch();
        if (shouldEmitBlur) {
          emitBlur();
        }
      },
      [clearSearch, emitBlur],
    );

    React.useEffect(() => {
      if (!open) return;

      const updatePosition = () => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const gutter = 12;
        const gap = 8;
        const spaceBelow = viewportHeight - rect.bottom - gutter;
        const spaceAbove = rect.top - gutter;
        const prefersAbove = spaceBelow < 220 && spaceAbove > spaceBelow;
        const panelTarget = Math.max(160, Math.min(360, prefersAbove ? spaceAbove : spaceBelow));
        const searchSectionHeight = searchable ? 56 : 0;
        const chromeHeight = 16;
        const listMaxHeight = Math.max(96, panelTarget - searchSectionHeight - chromeHeight);
        const optionCount = Math.max(filteredOptions.length, 1);
        const optionRowHeight = 44;
        const listEstimatedHeight = Math.min(optionCount * optionRowHeight, listMaxHeight);
        const panelEstimatedHeight = listEstimatedHeight + searchSectionHeight + chromeHeight;
        const panelMaxHeight = Math.min(panelTarget, panelEstimatedHeight);
        const top = prefersAbove
          ? Math.max(gutter, rect.top - gap - panelMaxHeight)
          : Math.max(gutter, rect.bottom + gap);

        setMenuStyle({
          top,
          left: rect.left,
          width: rect.width,
          listMaxHeight,
          panelMaxHeight,
        });
      };

      updatePosition();
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);
      return () => {
        window.removeEventListener("resize", updatePosition);
        window.removeEventListener("scroll", updatePosition, true);
      };
    }, [filteredOptions.length, open, searchable]);

    React.useEffect(() => {
      function onPointerDown(event: MouseEvent) {
        if (!open) return;
        const target = event.target as Node;
        if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
        closeDropdown();
      }

      function onEscape(event: KeyboardEvent) {
        if (!open) return;
        if (event.key === "Escape") {
          closeDropdown(false);
        }
      }

      document.addEventListener("mousedown", onPointerDown);
      document.addEventListener("keydown", onEscape);
      return () => {
        document.removeEventListener("mousedown", onPointerDown);
        document.removeEventListener("keydown", onEscape);
      };
    }, [closeDropdown, open]);

    const emitChange = (nextValue: string) => {
      const syntheticEvent = {
        target: { value: nextValue, name: name ?? "" },
        currentTarget: { value: nextValue, name: name ?? "" },
      } as unknown as React.ChangeEvent<HTMLSelectElement>;
      onChange?.(syntheticEvent);
    };

    const handleSelect = (nextValue: string) => {
      if (!isControlled) {
        setInternalValue(nextValue);
      }
      emitChange(nextValue);
      closeDropdown();
    };

    const assignSelectRef = (node: HTMLSelectElement | null) => {
      nativeSelectRef.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };

    return (
      <div ref={rootRef} className="relative">
        <select
          ref={assignSelectRef}
          id={id ? `${id}-native` : undefined}
          name={name}
          value={selectedValue}
          onChange={(event) => handleSelect(event.target.value)}
          onBlur={onBlur}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden
          className="sr-only"
          {...props}
        >
          {children}
        </select>
        <button
          ref={triggerRef}
          type="button"
          id={id}
          disabled={disabled}
          aria-expanded={open}
          className={cn(
            "relative flex h-11 w-full items-center rounded-xl border border-slate-300 bg-white px-3 pr-9 text-left text-sm text-slate-900 outline-none transition focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:h-10",
            open && "border-sky-500 ring-2 ring-sky-500",
            className,
          )}
          onClick={() => {
            if (open) {
              closeDropdown();
              return;
            }
            if (triggerRef.current) {
              const rect = triggerRef.current.getBoundingClientRect();
              if (rect.bottom > window.innerHeight - 220) {
                triggerRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
              }
            }
            setOpen(true);
          }}
        >
          <span className={cn(!selectedValue ? "text-slate-400 dark:text-slate-500" : "")}>
            {selected?.label ?? ""}
          </span>
          <ChevronDown
            className={cn(
              "pointer-events-none absolute right-[5px] top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-transform",
              open ? "rotate-180" : "",
            )}
          />
        </button>

        {open && menuStyle && typeof document !== "undefined"
          ? createPortal(
              <div
                ref={menuRef}
                className="fixed z-[1200] rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900"
                style={{
                  top: menuStyle.top,
                  left: menuStyle.left,
                  width: menuStyle.width,
                  maxHeight: menuStyle.panelMaxHeight,
                }}
              >
                {searchable ? (
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
                ) : null}
                <div
                  className="overflow-y-auto rounded-lg border border-slate-100 dark:border-slate-800"
                  style={{ maxHeight: menuStyle.listMaxHeight }}
                >
                  {filteredOptions.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">{emptyMessage}</p>
                  ) : (
                    <ul role="listbox" className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredOptions.map((option) => (
                        <li key={option.value}>
                          <button
                            type="button"
                            disabled={option.disabled}
                            className="flex min-h-11 w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400 dark:text-slate-200 dark:hover:bg-slate-800 dark:disabled:text-slate-500 sm:min-h-0"
                            onClick={() => handleSelect(option.value)}
                          >
                            <span>{option.label}</span>
                            {option.value === selectedValue ? <Check className="h-4 w-4 text-emerald-500" /> : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>,
              document.body,
            )
          : null}
      </div>
    );
  },
);

Select.displayName = "Select";
