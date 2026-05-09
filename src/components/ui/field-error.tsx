"use client";

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return <p className="text-xs text-rose-600 dark:text-rose-400">{message}</p>;
}
