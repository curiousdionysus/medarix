import {
  Mic,
  FileText,
  ListChecks,
  Bot,
  Sparkles,
  LayoutTemplate,
  BarChart3,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { RoleSlug } from "@/types/api";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  roles?: RoleSlug[];
  badgeKey?: "pending" | "queue";
  /** Item is only visible with an active Enterprise license. */
  enterprise?: boolean;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
  /** Section is only visible with an active Enterprise license. */
  enterprise?: boolean;
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Çalışma Alanı",
    items: [
      { label: "İş Listesi", to: "/workspace/worklist", icon: ListChecks },
      { label: "Rapor Diktasyonu", to: "/workspace/dictation", icon: Mic, roles: ["radiologist", "reporter", "admin"] },
      { label: "Raporlar", to: "/workspace/reports", icon: FileText },
    ],
  },
  {
    title: "AI Merkezi",
    enterprise: true,
    items: [
      { label: "AI Asistan", to: "/ai/assistant", icon: Bot, roles: ["radiologist", "reporter", "admin"] },
      { label: "Akıllı Öneriler", to: "/ai/suggestions", icon: Sparkles, roles: ["radiologist", "reporter", "admin"] },
      { label: "Şablonlar", to: "/ai/templates", icon: LayoutTemplate },
    ],
  },
  {
    items: [
      { label: "Analitik", to: "/analytics", icon: BarChart3, roles: ["admin", "radiologist"], enterprise: true },
      { label: "Yönetim", to: "/admin", icon: ShieldCheck, roles: ["admin"] },
    ],
  },
];
