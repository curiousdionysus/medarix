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
      const name = args.filename ?? "dictation.webm";
      const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")).toLowerCase() : "";
      const extMime: Record<string, string> = {
        ".mp4": "video/mp4",
        ".m4a": "audio/mp4",
        ".webm": "audio/webm",
        ".wav": "audio/wav",
        ".mp3": "audio/mpeg",
        ".mpeg": "audio/mpeg",
        ".ogg": "audio/ogg",
        ".flac": "audio/flac",
        ".aac": "audio/aac",
        ".opus": "audio/ogg",
      };
      const mime =
        args.blob.type && args.blob.type !== "application/octet-stream"
          ? args.blob.type.split(";")[0]
          : extMime[ext] ?? "audio/webm";
      form.append("file", new File([args.blob], name, { type: mime }));
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
