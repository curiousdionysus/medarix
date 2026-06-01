import * as React from "react";
import { toast } from "sonner";
import { Plus, Shield, Trash2, Lock } from "lucide-react";
import {
  useAdminRoles,
  useCreateRole,
  useDeleteRole,
  usePermissionCatalog,
  useUpdateRole,
} from "@/features/admin/api";
import { useApiError } from "@/features/i18n/helpers";
import { useT } from "@/features/i18n/locale-context";
import { cn } from "@/lib/utils";
import type { AdminRoleOut, PermissionGroup } from "@/types/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const BUILTIN_ORDER = ["admin", "radiologist", "reporter", "viewer", "technician", "external_consultant"];

function sortRoles(roles: AdminRoleOut[]): AdminRoleOut[] {
  return [...roles].sort((a, b) => {
    const ai = BUILTIN_ORDER.indexOf(a.slug);
    const bi = BUILTIN_ORDER.indexOf(b.slug);
    if (a.is_builtin && b.is_builtin) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    if (a.is_builtin) return -1;
    if (b.is_builtin) return 1;
    return a.label.localeCompare(b.label, "tr");
  });
}

function PermissionMatrix({
  catalog,
  selected,
  onChange,
  disabled,
}: {
  catalog: PermissionGroup[] | undefined;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  disabled?: boolean;
}) {
  const toggle = (key: string, checked: boolean) => {
    const next = new Set(selected);
    if (key === "*") {
      onChange(checked ? new Set(["*"]) : new Set());
      return;
    }
    next.delete("*");
    if (checked) next.add(key);
    else next.delete(key);
    onChange(next);
  };

  if (!catalog?.length) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="max-h-[min(420px,50vh)] space-y-4 overflow-y-auto pr-1">
      {catalog.map((group) => (
        <div key={group.key} className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {group.permissions.map((p) => {
              const on = selected.has("*") || selected.has(p.key);
              return (
                <button
                  key={p.key}
                  type="button"
                  disabled={disabled || selected.has("*")}
                  onClick={() => toggle(p.key, !on)}
                  className={cn(
                    "rounded-lg border p-2.5 text-left text-sm transition-colors",
                    on ? "border-primary bg-primary/10" : "border-border hover:bg-secondary",
                    disabled && "cursor-not-allowed opacity-60",
                  )}
                >
                  <span className="font-medium">{p.label}</span>
                  <span className="block text-xs text-muted-foreground">{p.description}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function RolesTab() {
  const t = useT();
  const apiErr = useApiError();
  const { data: roles, isLoading } = useAdminRoles();
  const { data: catalog } = usePermissionCatalog();
  const create = useCreateRole();
  const update = useUpdateRole();
  const remove = useDeleteRole();

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editRole, setEditRole] = React.useState<AdminRoleOut | null>(null);
  const [formLabel, setFormLabel] = React.useState("");
  const [formDesc, setFormDesc] = React.useState("");
  const [formPerms, setFormPerms] = React.useState<Set<string>>(new Set());

  const openCreate = () => {
    setFormLabel("");
    setFormDesc("");
    setFormPerms(new Set(["study:read", "report:read"]));
    setCreateOpen(true);
  };

  const openEdit = (role: AdminRoleOut) => {
    setEditRole(role);
    setFormLabel(role.label);
    setFormDesc(role.description ?? "");
    setFormPerms(new Set(role.permissions));
  };

  const submitCreate = async () => {
    if (!formLabel.trim()) {
      toast.warning(t("roles.roleNameRequired"));
      return;
    }
    if (formPerms.size === 0) {
      toast.warning(t("roles.permissionRequired"));
      return;
    }
    try {
      await create.mutateAsync({
        label: formLabel.trim(),
        description: formDesc.trim() || undefined,
        permissions: [...formPerms],
      });
      toast.success(t("roles.roleCreated"));
      setCreateOpen(false);
    } catch (err) {
      toast.error(apiErr(err, "roles.roleCreateFail"));
    }
  };

  const submitEdit = async () => {
    if (!editRole) return;
    try {
      await update.mutateAsync({
        id: editRole.id,
        label: formLabel.trim(),
        description: formDesc.trim() || undefined,
        permissions: [...formPerms],
      });
      toast.success(t("roles.roleUpdated"));
      setEditRole(null);
    } catch (err) {
      toast.error(apiErr(err, "roles.roleUpdateFail"));
    }
  };

  const handleDelete = async (role: AdminRoleOut) => {
    if (!window.confirm(t("roles.deleteRoleConfirm", { name: role.label }))) return;
    try {
      await remove.mutateAsync(role.id);
      toast.success(t("roles.roleDeleted"));
    } catch (err) {
      toast.error(apiErr(err, "roles.roleDeleteFail"));
    }
  };

  const sorted = sortRoles(roles ?? []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="size-5" /> {t("roles.tabTitle")}
            </CardTitle>
            <CardDescription>{t("roles.tabDesc")}</CardDescription>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openCreate}>
                <Plus /> {t("roles.customRole")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{t("roles.newCustomRole")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>{t("roles.roleName")}</Label>
                  <Input
                    value={formLabel}
                    onChange={(e) => setFormLabel(e.target.value)}
                    placeholder={t("roles.placeholderLabel")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("admin.groupDesc")}</Label>
                  <Input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
                </div>
                <Label>{t("roles.permissions")}</Label>
                <PermissionMatrix catalog={catalog} selected={formPerms} onChange={setFormPerms} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button onClick={submitCreate} disabled={create.isPending}>
                  {t("admin.create")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {sorted.map((role) => (
                <div
                  key={role.id}
                  className={cn(
                    "flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between",
                    role.is_builtin ? "border-primary/25 bg-primary/5" : "border-border",
                  )}
                >
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{role.label}</p>
                      <Badge variant="muted" className="font-mono text-[10px]">
                        {role.slug}
                      </Badge>
                      {role.is_builtin ? (
                        <Badge variant="secondary">
                          <Lock className="size-3" /> {t("roles.builtin")}
                        </Badge>
                      ) : (
                        <Badge variant="outline">{t("roles.custom")}</Badge>
                      )}
                      <Badge variant="muted">{t("roles.usersCount", { count: String(role.user_count) })}</Badge>
                    </div>
                    {role.description && <p className="text-sm text-muted-foreground">{role.description}</p>}
                    <div className="flex flex-wrap gap-1">
                      {(role.permissions.includes("*") ? ["*"] : role.permissions).slice(0, 12).map((p) => (
                        <Badge key={p} variant="secondary" className="font-mono text-[10px]">
                          {p}
                        </Badge>
                      ))}
                      {role.permissions.length > 12 && (
                        <Badge variant="muted">+{role.permissions.length - 12}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {!role.is_builtin && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => openEdit(role)}>
                          {t("common.edit")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-destructive"
                          disabled={remove.isPending}
                          onClick={() => handleDelete(role)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editRole} onOpenChange={(o) => !o && setEditRole(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("roles.editRole", { name: editRole?.label ?? "" })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t("roles.roleName")}</Label>
              <Input value={formLabel} onChange={(e) => setFormLabel(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("admin.groupDesc")}</Label>
              <Input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
            </div>
            <Label>{t("roles.permissions")}</Label>
            <PermissionMatrix catalog={catalog} selected={formPerms} onChange={setFormPerms} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRole(null)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={submitEdit} disabled={update.isPending}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
