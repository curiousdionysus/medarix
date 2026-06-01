import * as React from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { toast } from "sonner";
import {
  Mic,
  Square,
  Pause,
  Play,
  RotateCcw,
  Wand2,
  FileText,
  Maximize2,
  Minimize2,
  Settings2,
  Sparkles,
  AlertCircle,
  Trash2,
  ListChecks,
  Save,
  Upload,
} from "lucide-react";
import {
  clearLinkedStudyId,
  getLinkedStudyId,
  setLinkedStudyId,
} from "@/features/dictation/linked-study-storage";
import { useRecorder } from "@/features/dictation/use-recorder";
import { Waveform } from "@/features/dictation/waveform";
import { PlaybackTransport } from "@/features/dictation/playback";
import { countMedicalTerms } from "@/features/dictation/medical-terms";
import { useTranscribe, useFormatReport } from "@/features/ai/api";
import { useTemplates, useStudy, useSaveReport } from "@/features/studies/api";
import type { StudyOut } from "@/types/api";
import { PageHeader } from "@/components/shared/page-header";
import { AiConfidenceChip } from "@/components/shared/ai-confidence";
import { ModalityBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useApiError } from "@/features/i18n/helpers";
import { useT } from "@/features/i18n/locale-context";
import { cn, formatDate } from "@/lib/utils";

function fmtTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function DictationPage() {
  const t = useT();
  const apiErr = useApiError();
  const recorder = useRecorder();
  const transcribe = useTranscribe();
  const format = useFormatReport();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: templates } = useTemplates();

  const linkedStudyId = searchParams.get("studyId") ?? getLinkedStudyId() ?? undefined;
  const passedStudy = (location.state as { study?: StudyOut } | null)?.study;
  const { data: fetchedStudy } = useStudy(passedStudy ? undefined : linkedStudyId);

  const [study, setStudy] = React.useState<StudyOut | null>(passedStudy ?? null);
  const [transcript, setTranscript] = React.useState("");
  const [report, setReport] = React.useState("");
  const [templateId, setTemplateId] = React.useState<string>("none");
  const [focusMode, setFocusMode] = React.useState(false);
  const saveReport = useSaveReport(study?.id);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Auto-link from worklist, ?studyId=, or persisted local storage until user clears.
  const appliedStudyRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (appliedStudyRef.current === "__cleared__") return;
    const incoming = passedStudy ?? (linkedStudyId ? fetchedStudy : undefined);
    if (!incoming || appliedStudyRef.current === incoming.id) return;
    appliedStudyRef.current = incoming.id;
    setStudy(incoming);
    setLinkedStudyId(incoming.id);
    if (searchParams.get("studyId") !== incoming.id) {
      const next = new URLSearchParams(searchParams);
      next.set("studyId", incoming.id);
      setSearchParams(next, { replace: true });
    }
    if (passedStudy) {
      toast.success(
        t("dictation.studyLinked", { name: incoming.patient_name || t("dictation.studyLinkedDefault") }),
      );
    }
  }, [passedStudy, fetchedStudy, linkedStudyId, searchParams, setSearchParams, t]);

  const clearLinkedStudy = () => {
    setStudy(null);
    appliedStudyRef.current = "__cleared__";
    clearLinkedStudyId();
    if (searchParams.get("studyId")) {
      const next = new URLSearchParams(searchParams);
      next.delete("studyId");
      setSearchParams(next, { replace: true });
    }
  };

  const recording = recorder.status === "recording";
  const paused = recorder.status === "paused";
  const hasAudio = recorder.status === "stopped" && !!recorder.blob;

  const confidence = React.useMemo(() => {
    if (!transcript) return 0;
    const words = transcript.trim().split(/\s+/).length;
    const terms = countMedicalTerms(transcript);
    return Math.max(0.55, Math.min(0.98, 0.6 + terms * 0.04 + Math.min(words, 60) / 300));
  }, [transcript]);

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const ok = await recorder.loadFile(file);
    if (ok) {
      toast.success(t("dictation.fileUploaded", { name: file.name }));
    }
  };

  const handleTranscribe = async () => {
    if (!recorder.blob) return;
    try {
      const res = await transcribe.mutateAsync({
        blob: recorder.blob,
        filename: recorder.sourceFilename ?? "dictation.webm",
        studyId: study?.id,
      });
      setTranscript((prev) => (prev ? `${prev}\n${res.text}` : res.text));
      toast.success(t("dictation.transcribeSuccess"));
    } catch (err) {
      toast.error(apiErr(err, "dictation.transcribeFail"));
    }
  };

  const handleFormat = async () => {
    if (!transcript.trim()) {
      toast.warning(t("dictation.formatNeedTranscript"));
      return;
    }
    const tpl = templates?.find((t) => t.id === templateId);
    try {
      const res = await format.mutateAsync({
        transcript,
        template: tpl?.content ?? null,
        recordingId: transcribe.data?.recording_id ?? null,
        studyId: study?.id ?? null,
      });
      setReport(res.report);
      toast.success(study ? t("dictation.reportCreatedSaved") : t("dictation.reportCreated"));
    } catch (err) {
      toast.error(apiErr(err, "dictation.reportCreateFail"));
    }
  };

  const handleSaveToReports = async () => {
    if (!study) {
      toast.warning(t("dictation.linkStudyFirst"));
      return;
    }
    if (!report.trim()) {
      toast.warning(t("dictation.nothingToSave"));
      return;
    }
    try {
      await saveReport.mutateAsync({ content: report, transcript, status: "draft" });
      toast.success(t("dictation.reportSaved"));
    } catch (err) {
      toast.error(apiErr(err, "dictation.reportSaveFail"));
    }
  };

  const resetAll = () => {
    recorder.reset();
    setTranscript("");
    setReport("");
    transcribe.reset();
    format.reset();
  };

  return (
    <div className={cn("space-y-6", focusMode && "mx-auto max-w-4xl")}>
      <PageHeader
        title={t("dictation.title")}
        description={t("dictation.description")}
        icon={<Mic className="size-5" />}
        actions={
          <Button variant="outline" size="sm" onClick={() => setFocusMode((v) => !v)}>
            {focusMode ? <Minimize2 /> : <Maximize2 />}
            {focusMode ? t("dictation.normalView") : t("dictation.focusMode")}
          </Button>
        }
      />

      {/* Study context bar */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          {study ? (
            <div className="flex items-center gap-3">
              <ModalityBadge modality={study.modality} />
              <div>
                <p className="text-sm font-semibold">{study.patient_name || t("dictation.unnamedPatient")}</p>
                <p className="text-xs text-muted-foreground">
                  {study.study_description || "—"} · {study.accession_number || "—"} · {formatDate(study.study_date)}
                </p>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={clearLinkedStudy} aria-label={t("dictation.unlinkStudy")}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="size-4" />
              {t("dictation.noStudyLinked")}
            </div>
          )}
          {!study && (
            <Button variant="outline" size="sm" onClick={() => navigate("/workspace/worklist")}>
              <ListChecks /> {t("dictation.worklist")}
            </Button>
          )}
        </CardContent>
      </Card>

      <div className={cn("grid gap-6", !focusMode && "lg:grid-cols-2")}>
        {/* Recorder */}
        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <span className={cn("flex size-2.5 rounded-full", recording ? "animate-pulse bg-destructive" : "bg-muted-foreground/40")} />
              {t("dictation.recording")}
            </CardTitle>
            <span className="font-mono text-lg font-semibold tabular-nums">{fmtTime(recorder.durationMs)}</span>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <Waveform active={recording} getWaveform={recorder.getWaveform} className="h-24 w-full" />
            </div>

            {recorder.error && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="size-4" />
                {recorder.error}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.flac,.aac,.wma,.opus"
              className="hidden"
              onChange={handleUploadFile}
            />

            <div className="flex flex-wrap items-center justify-center gap-2">
              {recorder.status === "idle" || recorder.status === "error" ? (
                <>
                  <Button size="lg" onClick={recorder.start} className="gap-2">
                    <Mic /> {t("dictation.startRecording")}
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="gap-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload /> {t("dictation.uploadAudio")}
                  </Button>
                </>
              ) : (
                <>
                  {recording ? (
                    <Button size="lg" variant="secondary" onClick={recorder.pause}>
                      <Pause /> {t("dictation.pause")}
                    </Button>
                  ) : paused ? (
                    <Button size="lg" variant="secondary" onClick={recorder.resume}>
                      <Play /> {t("dictation.resumeLabel")}
                    </Button>
                  ) : null}
                  {(recording || paused) && (
                    <Button size="lg" variant="destructive" onClick={recorder.stop}>
                      <Square /> {t("dictation.stop")}
                    </Button>
                  )}
                  {hasAudio && (
                    <Button size="lg" variant="outline" onClick={resetAll}>
                      <RotateCcw /> {t("dictation.reset")}
                    </Button>
                  )}
                </>
              )}
            </div>

            {recorder.devices.length > 0 && (
              <div className="flex items-center gap-2">
                <Settings2 className="size-4 shrink-0 text-muted-foreground" />
                <Select value={recorder.deviceId ?? recorder.devices[0]?.deviceId} onValueChange={recorder.setDevice}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder={t("dictation.micSelect")} />
                  </SelectTrigger>
                  <SelectContent>
                    {recorder.devices.map((d, i) => (
                      <SelectItem key={d.deviceId || i} value={d.deviceId || `mic-${i}`}>
                        {d.label || t("dictation.microphoneN", { n: String(i + 1) })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {recorder.sourceFilename && hasAudio && (
              <p className="truncate text-center text-xs text-muted-foreground">
                {t("dictation.uploadedFile", { name: recorder.sourceFilename })}
              </p>
            )}

            {hasAudio && recorder.blob && (
              <PlaybackTransport blob={recorder.blob} fallbackDurationMs={recorder.durationMs} />
            )}

            {hasAudio && (
              <Button className="w-full" onClick={handleTranscribe} disabled={transcribe.isPending}>
                {transcribe.isPending ? <Spinner /> : <Sparkles />}
                {t("dictation.transcribe")}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Transcript */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{t("dictation.transcription")}</CardTitle>
            {transcript && <AiConfidenceChip value={confidence} />}
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder={t("dictation.transcriptPlaceholderLong")}
              className="min-h-40 font-mono text-sm"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {transcript
                  ? t("dictation.wordCount", {
                      words: String(transcript.trim().split(/\s+/).length),
                      terms: String(countMedicalTerms(transcript)),
                    })
                  : t("suggestions.empty")}
              </p>
              <div className="flex items-center gap-2">
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger className="h-8 w-44 text-xs">
                    <SelectValue placeholder={t("dictation.templateOptional")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("dictation.noTemplate")}</SelectItem>
                    {templates?.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.modality} · {t.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={handleFormat} disabled={format.isPending || !transcript.trim()}>
                      {format.isPending ? <Spinner /> : <Wand2 />}
                      {t("dictation.format")}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("dictation.formatTooltip")}</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Structured report preview */}
      {report && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              {t("dictation.structuredReport")}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={study ? "default" : "outline"}
                onClick={handleSaveToReports}
                disabled={saveReport.isPending || !report.trim()}
              >
                {saveReport.isPending ? <Spinner /> : <Save />}
                {t("dictation.saveToReports")}
              </Button>
              {study && (
                <Button size="sm" variant="secondary" onClick={() => navigate(`/workspace/reports/${study.id}`)}>
                  {t("dictation.openInEditor")}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              value={report}
              onChange={(e) => setReport(e.target.value)}
              placeholder={t("dictation.reportPlaceholder")}
              className="min-h-64 font-mono text-sm"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
