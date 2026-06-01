import * as React from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import {
  FileText,
  FileDown,
  PenLine,
  CheckCircle2,
  CloudUpload,
  Cloud,
  CloudOff,
  LayoutList,
  AlignLeft,
  Lock,
  FilePlus2,
  Clock,
  Server,
} from "lucide-react";
import {
  useStudy,
  useStudyReport,
  useSaveReport,
  useSignReport,
  useSendReportToPacs,
  useTemplates,
  useStudies,
  downloadReportPdf,
} from "@/features/studies/api";
import { REPORT_SECTIONS, parseSections, serializeSections, type SectionMap } from "@/features/reports/sections";
import { VersionHistory } from "@/features/reports/version-history";
import { AiSuggestionPanel } from "@/features/ai/suggestion-panel";
import { useIsEnterprise } from "@/features/license/api";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReportStatusBadge, ModalityBadge, PriorityBadge } from "@/components/shared/status-badge";
import { apiErrorMessage } from "@/lib/api";
import { cn, formatDate, initials } from "@/lib/utils";
import type { ReportStatus } from "@/types/api";

type SaveState = "idle" | "saving" | "saved" | "error";

export default function ReportsPage() {
  const { studyId } = useParams();
  if (!studyId) return <ReportPicker />;
  return <ReportEditor key={studyId} studyId={studyId} />;
}

