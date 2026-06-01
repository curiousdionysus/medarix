import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2, ImageIcon, Palette, RotateCcw, Upload } from "lucide-react";
import {
  BRANDING_CATEGORY,
  BRANDING_SETTING_KEYS,
} from "@/features/branding/types";
import { fileToDataUrl, mergeBranding } from "@/features/branding/branding-utils";
import { useBranding } from "@/features/branding/branding-context";
import { useSystemSettings, useUpdateSystemSettings } from "@/features/admin/api";
import { useApiError } from "@/features/i18n/helpers";
import { useT } from "@/features/i18n/locale-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const LOGO_MAX_BYTES = 400_000;

type Draft = Record<string, string>;

const FIELD_GROUPS: {
  titleKey: string;
  descriptionKey?: string;
  fields: {
    key: (typeof BRANDING_SETTING_KEYS)[number];
    labelKey: string;
    type?: "color" | "textarea" | "file" | "text";
  }[];
}[] = [
  {
    titleKey: "branding.orgTitles",
    descriptionKey: "branding.orgTitlesDesc",
    fields: [
      { key: "branding.org_name", labelKey: "branding.orgName" },
      { key: "branding.product_title", labelKey: "branding.productTitle" },
      { key: "branding.product_subtitle", labelKey: "branding.productSubtitle" },
      { key: "branding.browser_title", labelKey: "branding.browserTitle" },
    ],
  },
  {
    titleKey: "branding.colors",
    descriptionKey: "branding.colorsDesc",
    fields: [
      { key: "branding.primary_color", labelKey: "branding.primary", type: "color" },
      { key: "branding.accent_color", labelKey: "branding.accentColor", type: "color" },
      { key: "branding.sidebar_background", labelKey: "branding.sidebarBg", type: "color" },
      { key: "branding.sidebar_accent", labelKey: "branding.sidebarAccent", type: "color" },
    ],
  },
  {
    titleKey: "branding.buttonText",
    descriptionKey: "branding.buttonTextDesc",
    fields: [
      { key: "branding.primary_foreground", labelKey: "branding.primaryBtnText", type: "color" },
      { key: "branding.accent_foreground", labelKey: "branding.accentBtnText", type: "color" },
      { key: "branding.secondary_foreground", labelKey: "branding.secondaryBtnText", type: "color" },
    ],
  },
  {
    titleKey: "branding.logosAndIcon",
    fields: [
      { key: "branding.logo_url", labelKey: "branding.logoDarkBg", type: "file" },
      { key: "branding.logo_dark_url", labelKey: "branding.logoLightBg", type: "file" },
      { key: "branding.favicon_url", labelKey: "branding.favicon", type: "file" },
    ],
  },
  {
    titleKey: "branding.loginScreen",
    fields: [
      { key: "branding.login_headline", labelKey: "branding.loginHeadline", type: "textarea" },
      { key: "branding.login_tagline", labelKey: "branding.loginTagline", type: "textarea" },
      { key: "branding.footer_text", labelKey: "branding.footerText", type: "textarea" },
    ],
  },
  {
    titleKey: "branding.contactTypography",
    fields: [
      { key: "branding.support_email", labelKey: "branding.supportEmail" },
      { key: "branding.support_phone", labelKey: "branding.supportPhone" },
      { key: "branding.font_family", labelKey: "branding.fontFamily", type: "text" },
    ],
  },
];

