import * as React from "react";
import { toast } from "sonner";
import { LayoutTemplate, Plus, Trash2, FileText } from "lucide-react";
import { useTemplates, useCreateTemplate, useDeleteTemplate } from "@/features/studies/api";
import { getReportSections } from "@/features/i18n/report-sections";
import { useApiError } from "@/features/i18n/helpers";
import { useLocale, useT, type Locale } from "@/features/i18n/locale-context";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ModalityBadge } from "@/components/shared/status-badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function starterContent(locale: Locale) {
  return getReportSections(locale)
    .map((s) => `${s.heading}:\n`)
    .join("\n");
}

export default function TemplatesPage() {
  const t = useT();
  const { locale } = useLocale();
  const apiErr = useApiError();
  const { data, isLoading } = useTemplates();
  const create = useCreateTemplate();
  const del = useDeleteTemplate();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ modality: "CT", title: "", content: starterContent(locale) });

  React.useEffect(() => {
    setForm((f) => ({ ...f, content: starterContent(locale) }));
  }, [locale]);

  const grouped = React.useMemo(() => {
    const g: Record<string, typeof data> = {};
    (data ?? []).forEach((tpl) => {
      (g[tpl.modality] = g[tpl.modality] ?? []).push(tpl);
    });
    return g;
  }, [data]);

  const submit = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.warning(t("templates.titleContentRequired"));
      return;
    }
    try {
      await create.mutateAsync({
        modality: form.modality.trim().toUpperCase(),
        title: form.title.trim(),
        content: form.content,
      });
      toast.success(t("templates.created"));
      setOpen(false);
      setForm({ modality: "CT", title: "", content: starterContent(locale) });
    } catch (err) {
      toast.error(apiErr(err, "templates.createFail"));
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("templates.title")}
        description={t("templates.reusableDesc")}
        icon={<LayoutTemplate className="size-5" />}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus /> {t("templates.newTemplate")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{t("templates.newTemplate")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="modality">{t("templates.modality")}</Label>
                    <Input
                      id="modality"
                      value={form.modality}
                      onChange={(e) => setForm((f) => ({ ...f, modality: e.target.value }))}
                      placeholder={t("templates.modalityPlaceholder")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="title">{t("templates.titleLabel")}</Label>
                    <Input
                      id="title"
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder={t("templates.titlePlaceholder")}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="content">{t("templates.content")}</Label>
                  <Textarea
                    id="content"
                    value={form.content}
                    onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                    className="min-h-64 font-mono text-sm"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button onClick={submit} disabled={create.isPending}>
                  {t("common.save")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : data?.length ? (
        <div className="space-y-6">
          {Object.entries(grouped).map(([modality, templates]) => (
            <div key={modality} className="space-y-3">
              <div className="flex items-center gap-2">
                <ModalityBadge modality={modality} />
                <span className="text-sm text-muted-foreground">
                  {t("templates.templatesCount", { count: String(templates?.length ?? 0) })}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {templates?.map((tpl) => (
                  <Card key={tpl.id} className="flex flex-col">
                    <CardHeader className="flex-row items-start justify-between p-4">
                      <CardTitle className="text-base">{tpl.title}</CardTitle>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() =>
                          del.mutate(tpl.id, { onSuccess: () => toast.success(t("templates.deleted")) })
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </CardHeader>
                    <CardContent className="flex-1 p-4 pt-0">
                      <pre className="line-clamp-6 whitespace-pre-wrap font-mono text-xs text-muted-foreground">
                        {tpl.content}
                      </pre>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FileText}
          title={t("templates.empty")}
          description={t("templates.emptyDesc")}
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus /> {t("templates.firstTemplate")}
            </Button>
          }
        />
      )}
    </div>
  );
}
