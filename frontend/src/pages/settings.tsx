import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Settings, User, Palette, CreditCard, Monitor, Moon, Sun, Contrast, Check, BadgeCheck } from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { useLicenseInfo } from "@/features/license/api";
import { useLocale, useT } from "@/features/i18n/locale-context";
import { useTheme } from "@/features/theme/theme-context";
import { api, apiErrorMessage } from "@/lib/api";
import { roleLabel } from "@/config/roles";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, initials } from "@/lib/utils";
import type { UserOut } from "@/types/api";

const TABS = [
  { id: "profile", labelKey: "settings.profile", icon: User },
  { id: "appearance", labelKey: "settings.appearance", icon: Palette },
  { id: "account", labelKey: "settings.account", icon: CreditCard },
] as const;

export default function SettingsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const t = useT();
  const active = location.pathname.split("/")[2] || "profile";

  return (
    <div className="space-y-5">
      <PageHeader title={t("settings.title")} description={t("settings.description")} icon={<Settings className="size-5" />} />
      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <nav className="flex gap-1 lg:flex-col">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => navigate(`/settings/${tab.id}`)}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active === tab.id ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60",
              )}
            >
              <tab.icon className="size-4" />
              {t(tab.labelKey)}
            </button>
          ))}
        </nav>
        <div>
          {active === "profile" && <ProfileTab />}
          {active === "appearance" && <AppearanceTab />}
          {active === "account" && <AccountTab />}
        </div>
      </div>
    </div>
  );
}

function ProfileTab() {
  const t = useT();
  const { locale } = useLocale();
  const { user, refreshUser } = useAuth();
  const [displayName, setDisplayName] = React.useState(user?.display_name ?? "");
  const [email, setEmail] = React.useState(user?.email ?? "");
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.put<UserOut>("/auth/me", { display_name: displayName, email: email || null });
      await refreshUser();
      toast.success(t("settings.saved"));
    } catch (err) {
      toast.error(apiErrorMessage(err, t("settings.saveFail")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profil</CardTitle>
        <CardDescription>Kişisel bilgilerinizi yönetin.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center gap-4">
          <Avatar className="size-16">
            <AvatarFallback className="text-lg">{initials(user?.display_name || user?.username)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold">{user?.username}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {user?.roles.map((r) => (
                <Badge key={r} variant="secondary">{roleLabel(r, undefined, locale)}</Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="dn">Ad Soyad</Label>
            <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="em">E-posta</Label>
            <Input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            <Check /> Kaydet
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AppearanceTab() {
  const { locale, setLocale } = useLocale();
  const t = useT();
  const { mode, setMode, highContrast, setHighContrast } = useTheme();
  const MODES = [
    { id: "light", labelKey: "settings.themeLight", icon: Sun },
    { id: "dark", labelKey: "settings.themeDark", icon: Moon },
    { id: "system", labelKey: "settings.themeSystem", icon: Monitor },
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.appearance")}</CardTitle>
        <CardDescription>{t("settings.themeDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>{t("settings.language")}</Label>
          <p className="text-xs text-muted-foreground">{t("settings.languageDesc")}</p>
          <div className="grid grid-cols-2 gap-3 max-w-xs">
            <button
              type="button"
              onClick={() => setLocale("tr")}
              className={cn(
                "rounded-xl border-2 p-3 text-sm font-medium transition-colors",
                locale === "tr" ? "border-primary bg-primary/5" : "border-border hover:bg-secondary",
              )}
            >
              {t("settings.langTr")}
            </button>
            <button
              type="button"
              onClick={() => setLocale("en")}
              className={cn(
                "rounded-xl border-2 p-3 text-sm font-medium transition-colors",
                locale === "en" ? "border-primary bg-primary/5" : "border-border hover:bg-secondary",
              )}
            >
              {t("settings.langEn")}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <Label>{t("settings.theme")}</Label>
          <div className="grid grid-cols-3 gap-3">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors",
                  mode === m.id ? "border-primary bg-primary/5" : "border-border hover:bg-secondary",
                )}
              >
                <m.icon className="size-5" />
                <span className="text-sm font-medium">{t(m.labelKey)}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <Contrast className="size-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{t("settings.highContrast")}</p>
              <p className="text-xs text-muted-foreground">{t("settings.highContrastDesc")}</p>
            </div>
          </div>
          <Switch checked={highContrast} onCheckedChange={setHighContrast} />
        </div>
      </CardContent>
    </Card>
  );
}

function AccountTab() {
  const navigate = useNavigate();
  const { user, logout, hasRole } = useAuth();
  const { data: license, isLoading } = useLicenseInfo();
  const isEnterprise = !!license?.is_enterprise;
  const isAdmin = hasRole("admin");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Abonelik</CardTitle>
          <CardDescription>
            {isEnterprise ? "Kurumsal lisans etkin." : "Standart sürüm — Enterprise özellikleri kapalı."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <div
              className={cn(
                "flex items-center justify-between rounded-lg border p-4",
                isEnterprise ? "border-primary/30 bg-primary/5" : "border-border bg-muted/30",
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-lg",
                    isEnterprise ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  <BadgeCheck className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{isEnterprise ? "Enterprise" : "Standard"}</p>
                    {isEnterprise ? (
                      <Badge variant="success">Aktif</Badge>
                    ) : (
                      <Badge variant="muted">Standart</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {isEnterprise
                      ? `Analitik, gelişmiş raporlama ve AI asistan.${license?.licensed_to ? ` Lisans: ${license.licensed_to}.` : ""}`
                      : "Analitik ve gelişmiş özellikler için yöneticinizden Enterprise lisansı isteyin."}
                  </p>
                  {isEnterprise && license?.expires_at && (
                    <p className="mt-1 text-xs text-muted-foreground">Son kullanma: {license.expires_at}</p>
                  )}
                </div>
              </div>
              {isAdmin ? (
                <Button variant="outline" onClick={() => navigate("/admin/license")}>
                  Lisansı Yönet
                </Button>
              ) : (
                <Button variant="outline" disabled title="Lisans yönetimi yalnızca yöneticiler içindir">
                  Planı Yönet
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Oturum</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{user?.username}</span> olarak giriş yaptınız.
          </p>
          <Button variant="destructive" onClick={logout}>
            Çıkış Yap
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
