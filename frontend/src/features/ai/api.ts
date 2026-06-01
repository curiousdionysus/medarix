import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  AiAssistantResponse,
  AiSuggestionResponse,
  FormatReportResponse,
  TranscriptionResponse,
} from "@/types/api";

export function useTranscribe() {
  return useMutation({
    mutationFn: async (args: { blob: Blob; filename?: string; studyId?: string }) => {
      const form = new FormData();
      form.append("file", args.blob, args.filename ?? "dictation.webm");
      if (args.studyId) form.append("study_id", args.studyId);
      const { data } = await api.post<TranscriptionResponse>("/ai/transcribe", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
  });
}

export function useFormatReport() {
  return useMutation({
    mutationFn: async (args: {
      transcript: string;
      template?: string | null;
      recordingId?: string | null;
      studyId?: string | null;
    }) => {
      const { data } = await api.post<FormatReportResponse>("/ai/format-report", {
        transcript: args.transcript,
        template: args.template ?? null,
        recording_id: args.recordingId ?? null,
        study_id: args.studyId ?? null,
      });
      return data;
    },
  });
}

export interface AssistantMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export function useAiAssistant() {
  return useMutation({
    mutationFn: async (args: { messages: AssistantMessage[]; reportContext?: string }) => {
      const { data } = await api.post<AiAssistantResponse>("/ai/assistant", {
        messages: args.messages,
        report_context: args.reportContext ?? null,
      });
      return data;
    },
  });
}

export function useAiSuggestion() {
  return useMutation({
    mutationFn: async (args: { text: string; kind: string }) => {
      const { data } = await api.post<AiSuggestionResponse>("/ai/suggestions", {
        text: args.text,
        kind: args.kind,
      });
      return data;
    },
  });
}
