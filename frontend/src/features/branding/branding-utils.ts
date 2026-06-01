import type { PublicBranding } from "@/features/branding/types";

const DEFAULT_BRANDING: PublicBranding = {
  org_name: "",
  product_title: "Medarix",
  product_subtitle: "Radyoloji Platformu",
  browser_title: "Medarix",
  document_title: "Medarix",
  primary_color: "#1d6fd8",
  accent_color: "#1fa89a",
  sidebar_background: "#0f1729",
  sidebar_accent: "#2b7de9",
  primary_foreground: "#f8fafc",
  accent_foreground: "#ffffff",
  secondary_foreground: "#1e293b",
  logo_url: "",
  logo_dark_url: "",
  favicon_url: "",
  login_headline: "Yapay zeka destekli radyoloji raporlama",
  login_tagline: "Dikte, transkripsiyon ve yapılandırılmış raporlama tek platformda.",
  footer_text: "",
  support_email: "",
  support_phone: "",
  font_family: '"Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif',
};

export function mergeBranding(partial?: Partial<PublicBranding> | null): PublicBranding {
  return { ...DEFAULT_BRANDING, ...partial };
}

/** #rrggbb → "H S% L%" for CSS variables in index.css */
export function hexToHslTriplet(hex: string): string | null {
  const normalized = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function setCssHslVar(root: HTMLElement, name: string, hex: string) {
  const triplet = hexToHslTriplet(hex);
  if (triplet) root.style.setProperty(name, triplet);
}

export function applyBrandingToDocument(branding: PublicBranding) {
  const root = document.documentElement;
  setCssHslVar(root, "--primary", branding.primary_color);
  setCssHslVar(root, "--ring", branding.primary_color);
  setCssHslVar(root, "--accent", branding.accent_color);
  setCssHslVar(root, "--sidebar", branding.sidebar_background);
  setCssHslVar(root, "--sidebar-accent", branding.sidebar_accent);
  setCssHslVar(root, "--primary-foreground", branding.primary_foreground);
  setCssHslVar(root, "--accent-foreground", branding.accent_foreground);
  setCssHslVar(root, "--secondary-foreground", branding.secondary_foreground);
  setCssHslVar(root, "--chart-1", branding.primary_color);
  setCssHslVar(root, "--chart-2", branding.accent_color);

  if (branding.font_family.trim()) {
    root.style.setProperty("--font-sans", branding.font_family);
    document.body.style.fontFamily = branding.font_family;
  }

  document.title = branding.document_title || branding.product_title || "Medarix";

  const favicon = branding.favicon_url.trim();
  if (favicon) {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = favicon;
  }
}

export function pickLogoSrc(branding: PublicBranding, theme: "light" | "dark"): string | null {
  const primary = branding.logo_url.trim();
  const darkAlt = branding.logo_dark_url.trim();
  if (theme === "light" && darkAlt) return darkAlt;
  return primary || darkAlt || null;
}

export async function fileToDataUrl(file: File, maxBytes: number): Promise<string> {
  if (file.size > maxBytes) {
    throw new Error(`Dosya çok büyük (maks. ${Math.round(maxBytes / 1024)} KB)`);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Dosya okunamadı"));
    reader.readAsDataURL(file);
  });
}
