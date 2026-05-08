import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | string | null | undefined) {
  const numeric = typeof value === "string" ? Number(value) : value;
  const safe = typeof numeric === "number" && Number.isFinite(numeric) ? numeric : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(safe);
}

export function formatDate(value: string | number | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function formatDateTime(value: string | number | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getErrorMessage(error: unknown, fallback = "Something went wrong.") {
  if (error && typeof error === "object" && "data" in error) {
    const payload = error.data as { message?: string };
    return payload?.message ?? fallback;
  }
  return fallback;
}

export function formatCompactId(value: string | null | undefined) {
  if (!value) return "-";
  return value.slice(0, 8);
}

export function getCustomerDisplayName(customerDetails: unknown) {
  if (!customerDetails || typeof customerDetails !== "object") return "Customer";
  const data = customerDetails as Record<string, unknown>;
  const candidate = data.name ?? data.customerName ?? data.company ?? data.site;
  return typeof candidate === "string" && candidate.trim().length > 0 ? candidate : "Customer";
}
