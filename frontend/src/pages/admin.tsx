import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ShieldCheck,
  Users,
  UsersRound,
  Shield,
  ScrollText,
  Settings2,
  Lock,
  Plus,
  CheckCircle2,
  ShieldCheck as ShieldVerify,
  Search,
  BadgeCheck,
  Sparkles,
  KeyRound,
  Rocket,
  Check,
  Copy,
  Trash2,
  List,
} from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { actionLabel, actionCategory } from "@/features/admin/audit-meta";
import {
  AI_CATEGORY,
  AI_TEXT_BASE_URL_KEY,
  AI_TEXT_MODEL_KEY,
  AI_TRANSCRIPTION_BASE_URL_KEY,
  AI_TRANSCRIPTION_MODEL_KEY,
  AUTH_CATEGORY,
  CATEGORY_TOGGLE_KEY,
  LDAP_SETTING_KEYS,
  MODULE_TOGGLE_KEYS,
  isSettingEnabled,
} from "@/features/admin/settings-meta";
import { Switch } from "@/components/ui/switch";
import {
  useAdminUsers,
  useAdminRoles,
  useAdminGroups,
  useCreateUser,
  useCreateGroup,
  useDeleteUser,
  useDeleteGroup,
  useAuditEvents,
  useSystemSettings,
  useUpdateSystemSettings,
  useVerifyAuthSettings,
  useListAdminTextModels,
  useListAdminTranscriptionModels,
  useSecurityPosture,
  useLicense,
  useActivateLicense,
  useDeactivateLicense,
  useIssueLicense,
} from "@/features/admin/api";
import { roleLabel } from "@/config/roles";
import { RolesTab } from "@/features/admin/roles-tab";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { apiErrorMessage } from "@/lib/api";
import { cn, formatDateTime, initials } from "@/lib/utils";
import type { RoleSlug } from "@/types/api";

const TABS = [
  { id: "users", label: "Kullanıcılar", icon: Users },
  { id: "groups", label: "Gruplar", icon: UsersRound },
  { id: "roles", label: "Roller", icon: Shield },
  { id: "license", label: "Lisans", icon: BadgeCheck },
  { id: "audit", label: "Denetim Kayıtları", icon: ScrollText },
  { id: "settings", label: "Sistem Ayarları", icon: Settings2 },
  { id: "security", label: "Güvenlik", icon: Lock },
] as const;

export default function AdminPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const active = location.pathname.split("/")[2] || "users";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Yönetim"
        description="Kullanıcılar, roller, denetim kayıtları ve sistem yapılandırması."
        icon={<ShieldCheck className="size-5" />}
      />

      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => navigate(`/admin/${t.id}`)}
            className={cn(
              "flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="size-4" />
            {t.label}
          </button>
        ))}
      </div>

      {active === "users" && <UsersTab />}
      {active === "groups" && <GroupsTab />}
      {active === "roles" && <RolesTab />}
      {active === "license" && <LicenseTab />}
      {active === "audit" && <AuditTab />}
      {active === "settings" && <SettingsTab />}
      {active === "security" && <SecurityTab />}
    </div>
  );
}

