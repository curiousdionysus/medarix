import type { RoleSlug } from "@/types/api";

export const ROLE_LABELS: Record<string, string> = {
  radiologist: "Radyolog",
  reporter: "Raportör",
  technician: "Teknisyen",
  admin: "Admin",
  viewer: "Görüntüleyici",
  external_consultant: "Dış Konsültan",
};

export function roleLabel(slug: RoleSlug | string, fallback?: string): string {
  return ROLE_LABELS[slug] ?? fallback ?? slug;
}
