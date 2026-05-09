"use client";

export type ToastType = "success" | "error" | "info";

export interface ToastPayload {
  type?: ToastType;
  title: string;
  description?: string;
  durationMs?: number;
}

const TOAST_EVENT = "pv-frontoffice-toast";

export function showToast(payload: ToastPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: payload }));
}

export function getToastEventName() {
  return TOAST_EVENT;
}