function ColorField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const hex = value.startsWith("#") ? value : `#${value.replace(/^#/, "")}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <input
          type="color"
          id={`${id}-picker`}
          className="size-10 shrink-0 cursor-pointer rounded-md border border-border bg-transparent"
          value={/^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#1d6fd8"}
          onChange={(e) => onChange(e.target.value)}
        />
        <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder="#2563eb" className="font-mono text-sm" />
      </div>
    </div>
  );
}

function LogoUploadField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const t = useT();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const uploadedLabel = t("branding.uploadedFile");
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file, LOGO_MAX_BYTES);
      onChange(dataUrl);
      toast.success(t("branding.imageUploaded"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("branding.uploadFail"));
    }
  };
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          <Upload className="size-4" /> {t("branding.chooseFile")}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
            {t("branding.remove")}
          </Button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp,.ico"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <Input
        value={value.startsWith("data:") ? uploadedLabel : value}
        placeholder={t("branding.urlOrUpload")}
        onChange={(e) => onChange(e.target.value === uploadedLabel ? "" : e.target.value)}
        className="font-mono text-xs"
        readOnly={value.startsWith("data:")}
      />
      {value && (value.startsWith("data:") || value.startsWith("http")) && (
        <img src={value} alt="" className="max-h-16 max-w-[200px] rounded border border-border bg-white object-contain p-1" />
      )}
    </div>
  );
}

export function BrandingTab() {
  const t = useT();
  const apiErr = useApiError();
  const { data, isLoading } = useSystemSettings();
  const update = useUpdateSystemSettings();
  const { refresh } = useBranding();
  const [draft, setDraft] = React.useState<Draft>({});

  const group = data?.find((g) => g.category === BRANDING_CATEGORY);
  const serverMap = React.useMemo(() => {
    const m: Record<string, string> = {};
    group?.settings.forEach((s) => {
      m[s.key] = s.value;
    });
    return m;
  }, [group]);

  const valueOf = (key: string) => (key in draft ? draft[key] : (serverMap[key] ?? ""));
  const setValue = (key: string, value: string) => setDraft((d) => ({ ...d, [key]: value }));

  const preview = React.useMemo(() => {
    const patch: Record<string, string> = {};
    for (const key of BRANDING_SETTING_KEYS) {
      const short = key.replace("branding.", "");
      patch[short] = valueOf(key);
    }
    return mergeBranding(patch as Partial<ReturnType<typeof mergeBranding>>);
  }, [draft, serverMap]);

  const resetDefaults = () => {
    const next: Draft = {};
    for (const key of BRANDING_SETTING_KEYS) {
      const row = group?.settings.find((s) => s.key === key);
      if (row) next[key] = "";
    }
    setDraft(next);
    toast.message(t("branding.draftReset"));
  };

  const save = async () => {
    if (Object.keys(draft).length === 0) {
      toast.info(t("admin.noChanges"));
      return;
    }
    try {
      await update.mutateAsync(draft);
      toast.success(t("branding.saved"));
      setDraft({});
      refresh();
    } catch (err) {
      toast.error(apiErr(err, "branding.saveFail"));
    }
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!group) {
    return <p className="text-sm text-muted-foreground">{t("branding.loadFail")}</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {FIELD_GROUPS.map((section) => (
          <Card key={section.titleKey}>
            <CardHeader>
              <CardTitle className="text-base">{t(section.titleKey)}</CardTitle>
              {section.descriptionKey && <CardDescription>{t(section.descriptionKey)}</CardDescription>}
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {section.fields.map((f) => (
                <div key={f.key} className={cn(f.type === "textarea" || f.type === "file" ? "sm:col-span-2" : "")}>
                  {f.type === "color" ? (
                    <ColorField
                      id={f.key}
                      label={t(f.labelKey)}
                      value={valueOf(f.key)}
                      onChange={(v) => setValue(f.key, v)}
                    />
                  ) : f.type === "file" ? (
                    <LogoUploadField label={t(f.labelKey)} value={valueOf(f.key)} onChange={(v) => setValue(f.key, v)} />
                  ) : f.type === "textarea" ? (
                    <div className="space-y-1.5">
                      <Label htmlFor={f.key}>{t(f.labelKey)}</Label>
                      <Textarea id={f.key} rows={2} value={valueOf(f.key)} onChange={(e) => setValue(f.key, e.target.value)} />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Label htmlFor={f.key}>{t(f.labelKey)}</Label>
                      <Input id={f.key} value={valueOf(f.key)} onChange={(e) => setValue(f.key, e.target.value)} />
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={resetDefaults}>
            <RotateCcw className="size-4" /> {t("branding.resetDraft")}
          </Button>
          <Button onClick={save} disabled={update.isPending || Object.keys(draft).length === 0}>
            <CheckCircle2 className="size-4" /> {t("branding.saveBranding")}
          </Button>
        </div>
      </div>

      <Card className="h-fit lg:sticky lg:top-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="size-4" /> {t("branding.preview")}
          </CardTitle>
          <CardDescription>{t("admin.previewAfterSave")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="rounded-xl p-4 text-white"
            style={{ backgroundColor: preview.sidebar_background }}
          >
            <div className="flex items-center gap-2">
              <div
                className="flex size-10 items-center justify-center rounded-lg shadow"
                style={{ backgroundColor: preview.sidebar_accent }}
              >
                {preview.logo_url ? (
                  <img src={preview.logo_url} alt="" className="max-h-8 max-w-8 object-contain" />
                ) : (
                  <ImageIcon className="size-5" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{preview.product_title}</p>
                <p className="truncate text-[11px] opacity-80">{preview.product_subtitle}</p>
                {preview.org_name && (
                  <p className="truncate text-[10px] opacity-60">{preview.org_name}</p>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="h-8 flex-1 rounded-md" style={{ backgroundColor: preview.primary_color }} title={t("branding.primary")} />
            <div className="h-8 flex-1 rounded-md" style={{ backgroundColor: preview.accent_color }} title={t("branding.accent")} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md px-3 py-1.5 text-sm font-medium"
              style={{
                backgroundColor: preview.primary_color,
                color: preview.primary_foreground,
              }}
            >
              {t("branding.primaryBtn")}
            </button>
            <button
              type="button"
              className="rounded-md border px-3 py-1.5 text-sm font-medium"
              style={{
                borderColor: preview.primary_color,
                color: preview.secondary_foreground,
              }}
            >
              {t("branding.secondaryBtn")}
            </button>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{preview.login_tagline}</p>
        </CardContent>
      </Card>
    </div>
  );
}