function ReportPicker() {
  const { data, isLoading } = useStudies({ limit: 25 });
  return (
    <div className="space-y-6">
      <PageHeader
        title="Raporlar"
        description="Düzenlemek için bir çalışma seçin."
        icon={<FileText className="size-5" />}
      />
      <Card>
        <CardHeader>
          <CardTitle>Son Çalışmalar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
          ) : data?.length ? (
            data.map((s) => (
              <Link
                key={s.id}
                to={`/workspace/reports/${s.id}`}
                className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:border-primary/50 hover:bg-secondary"
              >
                <ModalityBadge modality={s.modality} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{s.patient_name || "İsimsiz hasta"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.study_description || "—"} · {s.accession_number || "—"}
                  </p>
                </div>
                {s.report_status && <ReportStatusBadge status={s.report_status} />}
                <span className="text-xs text-muted-foreground">{formatDate(s.study_date)}</span>
              </Link>
            ))
          ) : (
            <EmptyState
              icon={FileText}
              title="Rapor yok"
              description="Medarix'te henüz oluşturulmuş rapor yok."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReportEditor({ studyId }: { studyId: string }) {
  const navigate = useNavigate();
  const { data: study, isLoading: studyLoading } = useStudy(studyId);
  const { data: report, isLoading: reportLoading } = useStudyReport(studyId);
  const { data: templates } = useTemplates();
  const save = useSaveReport(studyId);
  const sign = useSignReport();
  const sendToPacs = useSendReportToPacs();
  const isEnterprise = useIsEnterprise();

  const [mode, setMode] = React.useState<"structured" | "raw">("structured");
  const [sections, setSections] = React.useState<SectionMap>(() => parseSections("").map);
  const [raw, setRaw] = React.useState("");
  const [saveState, setSaveState] = React.useState<SaveState>("idle");
  const [amending, setAmending] = React.useState(false);

  const hydrated = React.useRef(false);
  const lastSaved = React.useRef<string>("");

  // Hydrate editor from server once the report loads.
  React.useEffect(() => {
    if (reportLoading || hydrated.current) return;
    const content = report?.content ?? "";
    const parsed = parseSections(content);
    if (parsed.structured) {
      setMode("structured");
      setSections(parsed.map);
    } else {
      setMode("raw");
      setRaw(content);
    }
    lastSaved.current = content;
    hydrated.current = true;
  }, [report, reportLoading]);

  const currentContent = React.useCallback(
    () => (mode === "structured" ? serializeSections(sections) : raw),
    [mode, sections, raw],
  );

  const isSigned = report?.status === "signed" && !amending;
  const editable = !isSigned;

  // Debounced autosave.
  React.useEffect(() => {
    if (!hydrated.current || !editable) return;
    const content = currentContent();
    if (!content.trim() || content === lastSaved.current) return;
    setSaveState("saving");
    const id = setTimeout(async () => {
      try {
        const status: ReportStatus = amending ? "amended" : "draft";
        await save.mutateAsync({ content, transcript: report?.transcript, status });
        lastSaved.current = content;
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 1200);
    return () => clearTimeout(id);
  }, [sections, raw, mode, editable, amending]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMode = () => {
    if (mode === "structured") {
      setRaw(serializeSections(sections));
      setMode("raw");
    } else {
      setSections(parseSections(raw).map);
      setMode("structured");
    }
  };

  const applyTemplate = (id: string) => {
    const tpl = templates?.find((t) => t.id === id);
    if (!tpl) return;
    const parsed = parseSections(tpl.content);
    if (parsed.structured) {
      setMode("structured");
      setSections(parsed.map);
    } else {
      setMode("raw");
      setRaw(tpl.content);
    }
    toast.success(`"${tpl.title}" şablonu yüklendi`);
  };

  const handleSign = async () => {
    if (!report?.id) {
      toast.error("Önce raporu kaydedin");
      return;
    }
    // Ensure latest content is persisted before signing.
    const content = currentContent();
    try {
      if (content !== lastSaved.current) {
        await save.mutateAsync({ content, transcript: report.transcript, status: amending ? "amended" : "draft" });
        lastSaved.current = content;
      }
      await sign.mutateAsync(report.id);
      setAmending(false);
      toast.success("Rapor imzalandı");
    } catch (err) {
      toast.error(apiErrorMessage(err, "İmzalama başarısız"));
    }
  };

  const handleSendToPacs = async () => {
    if (!report?.id) {
      toast.error("Önce raporu kaydedin");
      return;
    }
    const content = currentContent();
    try {
      if (content !== lastSaved.current && content.trim()) {
        await save.mutateAsync({ content, transcript: report.transcript, status: amending ? "amended" : "draft" });
        lastSaved.current = content;
      }
      const res = await sendToPacs.mutateAsync(report.id);
      setAmending(false);
      const status = res.pacs_status?.status ?? "";
      if (status === "stored_in_orthanc_study_attachment") {
        toast.success("Rapor imzalandı ve PACS'a gönderildi");
      } else if (status.startsWith("queued")) {
        toast.success("Rapor imzalandı, PACS gönderim kuyruğuna alındı");
      } else {
        const detail = res.pacs_status?.detail;
        toast.message("Rapor imzalandı", {
          description: detail ? `PACS: ${detail}` : `PACS durumu: ${status || "bilinmiyor"}`,
        });
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, "PACS'a gönderim başarısız"));
    }
  };

  const handlePdf = async () => {
    try {
      await downloadReportPdf({
        content: currentContent(),
        patient_label: study?.patient_name ?? undefined,
        accession_number: study?.accession_number ?? undefined,
        modality: study?.modality ?? undefined,
        study_date: study?.study_date ?? undefined,
        study_description: study?.study_description ?? undefined,
      });
    } catch (err) {
      toast.error(apiErrorMessage(err, "PDF oluşturulamadı"));
    }
  };

  if (studyLoading || reportLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Patient context + actions */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="size-12">
              <AvatarFallback className="text-sm">{initials(study?.patient_name)}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">{study?.patient_name || "İsimsiz hasta"}</h2>
                <ModalityBadge modality={study?.modality} />
                <PriorityBadge priority={study?.priority as never} />
              </div>
              <p className="text-sm text-muted-foreground">
                {study?.study_description || "—"} · {study?.accession_number || "—"} · {formatDate(study?.study_date)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SaveIndicator state={saveState} />
            {report && <ReportStatusBadge status={report.status} />}
            <VersionHistory
              reportId={report?.id}
              onRestore={(v) => {
                const parsed = parseSections(v.content);
                if (parsed.structured) {
                  setMode("structured");
                  setSections(parsed.map);
                } else {
                  setMode("raw");
                  setRaw(v.content);
                }
                toast.success(`v${v.version} geri yüklendi`);
              }}
            />
            <Button variant="outline" size="sm" onClick={handlePdf}>
              <FileDown /> PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSendToPacs}
              disabled={!report?.id || sendToPacs.isPending}
            >
              <Server /> {sendToPacs.isPending ? "Gönderiliyor…" : "PACS'a Gönder"}
            </Button>
            {isSigned ? (
              <Button variant="secondary" size="sm" onClick={() => setAmending(true)}>
                <FilePlus2 /> Düzelt
              </Button>
            ) : (
              <Button size="sm" onClick={handleSign} disabled={sign.isPending}>
                <CheckCircle2 /> İmzala
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {isSigned && (
        <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-4 py-2.5 text-sm text-success">
          <Lock className="size-4" />
          Bu rapor imzalandı ve salt okunurdur. Değişiklik için "Düzelt" seçeneğini kullanın.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Editor */}
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <PageHeader title="Rapor Editörü" className="[&_h1]:text-lg" />
            <div className="flex items-center gap-2">
              {templates && templates.length > 0 && (
                <Select onValueChange={applyTemplate} disabled={!editable}>
                  <SelectTrigger className="h-8 w-40 text-xs">
                    <SelectValue placeholder="Şablon ekle" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.modality} · {t.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button variant="outline" size="sm" onClick={toggleMode}>
                {mode === "structured" ? <AlignLeft /> : <LayoutList />}
                {mode === "structured" ? "Düz Metin" : "Yapılandırılmış"}
              </Button>
            </div>
          </div>

          {mode === "structured" ? (
            <div className="space-y-3">
              {REPORT_SECTIONS.map((s) => (
                <Card key={s.key}>
                  <CardContent className="p-3">
                    <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {s.label}
                    </Label>
                    {editable ? (
                      <Textarea
                        value={sections[s.key]}
                        onChange={(e) => setSections((prev) => ({ ...prev, [s.key]: e.target.value }))}
                        placeholder={`${s.label} bölümü…`}
                        className={cn(
                          "min-h-16 resize-y border-0 bg-transparent px-0 shadow-none focus-visible:ring-0",
                          ["bulgular", "sonuc"].includes(s.key) && "min-h-24",
                        )}
                      />
                    ) : (
                      <div
                        className={cn(
                          "min-h-16 select-text whitespace-pre-wrap text-sm leading-relaxed",
                          ["bulgular", "sonuc"].includes(s.key) && "min-h-24",
                        )}
                      >
                        {sections[s.key] || <span className="text-muted-foreground">—</span>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-3">
                {editable ? (
                  <Textarea
                    value={raw}
                    onChange={(e) => setRaw(e.target.value)}
                    placeholder="Rapor metnini buraya yazın…"
                    className="min-h-[28rem] font-mono text-sm"
                  />
                ) : (
                  <div className="min-h-[28rem] select-text whitespace-pre-wrap font-mono text-sm leading-relaxed">
                    {raw || <span className="text-muted-foreground">—</span>}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          {isEnterprise && (
            <AiSuggestionPanel
              text={currentContent()}
              compact
              onApply={(result) => {
                const parsed = parseSections(result);
                if (parsed.structured) {
                  setMode("structured");
                  setSections(parsed.map);
                } else {
                  setMode("raw");
                  setRaw(result);
                }
              }}
            />
          )}

          <Card>
            <CardHeader className="p-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <PenLine className="size-4 text-primary" /> Rapor Bilgisi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0 text-sm">
              <InfoRow label="Sürüm" value={report ? `v${report.version}` : "—"} icon={Clock} />
              <InfoRow
                label="Durum"
                value={report ? <ReportStatusBadge status={report.status} /> : "Yeni"}
              />
              <InfoRow
                label="İmza"
                value={report?.signed_at ? formatDate(report.signed_at) : "İmzalanmadı"}
              />
              <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate("/workspace/dictation")}>
                Yeni diktasyon ekle
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "saving")
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CloudUpload className="size-4 animate-pulse" /> Kaydediliyor…
      </span>
    );
  if (state === "saved")
    return (
      <span className="flex items-center gap-1.5 text-xs text-success">
        <Cloud className="size-4" /> Kaydedildi
      </span>
    );
  if (state === "error")
    return (
      <span className="flex items-center gap-1.5 text-xs text-destructive">
        <CloudOff className="size-4" /> Kaydedilemedi
      </span>
    );
  return null;
}

function InfoRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: typeof Clock;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-1.5 last:border-0">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {Icon && <Icon className="size-3.5" />}
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
