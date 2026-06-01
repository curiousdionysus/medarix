import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface PacsWorklistSyncRequest {
  from_date?: string;
  to_date?: string;
  modality?: string;
  patient_id?: string;
  accession_number?: string;
}

export interface PacsWorklistSyncResponse {
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export function useSyncPacsWorklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: PacsWorklistSyncRequest = {}) =>
      (await api.post<PacsWorklistSyncResponse>("/pacs/worklist/sync", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["studies"] });
    },
  });
}
