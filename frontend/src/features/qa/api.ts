import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ReportQAOut } from "@/types/api";

export function useValidateReportQA() {
  return useMutation({
    mutationFn: async (args: {
      transcript: string;
      report: string;
      reportId?: string;
      recordingId?: string;
      studyId?: string;
    }) => (await api.post<ReportQAOut>("/reports/validate", args)).data,
  });
}

export function useReportQA(reportId: string | undefined) {
  return useQuery({
    queryKey: ["report-qa", reportId],
    queryFn: async () => (await api.get<ReportQAOut>(`/reports/${reportId}/qa`)).data,
    enabled: !!reportId,
  });
}

export function useQASummary(days = 30) {
  return useQuery({
    queryKey: ["qa-summary", days],
    queryFn: async () =>
      (
        await api.get<{
          total_validations: number;
          average_score: number;
          low_risk: number;
          medium_risk: number;
          high_risk: number;
          critical_findings: number;
        }>(`/analytics/qa-summary?days=${days}`)
      ).data,
  });
}
