import * as React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Stethoscope, Mic, FileText, ShieldCheck, Activity, Eye, EyeOff } from "lucide-react";
import { useBranding } from "@/features/branding/branding-context";
import { useAuth } from "@/features/auth/auth-context";
import { useLocale, useT } from "@/features/i18n/locale-context";
import { apiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

type FormValues = { username: string; password: string };

function safeInternalPath(path: string | undefined): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return "/workspace/worklist";
  }
  return path;
}

const FEATURE_KEYS = [
  { icon: Mic, titleKey: "login.featureDictationTitle", textKey: "login.featureDictationText" },
  { icon: FileText, titleKey: "login.featureReportsTitle", textKey: "login.featureReportsText" },
  { icon: Activity, titleKey: "login.featureAnalyticsTitle", textKey: "login.featureAnalyticsText" },
  { icon: ShieldCheck, titleKey: "login.featureSecurityTitle", textKey: "login.featureSecurityText" },
] as const;

export default function LoginPage() {
  const { branding, logoSrc } = useBranding();
  const { locale, setLocale } = useLocale();
  const t = useT();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPw, setShowPw] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const schema = React.useMemo(
    () =>
      z.object({
        username: z.string().min(1, t("login.errorUser")),
        password: z.string().min(1, t("login.errorPass")),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await login(values.username, values.password);
      const rawTo = (location.state as { from?: { pathname?: string } })?.from?.pathname;
      navigate(safeInternalPath(rawTo), { replace: true });
    } catch (err) {
      setServerError(apiErrorMessage(err, t("login.errorFail")));
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-12 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(60% 60% at 80% 0%, hsl(211 92% 56% / 0.35), transparent), radial-gradient(50% 50% at 0% 100%, hsl(182 65% 46% / 0.25), transparent)",
          }}
        />
        <div className="relative flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-sidebar-accent shadow-lg">
            {logoSrc ? (
              <img src={logoSrc} alt="" className="max-h-8 max-w-8 object-contain" />
            ) : (
              <Stethoscope className="size-6" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-lg font-extrabold tracking-tight">{branding.product_title}</p>
            <p className="text-xs text-sidebar-muted">{branding.product_subtitle}</p>
            {branding.org_name ? (
              <p className="text-[11px] text-sidebar-muted/90">{branding.org_name}</p>
            ) : null}
          </div>
        </div>

        <div className="relative space-y-8">
          <div>
            <h1 className="text-3xl font-bold leading-tight">{branding.login_headline}</h1>
            <p className="mt-3 max-w-md text-sidebar-foreground/80">{branding.login_tagline}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {FEATURE_KEYS.map((f) => (
              <div key={f.titleKey} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <f.icon className="size-5 text-sidebar-accent" />
                <p className="mt-2 text-sm font-semibold">{t(f.titleKey)}</p>
                <p className="mt-0.5 text-xs text-sidebar-foreground/70">{t(f.textKey)}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-sidebar-muted">
          {branding.footer_text ||
            `© ${new Date().getFullYear()} ${branding.org_name || branding.product_title}`}
          {(branding.support_email || branding.support_phone) && (
            <span className="mt-1 block">
              {[branding.support_email, branding.support_phone].filter(Boolean).join(" · ")}
            </span>
          )}
        </p>
      </div>

      <div className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-4 flex justify-end gap-1">
            <Button
              variant={locale === "tr" ? "secondary" : "outline"}
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => setLocale("tr")}
            >
              TR
            </Button>
            <Button
              variant={locale === "en" ? "secondary" : "outline"}
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => setLocale("en")}
            >
              EN
            </Button>
          </div>

          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              {logoSrc ? (
                <img src={logoSrc} alt="" className="max-h-6 max-w-6 object-contain" />
              ) : (
                <Stethoscope className="size-5" />
              )}
            </div>
            <p className="text-lg font-extrabold">{branding.product_title}</p>
          </div>

          <h2 className="text-2xl font-bold tracking-tight">
            {t("login.signInTitle", { product: branding.product_title })}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("login.signInSubtitle")}</p>

          <p className="mt-4 rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm leading-relaxed text-muted-foreground">
            {t("login.intro")}
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="username">{t("login.username")}</Label>
              <Input id="username" autoComplete="username" autoFocus {...register("username")} />
              {errors.username && <p className="text-xs text-destructive">{errors.username.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">{t("login.password")}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  className="pr-10"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                  aria-label={showPw ? t("login.hidePassword") : t("login.showPassword")}
                >
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>

            {serverError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {serverError}
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Spinner />}
              {t("login.submit")}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">{t("login.hint")}</p>
        </div>
      </div>
    </div>
  );
}
