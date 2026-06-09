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
} from "lucide-react";
import {
  useStudy,
  useStudyReport,
  useSaveReport,
  useFinalizeReport,
  useTemplates,
  useStudies,
  downloadReportPdf,
} from "@/features/studies/api";
import { parseSections, serializeSections, type SectionMap } from "@/features/reports/sections";
import { ReportApprovalDialog } from "@/features/reports/report-approval-dialog";
import { useApiError, useReportSections } from "@/features/i18n/helpers";
import { useLocale, useT } from "@/features/i18n/locale-context";
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
import { cn, formatDate, initials } from "@/lib/utils";

type SaveState = "idle" | "saving" | "saved" | "error";

const TALL_SECTIONS = new Set(["findings", "conclusion"]);

export default function ReportsPage() {
  const { studyId } = useParams();
  if (!studyId) return <ReportPicker />;
  return <ReportEditor key={studyId} studyId={studyId} />;
}

function ReportPicker() {
  const t = useT();
  const { data, isLoading } = useStudies({ limit: 50, has_report: true });
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("reports.title")}
        description={t("reports.description")}
        icon={<FileText className="size-5" />}
      />
      <Card>
        <CardHeader>
          <CardTitle>{t("reports.recentReports")}</CardTitle>
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
                  <p className="truncate text-sm font-semibold">{s.patient_name || t("common.unnamedPatient")}</p>
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
              title={t("reports.noReports")}
              description={t("reports.noReportsDesc")}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReportEditor({ studyId }: { studyId: string }) {
  const t = useT();
  const { locale } = useLocale();
  const apiErr = useApiError();
  const reportSections = useReportSections();
  const navigate = useNavigate();
  const { data: study, isLoading: studyLoading } = useStudy(studyId);
  const { data: report, isLoading: reportLoading } = useStudyReport(studyId);
  const { data: templates } = useTemplates();
  const save = useSaveReport(studyId);
  const finalize = useFinalizeReport();
  const isEnterprise = useIsEnterprise();

  const [mode, setMode] = React.useState<"structured" | "raw">("structured");
  const [sections, setSections] = React.useState<SectionMap>(() => parseSections("").map);
  const [raw, setRaw] = React.useState("");
  const [saveState, setSaveState] = React.useState<SaveState>("idle");
  const [amending, setAmending] = React.useState(false);
  const [approvalOpen, setApprovalOpen] = React.useState(false);

  const hydrated = React.useRef(false);
  const lastSaved = React.useRef<string>("");

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
    () => (mode === "structured" ? serializeSections(sections, locale) : raw),
    [mode, sections, raw, locale],
  );

  const isSigned = report?.status === "signed" && !amending;
  const editable = !isSigned;

  React.useEffect(() => {
    if (!hydrated.current || !editable) return;
    const content = currentContent();
    if (content === lastSaved.current) return;
    const timer = setTimeout(async () => {
      setSaveState("saving");
      try {
        await save.mutateAsync({
          content,
          transcript: report?.transcript,
          status: amending ? "amended" : "draft",
        });
        lastSaved.current = content;
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [sections, raw, mode, editable, amending, currentContent, save, report?.transcript]);

  const toggleMode = () => {
    if (mode === "structured") {
      setRaw(serializeSections(sections, locale));
      setMode("raw");
    } else {
      const parsed = parseSections(raw);
      if (parsed.structured) {
        setSections(parsed.map);
        setMode("structured");
      }
    }
  };

  const applyTemplate = (id: string) => {
    const tpl = templates?.find((x) => x.id === id);
    if (!tpl) return;
    const parsed = parseSections(tpl.content);
    if (parsed.structured) {
      setMode("structured");
      setSections(parsed.map);
    } else {
      setMode("raw");
      setRaw(tpl.content);
    }
    toast.success(t("reports.templateLoaded", { title: tpl.title }));
  };

  const openApprovalDialog = () => {
    if (!report?.id) {
      toast.error(t("reports.saveFirst"));
      return;
    }
    setApprovalOpen(true);
  };

  const handleFinalize = async () => {
    if (!report?.id) return;
    const content = currentContent();
    try {
      if (content !== lastSaved.current && content.trim()) {
        await save.mutateAsync({ content, transcript: report.transcript, status: amending ? "amended" : "draft" });
        lastSaved.current = content;
      }
      const res = await finalize.mutateAsync(report.id);
      setAmending(false);
      setApprovalOpen(false);
      const pacsStatus = res.pacs_status;
      if (!pacsStatus) {
        toast.success(t("reports.signSuccess"));
        return;
      }
      const status = String(pacsStatus.status ?? "");
      const warnings = pacsStatus.warnings;
      if (
        status === "stored_in_pacs" ||
        status === "stored_in_orthanc_study_attachment" ||
        status === "stored_in_pacs_and_orthanc"
      ) {
        toast.success(t("reports.pacsSignedSent"));
        if (Array.isArray(warnings) && warnings.length > 0) {
          toast.warning(t("reports.pacsPartialWarning", { detail: warnings.join("; ") }));
        }
      } else {
        const detail = typeof pacsStatus.detail === "string" ? pacsStatus.detail : undefined;
        toast.message(t("reports.pacsSignedTitle"), {
          description: detail
            ? t("reports.pacsStatusDetail", { detail })
            : t("reports.pacsStatusUnknown", { status: status || t("common.unknown") }),
        });
      }
    } catch (err) {
      toast.error(apiErr(err, "reports.pacsFail"));
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
      toast.error(apiErr(err, "reports.pdfFail"));
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
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="size-12">
              <AvatarFallback className="text-sm">{initials(study?.patient_name)}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">{study?.patient_name || t("common.unnamedPatient")}</h2>
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
                toast.success(t("versionHistory.restored", { version: String(v.version) }));
              }}
            />
            <Button variant="outline" size="sm" onClick={handlePdf}>
              <FileDown /> PDF
            </Button>
            {isSigned ? (
              <Button variant="secondary" size="sm" onClick={() => setAmending(true)}>
                <FilePlus2 /> {t("reports.amend")}
              </Button>
            ) : (
              <Button size="sm" onClick={openApprovalDialog} disabled={!report?.id || finalize.isPending}>
                <CheckCircle2 />{" "}
                {finalize.isPending ? t("reports.approvalSubmitting") : t("reports.approveAndSend")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <ReportApprovalDialog
        open={approvalOpen}
        onOpenChange={setApprovalOpen}
        onConfirm={handleFinalize}
        pending={finalize.isPending}
      />

      {isSigned && (
        <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-4 py-2.5 text-sm text-success">
          <Lock className="size-4" />
          {t("reports.signedReadonly")}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <PageHeader title={t("reports.editor")} className="[&_h1]:text-lg" />
            <div className="flex items-center gap-2">
              {templates && templates.length > 0 && (
                <Select onValueChange={applyTemplate} disabled={!editable}>
                  <SelectTrigger className="h-8 w-40 text-xs">
                    <SelectValue placeholder={t("reports.addTemplate")} />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((tpl) => (
                      <SelectItem key={tpl.id} value={tpl.id}>
                        {tpl.modality} · {tpl.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button variant="outline" size="sm" onClick={toggleMode}>
                {mode === "structured" ? <AlignLeft /> : <LayoutList />}
                {mode === "structured" ? t("reports.plainText") : t("reports.structured")}
              </Button>
            </div>
          </div>

          {mode === "structured" ? (
            <div className="space-y-3">
              {reportSections.map((s) => (
                <Card key={s.key}>
                  <CardContent className="p-3">
                    <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {s.label}
                    </Label>
                    {editable ? (
                      <Textarea
                        value={sections[s.key]}
                        onChange={(e) => setSections((prev) => ({ ...prev, [s.key]: e.target.value }))}
                        placeholder={t("reports.sectionPlaceholder", { label: s.label })}
                        className={cn(
                          "min-h-16 resize-y border-0 bg-transparent px-0 shadow-none focus-visible:ring-0",
                          TALL_SECTIONS.has(s.key) && "min-h-24",
                        )}
                      />
                    ) : (
                      <div
                        className={cn(
                          "min-h-16 select-text whitespace-pre-wrap text-sm leading-relaxed",
                          TALL_SECTIONS.has(s.key) && "min-h-24",
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
                    placeholder={t("reports.rawPlaceholder")}
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
                <PenLine className="size-4 text-primary" /> {t("reports.reportInfo")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0 text-sm">
              <InfoRow label={t("reports.version")} value={report ? `v${report.version}` : "—"} icon={Clock} />
              <InfoRow
                label={t("reports.status")}
                value={report ? <ReportStatusBadge status={report.status} /> : t("reports.statusNew")}
              />
              <InfoRow
                label={t("reports.signature")}
                value={report?.signed_at ? formatDate(report.signed_at) : t("reports.notSigned")}
              />
              <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate("/workspace/dictation")}>
                {t("reports.addDictation")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  const t = useT();
  if (state === "saving")
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CloudUpload className="size-4 animate-pulse" /> {t("reports.saving")}
      </span>
    );
  if (state === "saved")
    return (
      <span className="flex items-center gap-1.5 text-xs text-success">
        <Cloud className="size-4" /> {t("reports.saved")}
      </span>
    );
  if (state === "error")
    return (
      <span className="flex items-center gap-1.5 text-xs text-destructive">
        <CloudOff className="size-4" /> {t("reports.saveFailed")}
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
