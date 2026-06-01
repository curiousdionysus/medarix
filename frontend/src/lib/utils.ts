import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name?: string | null, fallback = "?"): string {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Format study date + optional time (API: YYYY-MM-DD and HH:MM:SS). */
export function formatStudyDateTime(
  studyDate?: string | null,
  studyTime?: string | null,
): string {
  if (!studyDate) return "—";
  const datePart = formatDate(studyDate);
  if (!studyTime) return datePart;
  const match = /^(\d{2}):(\d{2})/.exec(studyTime.trim());
  if (!match) return datePart;
  return `${datePart} ${match[1]}:${match[2]}`;
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d}.${m}.${y}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function relativeTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diff = Date.now() - date.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "az önce";
  if (mins < 60) return `${mins} dk önce`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} sa önce`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} gün önce`;
  return formatDate(value);
}

export function formatDuration(minutes?: number | null): string {
  if (minutes == null || Number.isNaN(minutes)) return "—";
  if (minutes < 60) return `${Math.round(minutes)} dk`;
  const hours = Math.floor(minutes / 60);
  const rem = Math.round(minutes % 60);
  return rem ? `${hours} sa ${rem} dk` : `${hours} sa`;
}
