import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { LicenseInfo } from "@/types/api";
import { useAuth } from "@/features/auth/auth-context";

export function useLicenseInfo() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["license"],
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => (await api.get<LicenseInfo>("/license")).data,
  });
}

/** Whether the active license unlocks Enterprise features. Defaults to false while loading. */
export function useIsEnterprise(): boolean {
  const { data } = useLicenseInfo();
  return !!data?.is_enterprise;
}
