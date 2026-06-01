import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { PublicBranding } from "@/features/branding/types";

export function usePublicBranding() {
  return useQuery({
    queryKey: ["branding"],
    queryFn: async () => (await api.get<PublicBranding>("/branding")).data,
    staleTime: 60_000,
  });
}
