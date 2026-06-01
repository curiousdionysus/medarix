import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { PatientSummary, PatientTimelineEntry } from "@/types/api";

export function usePatients(search?: string) {
  return useQuery({
    queryKey: ["patients", search ?? ""],
    queryFn: async () => {
      const params = search ? `?search=${encodeURIComponent(search)}` : "";
      return (await api.get<PatientSummary[]>(`/patients${params}`)).data;
    },
  });
}

export function usePatientTimeline(patientId?: string) {
  return useQuery({
    queryKey: ["patient-timeline", patientId],
    enabled: !!patientId,
    queryFn: async () =>
      (await api.get<PatientTimelineEntry[]>(`/patients/${patientId}/timeline`)).data,
  });
}
