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
import { apiErrorMessage } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";

function fmtTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function DictationPage() {
  const recorder = useRecorder();
  const transcribe = useTranscribe();
  const format = useFormatReport();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: templates } = useTemplates();

  const linkedStudyId = searchParams.get("studyId") ?? undefined;
  const passedStudy = (location.state as { study?: StudyOut } | null)?.study;
  const { data: fetchedStudy } = useStudy(passedStudy ? undefined : linkedStudyId);

  const [study, setStudy] = React.useState<StudyOut | null>(passedStudy ?? null);
  const [transcript, setTranscript] = React.useState("");
  const [report, setReport] = React.useState("");
  const [templateId, setTemplateId] = React.useState<string>("none");
  const [focusMode, setFocusMode] = React.useState(false);
  const saveReport = useSaveReport(study?.id);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Auto-link a study passed from the worklist (state) or via ?studyId= deep link.
  const appliedStudyRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const incoming = passedStudy ?? fetchedStudy;
    if (incoming && appliedStudyRef.current !== incoming.id) {
      appliedStudyRef.current = incoming.id;
      setStudy(incoming);
      toast.success(`${incoming.patient_name || "Çalışma"} bağlandı`);
    }
  }, [passedStudy, fetchedStudy]);

  const clearLinkedStudy = () => {
    setStudy(null);
    appliedStudyRef.current = "__cleared__";
    if (linkedStudyId) {
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
      toast.success(`"${file.name}" yüklendi — Yazıya Dök ile transkribe edebilirsiniz`);
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
      toast.success("Ses başarıyla yazıya döküldü");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Transkripsiyon başarısız"));
    }
  };

  const handleFormat = async () => {
    if (!transcript.trim()) {
      toast.warning("Önce transkripsiyon oluşturun");
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
      toast.success(study ? "Rapor oluşturuldu ve taslak olarak kaydedildi" : "Rapor oluşturuldu");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Rapor oluşturulamadı"));
    }
  };

  const handleSaveToReports = async () => {
    if (!study) {
      toast.warning("Önce İş Listesi'nden bir çalışma bağlayın");
      return;
    }
    if (!report.trim()) {
      toast.warning("Kaydedilecek rapor yok");
      return;
    }
    try {
      await saveReport.mutateAsync({ content: report, transcript, status: "draft" });
      toast.success("Rapor, Raporlar bölümüne taslak olarak kaydedildi");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Rapor kaydedilemedi"));
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
        title="Rapor Diktasyonu"
        description="Sesli kaydedin, yapay zeka ile yazıya dökün ve yapılandırılmış rapora dönüştürün."
        icon={<Mic className="size-5" />}
        actions={
          <Button variant="outline" size="sm" onClick={() => setFocusMode((v) => !v)}>
            {focusMode ? <Minimize2 /> : <Maximize2 />}
            {focusMode ? "Normal Görünüm" : "Odak Modu"}
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
                <p className="text-sm font-semibold">{study.patient_name || "İsimsiz hasta"}</p>
                <p className="text-xs text-muted-foreground">
                  {study.study_description || "—"} · {study.accession_number || "—"} · {formatDate(study.study_date)}
                </p>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={clearLinkedStudy} aria-label="Bağlantıyı kaldır">
                <Trash2 className="size-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="size-4" />
              Çalışma bağlanmadı — İş Listesi'nden bir çalışma seçin.
            </div>
          )}
          {!study && (
            <Button variant="outline" size="sm" onClick={() => navigate("/workspace/worklist")}>
              <ListChecks /> İş Listesi
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
              Kayıt
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
                    <Mic /> Kaydı Başlat
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="gap-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload /> Ses Dosyası Yükle
                  </Button>
                </>
              ) : (
                <>
                  {recording ? (
                    <Button size="lg" variant="secondary" onClick={recorder.pause}>
                      <Pause /> Duraklat
                    </Button>
                  ) : paused ? (
                    <Button size="lg" variant="secondary" onClick={recorder.resume}>
                      <Play /> Devam Et
                    </Button>
                  ) : null}
                  {(recording || paused) && (
                    <Button size="lg" variant="destructive" onClick={recorder.stop}>
                      <Square /> Durdur
                    </Button>
                  )}
                  {hasAudio && (
                    <Button size="lg" variant="outline" onClick={resetAll}>
                      <RotateCcw /> Sıfırla
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
                    <SelectValue placeholder="Mikrofon seç" />
                  </SelectTrigger>
                  <SelectContent>
                    {recorder.devices.map((d, i) => (
                      <SelectItem key={d.deviceId || i} value={d.deviceId || `mic-${i}`}>
                        {d.label || `Mikrofon ${i + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {recorder.sourceFilename && hasAudio && (
              <p className="truncate text-center text-xs text-muted-foreground">
                Yüklenen dosya: <span className="font-medium text-foreground">{recorder.sourceFilename}</span>
              </p>
            )}

            {hasAudio && recorder.blob && (
              <PlaybackTransport blob={recorder.blob} fallbackDurationMs={recorder.durationMs} />
            )}

            {hasAudio && (
              <Button className="w-full" onClick={handleTranscribe} disabled={transcribe.isPending}>
                {transcribe.isPending ? <Spinner /> : <Sparkles />}
                Yazıya Dök
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Transcript */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Transkripsiyon</CardTitle>
            {transcript && <AiConfidenceChip value={confidence} />}
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Yazıya dökülen metin burada görünecek. Doğrudan düzenleyebilirsiniz…"
              className="min-h-40 font-mono text-sm"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {transcript ? `${transcript.trim().split(/\s+/).length} kelime · ${countMedicalTerms(transcript)} tıbbi terim` : "Henüz metin yok"}
              </p>
              <div className="flex items-center gap-2">
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger className="h-8 w-44 text-xs">
                    <SelectValue placeholder="Şablon (opsiyonel)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Şablon yok</SelectItem>
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
                      Yapılandır
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>AI ile yapılandırılmış rapora dönüştür</TooltipContent>
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
              Yapılandırılmış Rapor
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={study ? "default" : "outline"}
                onClick={handleSaveToReports}
                disabled={saveReport.isPending || !report.trim()}
              >
                {saveReport.isPending ? <Spinner /> : <Save />}
                Raporlara Kaydet
              </Button>
              {study && (
                <Button size="sm" variant="secondary" onClick={() => navigate(`/workspace/reports/${study.id}`)}>
                  Rapor Editöründe Aç
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              value={report}
              onChange={(e) => setReport(e.target.value)}
              placeholder="Yapılandırılmış rapor metni…"
              className="min-h-64 font-mono text-sm"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