function UsersTab() {
  const { user: currentUser } = useAuth();
  const { data, isLoading } = useAdminUsers();
  const { data: roles } = useAdminRoles();
  const create = useCreateUser();
  const remove = useDeleteUser();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ username: "", password: "", display_name: "", email: "", roles: ["viewer"] as RoleSlug[] });

  const handleDeleteUser = async (u: { id: string; username: string; display_name?: string | null }) => {
    const label = u.display_name || u.username;
    if (!window.confirm(`"${label}" kullanıcısını kalıcı olarak silmek istediğinize emin misiniz?`)) return;
    try {
      await remove.mutateAsync(u.id);
      toast.success("Kullanıcı silindi");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Kullanıcı silinemedi"));
    }
  };

  const toggleRole = (r: RoleSlug) =>
    setForm((f) => ({ ...f, roles: f.roles.includes(r) ? f.roles.filter((x) => x !== r) : [...f.roles, r] }));

  const submit = async () => {
    if (!form.username.trim() || !form.password) {
      toast.warning("Kullanıcı adı ve parola gerekli");
      return;
    }
    try {
      await create.mutateAsync(form);
      toast.success("Kullanıcı oluşturuldu");
      setOpen(false);
      setForm({ username: "", password: "", display_name: "", email: "", roles: ["viewer"] });
    } catch (err) {
      toast.error(apiErrorMessage(err, "Kullanıcı oluşturulamadı"));
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Kullanıcılar</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus /> Yeni Kullanıcı
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Yeni Kullanıcı</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Kullanıcı adı</Label>
                  <Input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Parola</Label>
                  <Input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Ad Soyad</Label>
                <Input value={form.display_name} onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>E-posta</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Roller</Label>
                <div className="flex flex-wrap gap-2">
                  {roles?.map((r) => (
                    <button
                      key={r.slug}
                      type="button"
                      onClick={() => toggleRole(r.slug)}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors",
                        form.roles.includes(r.slug)
                          ? "bg-primary text-primary-foreground ring-primary"
                          : "bg-card text-muted-foreground ring-border hover:bg-secondary",
                      )}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>İptal</Button>
              <Button onClick={submit} disabled={create.isPending}>Oluştur</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kullanıcı</TableHead>
                <TableHead>Roller</TableHead>
                <TableHead>Sağlayıcı</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-8">
                        <AvatarFallback className="text-[11px]">{initials(u.display_name || u.username)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{u.display_name || u.username}</p>
                        <p className="text-xs text-muted-foreground">{u.email || u.username}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <Badge key={r} variant="secondary">{roleLabel(r)}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="muted">{u.auth_provider}</Badge></TableCell>
                  <TableCell>
                    {u.is_active ? <Badge variant="success">Aktif</Badge> : <Badge variant="destructive">Pasif</Badge>}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      disabled={remove.isPending || u.id === currentUser?.id}
                      title={u.id === currentUser?.id ? "Kendi hesabınızı silemezsiniz" : "Kullanıcıyı sil"}
                      onClick={() => handleDeleteUser(u)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function GroupsTab() {
  const { data, isLoading } = useAdminGroups();
  const create = useCreateGroup();
  const remove = useDeleteGroup();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", description: "" });

  const handleDeleteGroup = async (g: { id: string; name: string }) => {
    if (!window.confirm(`"${g.name}" grubunu silmek istediğinize emin misiniz?`)) return;
    try {
      await remove.mutateAsync(g.id);
      toast.success("Grup silindi");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Grup silinemedi"));
    }
  };

  const submit = async () => {
    if (!form.name.trim()) return;
    try {
      await create.mutateAsync(form);
      toast.success("Grup oluşturuldu");
      setOpen(false);
      setForm({ name: "", description: "" });
    } catch (err) {
      toast.error(apiErrorMessage(err, "Grup oluşturulamadı"));
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Gruplar</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus /> Yeni Grup</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Yeni Grup</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Grup adı</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Açıklama</Label>
                <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>İptal</Button>
              <Button onClick={submit} disabled={create.isPending}>Oluştur</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : data?.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.map((g) => (
              <div key={g.id} className="flex items-start justify-between gap-2 rounded-lg border border-border p-4">
                <div className="min-w-0">
                  <p className="font-semibold">{g.name}</p>
                  <p className="text-sm text-muted-foreground">{g.description || "Açıklama yok"}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  disabled={remove.isPending}
                  title="Grubu sil"
                  onClick={() => handleDeleteGroup(g)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState className="border-0" icon={UsersRound} title="Grup yok" description="Henüz grup oluşturulmadı." />
        )}
      </CardContent>
    </Card>
  );
}

function LicenseTab() {
  const { data: license, isLoading } = useLicense();
  const activate = useActivateLicense();
  const deactivate = useDeactivateLicense();
  const issue = useIssueLicense();
  const [key, setKey] = React.useState("");
  const [copied, setCopied] = React.useState(false);

  const isEnterprise = license?.is_enterprise;

  const handleActivate = async () => {
    if (!key.trim()) {
      toast.warning("Lütfen bir lisans anahtarı girin");
      return;
    }
    try {
      const res = await activate.mutateAsync(key.trim());
      if (res.is_enterprise) {
        toast.success("Enterprise sürüm etkinleştirildi");
        setKey("");
      } else {
        toast.message("Lisans uygulandı", { description: `Sürüm: ${res.edition}` });
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, "Lisans etkinleştirilemedi"));
    }
  };

  const handleDeactivate = async () => {
    try {
      await deactivate.mutateAsync();
      toast.success("Standart sürüme geçildi");
    } catch (err) {
      toast.error(apiErrorMessage(err, "İşlem başarısız"));
    }
  };

  const handleIssueDemo = async () => {
    try {
      const res = await issue.mutateAsync({ licensed_to: "Medarix Kurumsal", seats: 0, valid_days: 365 });
      setKey(res.key);
      toast.success("Demo Enterprise anahtarı oluşturuldu, etkinleştirebilirsiniz");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Anahtar oluşturulamadı"));
    }
  };

  const copyKey = async () => {
    await navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-4">
      {/* Current edition banner */}
      <Card
        className={cn(
          "overflow-hidden border",
          isEnterprise ? "border-primary/40 bg-primary/5" : "border-border",
        )}
      >
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "flex size-12 items-center justify-center rounded-xl",
                isEnterprise ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
              )}
            >
              {isEnterprise ? <Rocket className="size-6" /> : <BadgeCheck className="size-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold">Medarix {isEnterprise ? "Enterprise" : "Standard"}</h3>
                {isEnterprise ? (
                  <Badge variant="success">Etkin</Badge>
                ) : (
                  <Badge variant="muted">Standart Sürüm</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {isEnterprise
                  ? `Lisans sahibi: ${license?.licensed_to || "—"}`
                  : "Tüm kurumsal özellikleri açmak için bir Enterprise lisansı etkinleştirin."}
              </p>
            </div>
          </div>
          {isEnterprise && (
            <Button variant="outline" size="sm" onClick={handleDeactivate} disabled={deactivate.isPending}>
              Standart Sürüme Dön
            </Button>
          )}
        </CardContent>
      </Card>

      {isEnterprise && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <InfoCard label="Lisans Sahibi" value={license?.licensed_to || "—"} />
          <InfoCard label="Koltuk" value={license?.seats ? license.seats : "Sınırsız"} />
          <InfoCard
            label="Son Kullanma"
            value={license?.expires_at ? formatDateTime(license.expires_at) : "Süresiz"}
          />
          <InfoCard
            label="Etkinleştirme"
            value={license?.activated_at ? formatDateTime(license.activated_at) : "—"}
          />
        </div>
      )}

      {/* Feature comparison */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BadgeCheck className="size-4 text-muted-foreground" /> Standart
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {license?.standard_features.map((f) => (
              <FeatureRow key={f.key} label={f.label} enabled />
            ))}
          </CardContent>
        </Card>

        <Card className={cn(isEnterprise ? "border-primary/40" : undefined)}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-primary" /> Enterprise
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {license?.enterprise_features.map((f) => (
              <FeatureRow key={f.key} label={f.label} enabled={!!isEnterprise} />
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Activation */}
      {!isEnterprise && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="size-4 text-primary" /> Enterprise Lisansını Etkinleştir
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="license-key">Lisans Anahtarı</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="license-key"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="Lisans anahtarınızı yapıştırın…"
                  className="font-mono text-xs"
                />
                {key && (
                  <Button variant="outline" size="icon" onClick={copyKey} aria-label="Kopyala">
                    {copied ? <Check /> : <Copy />}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Lisans anahtarınız yoksa kurumsal satış ekibiyle iletişime geçin.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={handleActivate} disabled={activate.isPending || !key.trim()}>
                <Rocket /> Enterprise'a Yükselt
              </Button>
              <Button variant="ghost" size="sm" onClick={handleIssueDemo} disabled={issue.isPending}>
                <Sparkles /> Demo anahtarı oluştur
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}

function FeatureRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full",
          enabled ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
        )}
      >
        {enabled ? <Check className="size-3.5" /> : <Lock className="size-3" />}
      </span>
      <span className={cn(!enabled && "text-muted-foreground")}>{label}</span>
    </div>
  );
}

function AuditTab() {
  const { data, isLoading } = useAuditEvents(300);
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const events = data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) => {
      const cat = actionCategory(e.action).label;
      const haystack = [
        e.actor_username,
        e.actor_display_name,
        e.action,
        actionLabel(e.action),
        cat,
        e.resource_type,
        e.resource_id,
        e.ip_address,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [data, query]);

  return (
    <Card>
      <CardHeader className="flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Denetim Kayıtları</CardTitle>
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kullanıcı, eylem, IP, kaynak ara…"
            className="pl-9"
          />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : filtered.length ? (
          <>
            <div className="max-h-[calc(100vh-22rem)] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead>Zaman</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Eylem</TableHead>
                    <TableHead>Kullanıcı</TableHead>
                    <TableHead>Kaynak</TableHead>
                    <TableHead>IP Adresi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((e) => {
                    const cat = actionCategory(e.action);
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDateTime(e.occurred_at)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={cat.variant}>{cat.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{actionLabel(e.action)}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">{e.action}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {e.actor_username ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="size-7">
                                <AvatarFallback className="text-[10px]">
                                  {initials(e.actor_display_name || e.actor_username)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">{e.actor_display_name || e.actor_username}</span>
                                <span className="text-[11px] text-muted-foreground">@{e.actor_username}</span>
                              </div>
                            </div>
                          ) : (
                            <Badge variant="muted">Sistem</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex flex-col">
                            <span>{e.resource_type}</span>
                            {e.resource_id && (
                              <span className="max-w-40 truncate font-mono text-[10px] text-muted-foreground">
                                {e.resource_id}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{e.ip_address || "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {query
                ? `${filtered.length} / ${data?.length ?? 0} kayıt eşleşti`
                : `${filtered.length} kayıt gösteriliyor`}
            </p>
          </>
        ) : (
          <EmptyState
            className="border-0"
            icon={ScrollText}
            title={query ? "Eşleşen kayıt yok" : "Kayıt yok"}
            description={query ? "Arama kriterlerinizi değiştirin." : "Henüz denetim olayı bulunmuyor."}
          />
        )}
      </CardContent>
    </Card>
  );
}

function SettingsTab() {
  const { data, isLoading } = useSystemSettings();
  const update = useUpdateSystemSettings();
  const verifyAuth = useVerifyAuthSettings();
  const listTextModels = useListAdminTextModels();
  const listTranscriptionModels = useListAdminTranscriptionModels();
  const [draft, setDraft] = React.useState<Record<string, string>>({});
  const [textModelsList, setTextModelsList] = React.useState<string[] | null>(null);
  const [transcriptionModelsList, setTranscriptionModelsList] = React.useState<string[] | null>(null);
  const [testUsername, setTestUsername] = React.useState("");
  const [testPassword, setTestPassword] = React.useState("");
  const [verifyResult, setVerifyResult] = React.useState<{
    ok: boolean;
    message: string;
    checks: { id: string; label: string; ok: boolean; detail?: string | null }[];
  } | null>(null);

  const valueOf = React.useCallback(
    (key: string, serverValue: string) => (key in draft ? draft[key] : serverValue),
    [draft],
  );

  const setValue = (key: string, value: string) => setDraft((d) => ({ ...d, [key]: value }));

  const authSettingsPayload = React.useCallback(
    (group: NonNullable<typeof data>[number]) => {
      const payload: Record<string, string> = {};
      for (const key of LDAP_SETTING_KEYS) {
        const setting = group.settings.find((s) => s.key === key);
        if (setting) payload[key] = valueOf(key, setting.value);
      }
      return payload;
    },
    [valueOf],
  );

  const settingValue = (group: NonNullable<typeof data>[number], key: string) => {
    const row = group.settings.find((s) => s.key === key);
    return valueOf(key, row?.value ?? "");
  };

  const fetchTextModels = async (group: NonNullable<typeof data>[number]) => {
    const baseUrl = settingValue(group, AI_TEXT_BASE_URL_KEY).trim();
    if (!baseUrl) {
      toast.warning("Önce dil modeli sunucusu adresini girin");
      return;
    }
    setTextModelsList(null);
    try {
      const res = await listTextModels.mutateAsync(baseUrl);
      setTextModelsList(res.models);
      if (res.models.length === 0) toast.info("Sunucuda yüklü dil modeli bulunamadı");
      else toast.success(`${res.models.length} dil modeli listelendi`);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Dil modelleri alınamadı"));
    }
  };

  const fetchTranscriptionModels = async (group: NonNullable<typeof data>[number]) => {
    const baseUrl = settingValue(group, AI_TRANSCRIPTION_BASE_URL_KEY).trim();
    if (!baseUrl) {
      toast.warning("Önce transkripsiyon sunucusu adresini girin");
      return;
    }
    setTranscriptionModelsList(null);
    try {
      const res = await listTranscriptionModels.mutateAsync(baseUrl);
      setTranscriptionModelsList(res.models);
      if (res.models.length === 0) toast.info("Sunucuda yüklü transkripsiyon modeli bulunamadı");
      else toast.success(`${res.models.length} transkripsiyon modeli listelendi`);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Transkripsiyon modelleri alınamadı"));
    }
  };

  const runAuthVerify = async (group: NonNullable<typeof data>[number]) => {
    setVerifyResult(null);
    try {
      const result = await verifyAuth.mutateAsync({
        settings: authSettingsPayload(group),
        test_username: testUsername.trim() || undefined,
        test_password: testPassword || undefined,
      });
      setVerifyResult(result);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Doğrulama başarısız"));
    }
  };

  const save = async () => {
    if (Object.keys(draft).length === 0) {
      toast.info("Değişiklik yok");
      return;
    }
    try {
      await update.mutateAsync(draft);
      toast.success("Ayarlar kaydedildi");
      setDraft({});
    } catch (err) {
      toast.error(apiErrorMessage(err, "Ayarlar kaydedilemedi"));
    }
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-4">
      {data?.map((group) => {
        const toggleKey = CATEGORY_TOGGLE_KEY[group.category];
        const toggleSetting = toggleKey ? group.settings.find((s) => s.key === toggleKey) : undefined;
        const fieldSettings = group.settings.filter((s) => !MODULE_TOGGLE_KEYS.has(s.key));
        const moduleEnabled = toggleKey
          ? isSettingEnabled(valueOf(toggleKey, toggleSetting?.value ?? "false"))
          : true;
        const isAuthCategory = group.category === AUTH_CATEGORY;
        const isAiCategory = group.category === AI_CATEGORY;
        const fieldsDisabled = toggleKey ? !moduleEnabled : false;

        return (
          <Card key={group.category}>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-4 space-y-0">
              <CardTitle className="text-base">{group.category}</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                {isAuthCategory && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={verifyAuth.isPending}
                    onClick={() => runAuthVerify(group)}
                  >
                    <ShieldVerify className="size-4" />
                    {verifyAuth.isPending ? "Doğrulanıyor…" : "Bağlantıyı Doğrula"}
                  </Button>
                )}
                {toggleKey && (
                  <div className="flex items-center gap-3">
                    <Badge variant={moduleEnabled ? "success" : "muted"}>
                      {moduleEnabled ? "Aktif" : "Pasif"}
                    </Badge>
                    <Switch
                      checked={moduleEnabled}
                      onCheckedChange={(checked) => setValue(toggleKey, checked ? "true" : "false")}
                      aria-label={`${group.category} modülünü aç/kapat`}
                    />
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent
              className={cn(
                "space-y-3 transition-opacity",
                toggleKey && !moduleEnabled && "pointer-events-none opacity-45",
              )}
            >
              {fieldSettings.map((s) => {
                const showTextModelList = isAiCategory && s.key === AI_TEXT_MODEL_KEY;
                const showTranscriptionModelList = isAiCategory && s.key === AI_TRANSCRIPTION_MODEL_KEY;
                const modelsList = showTextModelList
                  ? textModelsList
                  : showTranscriptionModelList
                    ? transcriptionModelsList
                    : null;

                return (
                  <div key={s.key} className="space-y-2">
                    <div className="grid gap-1.5 sm:grid-cols-[1fr_1.4fr] sm:items-center">
                      <div>
                        <Label htmlFor={s.key}>{s.label}</Label>
                        {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                      </div>
                      {showTextModelList || showTranscriptionModelList ? (
                        <div className="flex gap-2">
                          <Input
                            id={s.key}
                            className="min-w-0 flex-1"
                            value={valueOf(s.key, s.value)}
                            disabled={fieldsDisabled}
                            onChange={(e) => setValue(s.key, e.target.value)}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            disabled={
                              fieldsDisabled ||
                              (showTextModelList ? listTextModels.isPending : listTranscriptionModels.isPending)
                            }
                            onClick={() =>
                              showTextModelList ? fetchTextModels(group) : fetchTranscriptionModels(group)
                            }
                          >
                            <List className="size-4" />
                            {showTextModelList
                              ? listTextModels.isPending
                                ? "…"
                                : "Listele"
                              : listTranscriptionModels.isPending
                                ? "…"
                                : "Listele"}
                          </Button>
                        </div>
                      ) : (
                        <Input
                          id={s.key}
                          type={s.is_secret ? "password" : "text"}
                          value={valueOf(s.key, s.value)}
                          disabled={fieldsDisabled}
                          onChange={(e) => setValue(s.key, e.target.value)}
                        />
                      )}
                    </div>
                    {modelsList && modelsList.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 sm:ml-[calc(100%*1/2.4)] sm:pl-0">
                        {modelsList.map((modelId) => (
                          <button
                            key={modelId}
                            type="button"
                            disabled={fieldsDisabled}
                            onClick={() => {
                              setValue(s.key, modelId);
                              toast.message("Model seçildi", { description: modelId });
                            }}
                            className={cn(
                              "rounded-md border px-2 py-1 font-mono text-xs transition-colors",
                              valueOf(s.key, s.value) === modelId
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-secondary/50 hover:bg-secondary",
                            )}
                          >
                            {modelId}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {isAuthCategory && moduleEnabled && (
                <div className="mt-2 space-y-3 rounded-lg border border-dashed border-border p-4">
                  <p className="text-sm font-medium">İsteğe bağlı: tam giriş testi</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="ldap-test-user">Test kullanıcı adı</Label>
                      <Input
                        id="ldap-test-user"
                        value={testUsername}
                        onChange={(e) => setTestUsername(e.target.value)}
                        placeholder="sAMAccountName"
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ldap-test-pass">Test parolası</Label>
                      <Input
                        id="ldap-test-pass"
                        type="password"
                        value={testPassword}
                        onChange={(e) => setTestPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                </div>
              )}

              {isAuthCategory && verifyResult && (
                <div
                  className={cn(
                    "rounded-lg border p-3 text-sm",
                    verifyResult.ok ? "border-primary/30 bg-primary/5" : "border-destructive/40 bg-destructive/5",
                  )}
                >
                  <p className="font-medium">{verifyResult.message}</p>
                  <ul className="mt-2 space-y-1">
                    {verifyResult.checks.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-baseline gap-2 text-xs">
                        <Badge variant={c.ok ? "success" : "destructive"} className="shrink-0">
                          {c.ok ? "OK" : "Hata"}
                        </Badge>
                        <span className="font-medium">{c.label}</span>
                        {c.detail && <span className="text-muted-foreground">{c.detail}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
      <div className="flex justify-end">
        <Button onClick={save} disabled={update.isPending || Object.keys(draft).length === 0}>
          <CheckCircle2 /> Değişiklikleri Kaydet
        </Button>
      </div>
    </div>
  );
}

function SecurityTab() {
  const { data, isLoading } = useSecurityPosture();
  const LABELS: Record<string, string> = {
    audit: "Denetim Kaydı",
    auth: "Kimlik Doğrulama",
    rbac: "Yetkilendirme (RBAC)",
    secrets: "Sır Yönetimi",
    transport: "Taşıma Güvenliği",
  };
  return (
    <Card>
      <CardHeader><CardTitle>Güvenlik Durumu</CardTitle></CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
          : data &&
            Object.entries(data).map(([k, v]) => (
              <div key={k} className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/5 p-3">
                <Lock className="mt-0.5 size-4 text-success" />
                <div>
                  <p className="text-sm font-semibold">{LABELS[k] ?? k}</p>
                  <p className="font-mono text-xs text-muted-foreground">{v}</p>
                </div>
              </div>
            ))}
      </CardContent>
    </Card>
  );
}
