import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  DictationRecordingOut,
  ReportOut,
  ReportStatus,
  ReportTemplateOut,
  ReportVersionOut,
  StudyOut,
} from "@/types/api";

export interface StudyFilters {
  accession_number?: string;
  patient_tc?: string;
  first_name?: string;
  last_name?: string;
  from_date?: string;
  to_date?: string;
  from_time?: string;
  to_time?: string;
  modality?: string[];
  limit?: number;
  /** Only studies with a saved dictation report (content or transcript). */
  has_report?: boolean;
  /** Include linked-image status and PACS web viewer URL per study. */
  include_imaging?: boolean;
}

export function useStudies(filters: StudyFilters, enabled = true) {
  return useQuery({
    queryKey: ["studies", filters],
    enabled,
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v == null || v === "") return;
        if (typeof v === "boolean") {
          if (v) params.append(k, "true");
          return;
        }
        if (Array.isArray(v)) v.forEach((item) => params.append(k, item));
        else params.append(k, String(v));
      });
      const { data } = await api.get<StudyOut[]>(`/studies?${params.toString()}`);
      return data;
    },
  });
}

export function useStudy(studyId?: string) {
  return useQuery({
    queryKey: ["study", studyId],
    enabled: !!studyId,
    queryFn: async () => (await api.get<StudyOut>(`/studies/${studyId}`)).data,
  });
}

export function useStudyReport(studyId?: string) {
  return useQuery({
    queryKey: ["study-report", studyId],
    enabled: !!studyId,
    queryFn: async () => (await api.get<ReportOut | null>(`/studies/${studyId}/report`)).data,
  });
}

export function useSaveReport(studyId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { content: string; transcript?: string | null; status?: ReportStatus }) => {
      const { data } = await api.put<ReportOut>(`/studies/${studyId}/report`, {
        content: payload.content,
        transcript: payload.transcript ?? null,
        status: payload.status ?? "draft",
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["study-report", studyId] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
    },
  });
}

export function useSignReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reportId: string) =>
      (await api.post<ReportOut>(`/reports/${reportId}/sign`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["study-report"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
    },
  });
}

export interface PacsSendResult {
  report: ReportOut;
  pacs_status: Record<string, unknown> & { status: string; detail?: string };
}

export function useSendReportToPacs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reportId: string) =>
      (await api.post<PacsSendResult>(`/reports/${reportId}/send-to-pacs`, {})).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["study-report"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
    },
  });
}

export interface FinalizeReportResult {
  report: ReportOut;
  pacs_status: Record<string, unknown> | null;
}

export function useFinalizeReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reportId: string) =>
      (
        await api.post<FinalizeReportResult>(`/reports/${reportId}/finalize`, {
          user_acknowledged: true,
        })
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["study-report"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
    },
  });
}

export function useTemplates() {
  return useQuery({
    queryKey: ["report-templates"],
    queryFn: async () => (await api.get<ReportTemplateOut[]>("/report-templates")).data,
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { modality: string; title: string; content: string }) =>
      (await api.post<ReportTemplateOut>("/report-templates", payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["report-templates"] }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/report-templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["report-templates"] }),
  });
}

export function useReportVersions(reportId?: string) {
  return useQuery({
    queryKey: ["report-versions", reportId],
    enabled: !!reportId,
    queryFn: async () => (await api.get<ReportVersionOut[]>(`/reports/${reportId}/versions`)).data,
  });
}

export async function downloadReportPdf(payload: {
  content: string;
  patient_label?: string;
  accession_number?: string;
  modality?: string;
  study_date?: string;
  study_description?: string;
}) {
  const res = await api.post("/reports/pdf", payload, { responseType: "blob" });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rapor-${payload.accession_number || "medarix"}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function useRecordings(studyId?: string) {
  return useQuery({
    queryKey: ["recordings", studyId],
    queryFn: async () => {
      const params = studyId ? `?study_id=${studyId}` : "";
      return (await api.get<DictationRecordingOut[]>(`/recordings${params}`)).data;
    },
  });
}
