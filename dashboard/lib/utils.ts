import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(value: number, quoteToken: string): string {
  if (!Number.isFinite(value)) return `0 ${quoteToken}`;
  const options: Intl.NumberFormatOptions = {
    maximumFractionDigits: value >= 100 ? 2 : 4
  };
  return `${value.toLocaleString(undefined, options)} ${quoteToken}`;
}

export function formatDelta(value: number, quoteToken: string): string {
  const direction = value >= 0 ? "+" : "-";
  const magnitude = Math.abs(value);
  const options: Intl.NumberFormatOptions = {
    maximumFractionDigits: magnitude >= 100 ? 2 : 4
  };
  return `${direction}${magnitude.toLocaleString(undefined, options)} ${quoteToken}`;
}

export function formatPercent(percent: number): string {
  const sign = percent >= 0 ? "+" : "-";
  const magnitude = Math.abs(percent);
  return `${sign}${magnitude.toFixed(2)}%`;
}
