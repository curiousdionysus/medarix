import * as React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Stethoscope, Mic, FileText, ShieldCheck, Activity, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { apiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

const schema = z.object({
  username: z.string().min(1, "Kullanıcı adı gerekli"),
  password: z.string().min(1, "Parola gerekli"),
});
type FormValues = z.infer<typeof schema>;

function safeInternalPath(path: string | undefined): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return "/workspace/worklist";
  }
  return path;
}

const FEATURES = [
  { icon: Mic, title: "Rapor Diktasyonu", text: "Sesli raporlamayı saniyeler içinde yapılandırılmış metne dönüştürün." },
  { icon: FileText, title: "Akıllı Raporlama", text: "Şablonlar, sürüm geçmişi ve otomatik kaydetme." },
  { icon: Activity, title: "Enterprise Analitik", text: "İş yükü, dönüş süresi ve üretkenlik (Enterprise lisans)." },
  { icon: ShieldCheck, title: "Kurumsal Güvenlik", text: "RBAC, denetim kayıtları ve LDAP entegrasyonu." },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPw, setShowPw] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

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
      setServerError(apiErrorMessage(err, "Giriş başarısız"));
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
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
            <Stethoscope className="size-6" />
          </div>
          <div>
            <p className="text-lg font-extrabold tracking-tight">Medarix</p>
            <p className="text-xs text-sidebar-muted">
              AI-Powered Radiology Reporting & Clinical Intelligence Platform
            </p>
          </div>
        </div>

        <div className="relative space-y-8">
          <div>
            <h1 className="text-3xl font-bold leading-tight">
              Radyoloji raporlamasını
              <br />
              yapay zeka ile hızlandırın
            </h1>
            <p className="mt-3 max-w-md text-sidebar-foreground/80">
              Rapor dikasyonu, transkripsiyon, yapılandırılmış raporlama ve klinik dokümantasyon — Medarix
              Platform üzerinde.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <f.icon className="size-5 text-sidebar-accent" />
                <p className="mt-2 text-sm font-semibold">{f.title}</p>
                <p className="mt-0.5 text-xs text-sidebar-foreground/70">{f.text}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-sidebar-muted">
          © {new Date().getFullYear()} Medarix · HIPAA & KVKK uyumlu mimari
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Stethoscope className="size-5" />
            </div>
            <p className="text-lg font-extrabold">Medarix</p>
          </div>

          <h2 className="text-2xl font-bold tracking-tight">Medarix&apos;e giriş</h2>
          <p className="mt-1 text-sm text-muted-foreground">Devam etmek için hesabınıza giriş yapın.</p>

          <p className="mt-4 rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm leading-relaxed text-muted-foreground">
            Medarix, yapay zekâ destekli radyoloji raporlama platformudur. Tıbbi görüntüleri yapılandırılmış
            klinik raporlara dönüştürmek için geliştirilmiştir.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="username">Kullanıcı adı</Label>
              <Input id="username" autoComplete="username" autoFocus {...register("username")} />
              {errors.username && <p className="text-xs text-destructive">{errors.username.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Parola</Label>
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
                  aria-label={showPw ? "Parolayı gizle" : "Parolayı göster"}
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
              Giriş Yap
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Yerel veya kurumsal (LDAP) kimlik bilgilerinizi kullanın.
          </p>
        </div>
      </div>
    </div>
  );
}
