import * as React from "react";
import { toast } from "sonner";
import { LayoutTemplate, Plus, Trash2, FileText } from "lucide-react";
import { useTemplates, useCreateTemplate, useDeleteTemplate } from "@/features/studies/api";
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
import { apiErrorMessage } from "@/lib/api";
import { REPORT_SECTIONS } from "@/features/reports/sections";

const STARTER = REPORT_SECTIONS.map((s) => `${s.heading}:\n`).join("\n");

export default function TemplatesPage() {
  const { data, isLoading } = useTemplates();
  const create = useCreateTemplate();
  const del = useDeleteTemplate();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ modality: "CT", title: "", content: STARTER });

  const grouped = React.useMemo(() => {
    const g: Record<string, typeof data> = {};
    (data ?? []).forEach((t) => {
      (g[t.modality] = g[t.modality] ?? []).push(t);
    });
    return g;
  }, [data]);

  const submit = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.warning("Başlık ve içerik gerekli");
      return;
    }
    try {
      await create.mutateAsync({
        modality: form.modality.trim().toUpperCase(),
        title: form.title.trim(),
        content: form.content,
      });
      toast.success("Şablon oluşturuldu");
      setOpen(false);
      setForm({ modality: "CT", title: "", content: STARTER });
    } catch (err) {
      toast.error(apiErrorMessage(err, "Şablon oluşturulamadı"));
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Şablonlar"
        description="Modaliteye göre yeniden kullanılabilir rapor şablonları."
        icon={<LayoutTemplate className="size-5" />}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus /> Yeni Şablon
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Yeni Şablon</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="modality">Modalite</Label>
                    <Input
                      id="modality"
                      value={form.modality}
                      onChange={(e) => setForm((f) => ({ ...f, modality: e.target.value }))}
                      placeholder="CT, MR, XR…"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="title">Başlık</Label>
                    <Input
                      id="title"
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="Örn. Toraks BT"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="content">İçerik</Label>
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
                  İptal
                </Button>
                <Button onClick={submit} disabled={create.isPending}>
                  Kaydet
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
                <span className="text-sm text-muted-foreground">{templates?.length} şablon</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {templates?.map((t) => (
                  <Card key={t.id} className="flex flex-col">
                    <CardHeader className="flex-row items-start justify-between p-4">
                      <CardTitle className="text-base">{t.title}</CardTitle>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => del.mutate(t.id, { onSuccess: () => toast.success("Şablon silindi") })}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </CardHeader>
                    <CardContent className="flex-1 p-4 pt-0">
                      <pre className="line-clamp-6 whitespace-pre-wrap font-mono text-xs text-muted-foreground">
                        {t.content}
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
          title="Henüz şablon yok"
          description="Tekrarlayan raporlarınız için bir şablon oluşturun."
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus /> İlk şablonu oluştur
            </Button>
          }
        />
      )}
    </div>
  );
}
