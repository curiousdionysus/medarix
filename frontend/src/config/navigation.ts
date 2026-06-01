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
  /** i18n key under nav.* */
  labelKey: string;
  to: string;
  icon: LucideIcon;
  roles?: RoleSlug[];
  badgeKey?: "pending" | "queue";
  enterprise?: boolean;
}

export interface NavSection {
  titleKey?: string;
  items: NavItem[];
  enterprise?: boolean;
}

export const NAV_SECTIONS: NavSection[] = [
  {
    titleKey: "nav.workspace",
    items: [
      { labelKey: "nav.worklist", to: "/workspace/worklist", icon: ListChecks },
      { labelKey: "nav.dictation", to: "/workspace/dictation", icon: Mic, roles: ["radiologist", "reporter", "admin"] },
      { labelKey: "nav.reports", to: "/workspace/reports", icon: FileText },
    ],
  },
  {
    titleKey: "nav.aiCenter",
    enterprise: true,
    items: [
      { labelKey: "nav.aiAssistant", to: "/ai/assistant", icon: Bot, roles: ["radiologist", "reporter", "admin"] },
      { labelKey: "nav.suggestions", to: "/ai/suggestions", icon: Sparkles, roles: ["radiologist", "reporter", "admin"] },
      { labelKey: "nav.templates", to: "/ai/templates", icon: LayoutTemplate },
    ],
  },
  {
    items: [
      { labelKey: "nav.analytics", to: "/analytics", icon: BarChart3, roles: ["admin", "radiologist"], enterprise: true },
      { labelKey: "nav.admin", to: "/admin", icon: ShieldCheck, roles: ["admin"] },
    ],
  },
];
