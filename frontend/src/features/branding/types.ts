export interface PublicBranding {
  org_name: string;
  product_title: string;
  product_subtitle: string;
  browser_title: string;
  document_title: string;
  primary_color: string;
  accent_color: string;
  sidebar_background: string;
  sidebar_accent: string;
  primary_foreground: string;
  accent_foreground: string;
  secondary_foreground: string;
  logo_url: string;
  logo_dark_url: string;
  favicon_url: string;
  login_headline: string;
  login_tagline: string;
  footer_text: string;
  support_email: string;
  support_phone: string;
  font_family: string;
}

export const BRANDING_SETTING_KEYS = [
  "branding.org_name",
  "branding.product_title",
  "branding.product_subtitle",
  "branding.browser_title",
  "branding.primary_color",
  "branding.accent_color",
  "branding.sidebar_background",
  "branding.sidebar_accent",
  "branding.primary_foreground",
  "branding.accent_foreground",
  "branding.secondary_foreground",
  "branding.logo_url",
  "branding.logo_dark_url",
  "branding.favicon_url",
  "branding.login_headline",
  "branding.login_tagline",
  "branding.footer_text",
  "branding.support_email",
  "branding.support_phone",
  "branding.font_family",
] as const;

export const BRANDING_CATEGORY = "Kurumsal Kimlik";
