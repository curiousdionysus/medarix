import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  AdminGroupOut,
  AdminRoleCreate,
  AdminRoleOut,
  AdminRoleUpdate,
  AdminUserOut,
  AuditEvent,
  LicenseInfo,
  PermissionGroup,
  RoleSlug,
  SystemSettingsGroup,
} from "@/types/api";

export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => (await api.get<AdminUserOut[]>("/admin/users")).data,
  });
}

export function useAdminRoles() {
  return useQuery({
    queryKey: ["admin", "roles"],
    queryFn: async () => (await api.get<AdminRoleOut[]>("/admin/roles")).data,
  });
}

export function usePermissionCatalog() {
  return useQuery({
    queryKey: ["admin", "permissions"],
    queryFn: async () => (await api.get<PermissionGroup[]>("/admin/permissions")).data,
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AdminRoleCreate) =>
      (await api.post<AdminRoleOut>("/admin/roles", payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "roles"] }),
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: AdminRoleUpdate & { id: string }) =>
      (await api.patch<AdminRoleOut>(`/admin/roles/${id}`, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "roles"] }),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (roleId: string) => {
      await api.delete(`/admin/roles/${roleId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "roles"] }),
  });
}

export function useAdminGroups() {
  return useQuery({
    queryKey: ["admin", "groups"],
    queryFn: async () => (await api.get<AdminGroupOut[]>("/admin/groups")).data,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      username: string;
      password: string;
      display_name?: string;
      email?: string;
      roles: RoleSlug[];
      group_ids?: string[];
    }) => (await api.post<AdminUserOut>("/admin/users", payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; description?: string }) =>
      (await api.post<AdminGroupOut>("/admin/groups", payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "groups"] }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/admin/users/${userId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (groupId: string) => {
      await api.delete(`/admin/groups/${groupId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "groups"] }),
  });
}

export function useAuditEvents(limit = 100) {
  return useQuery({
    queryKey: ["admin", "audit", limit],
    queryFn: async () => (await api.get<AuditEvent[]>(`/admin/audit?limit=${limit}`)).data,
  });
}

export function useSystemSettings() {
  return useQuery({
    queryKey: ["admin", "system-settings"],
    queryFn: async () => (await api.get<SystemSettingsGroup[]>("/admin/system-settings")).data,
  });
}

export interface AuthVerifyResult {
  ok: boolean;
  mode: string;
  message: string;
  checks: { id: string; label: string; ok: boolean; detail?: string | null }[];
}

export function useListAdminTextModels() {
  return useMutation({
    mutationFn: async (baseUrl: string) =>
      (await api.get<{ models: string[] }>("/admin/ai/models/text", { params: { base_url: baseUrl } })).data,
  });
}

export function useListAdminTranscriptionModels() {
  return useMutation({
    mutationFn: async (baseUrl: string) =>
      (
        await api.get<{ models: string[] }>("/admin/ai/models/transcription", {
          params: { base_url: baseUrl },
        })
      ).data,
  });
}

export function useVerifyAuthSettings() {
  return useMutation({
    mutationFn: async (payload: {
      settings?: Record<string, string>;
      test_username?: string;
      test_password?: string;
    }) => (await api.post<AuthVerifyResult>("/admin/auth/verify", payload)).data,
  });
}

export function useUpdateSystemSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Record<string, string>) =>
      (await api.put("/admin/system-settings", { settings })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "system-settings"] });
      qc.invalidateQueries({ queryKey: ["branding"] });
    },
  });
}

export function useSecurityPosture() {
  return useQuery({
    queryKey: ["admin", "security"],
    queryFn: async () => (await api.get<Record<string, string>>("/admin/health/security")).data,
  });
}

export function useLicense() {
  return useQuery({
    queryKey: ["admin", "license"],
    queryFn: async () => (await api.get<LicenseInfo>("/admin/license")).data,
  });
}

export function useActivateLicense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (key: string) =>
      (await api.post<LicenseInfo>("/admin/license/activate", { key })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "license"] });
      qc.invalidateQueries({ queryKey: ["license"] });
    },
  });
}

export function useDeactivateLicense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post<LicenseInfo>("/admin/license/deactivate")).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "license"] });
      qc.invalidateQueries({ queryKey: ["license"] });
    },
  });
}

export function useIssueLicense() {
  return useMutation({
    mutationFn: async (payload: { licensed_to: string; seats?: number; valid_days?: number; edition?: string }) =>
      (await api.post<{ key: string; edition: string; expires_at: string }>("/admin/license/issue", payload)).data,
  });
}
