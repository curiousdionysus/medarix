import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AnalyticsKpis, DashboardMetrics, ProductivityRow, TrendPoint } from "@/types/api";

export function useDashboard() {
  return useQuery({
    queryKey: ["analytics", "dashboard"],
    queryFn: async () => (await api.get<DashboardMetrics>("/analytics/dashboard")).data,
    refetchInterval: 60_000,
  });
}

export function useKpis(days = 30) {
  return useQuery({
    queryKey: ["analytics", "kpis", days],
    queryFn: async () => (await api.get<AnalyticsKpis>("/analytics/kpis", { params: { days } })).data,
  });
}

export function useProductivity(days = 30) {
  return useQuery({
    queryKey: ["analytics", "productivity", days],
    queryFn: async () =>
      (await api.get<ProductivityRow[]>("/analytics/productivity", { params: { days } })).data,
  });
}

export function useTrends(days = 14) {
  return useQuery({
    queryKey: ["analytics", "trends", days],
    queryFn: async () => (await api.get<TrendPoint[]>("/analytics/trends", { params: { days } })).data,
  });
}
