import type { BadgeProps } from "@/components/ui/badge";

type BadgeVariant = NonNullable<BadgeProps["variant"]>;

/** Human-readable Turkish labels for known audit actions. */
export const ACTION_LABELS: Record<string, string> = {
  "auth.login": "Sisteme giriş yaptı",
  "auth.logout": "Sistemden çıkış yaptı",
  "auth.refresh": "Oturum yeniledi",
  "report.create": "Rapor oluşturdu",
  "report.update": "Raporu güncelledi",
  "report.sign": "Raporu imzaladı",
  "report.send_to_pacs": "Raporu PACS'e gönderdi",
  "report.download_pdf": "Rapor PDF indirdi",
  "report_template.create": "Şablon oluşturdu",
  "report_template.delete": "Şablon sildi",
  "ai.transcribe": "Sesi yazıya döktü",
  "ai.format_report": "AI ile rapor düzenledi",
  "ai.suggest": "AI önerisi aldı",
  "ai.assistant": "AI asistanı kullandı",
  "study.search": "Çalışma araması yaptı",
  "study.open": "Çalışma açtı",
  "image.viewer_launch": "Görüntüleyici açtı",
  "pacs.query": "PACS sorgusu yaptı",
  "pacs.retrieve": "PACS'ten çalışma çekti",
  "admin.user.create": "Kullanıcı oluşturdu",
  "admin.user.delete": "Kullanıcı sildi",
  "admin.group.create": "Grup oluşturdu",
  "admin.role.create": "Rol oluşturdu",
  "admin.role.update": "Rol güncelledi",
  "admin.role.delete": "Rol sildi",
  "admin.group.delete": "Grup sildi",
  "admin.system_settings.update": "Sistem ayarlarını güncelledi",
  "admin.auth.verify": "Kimlik doğrulama ayarlarını test etti",
  "admin.license.activate": "Lisans etkinleştirdi",
  "admin.license.deactivate": "Lisansı kaldırdı (Standart)",
  "admin.license.issue": "Lisans anahtarı oluşturdu",
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

interface CategoryMeta {
  label: string;
  variant: BadgeVariant;
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  auth: { label: "Kimlik Doğrulama", variant: "info" },
  report: { label: "Rapor", variant: "success" },
  report_template: { label: "Şablon", variant: "secondary" },
  ai: { label: "Yapay Zeka", variant: "warning" },
  study: { label: "Çalışma", variant: "secondary" },
  image: { label: "Görüntüleme", variant: "secondary" },
  pacs: { label: "PACS", variant: "info" },
  admin: { label: "Yönetim", variant: "destructive" },
  recording: { label: "Ses Kaydı", variant: "secondary" },
};

/** Derives a category from the action's event ID prefix (e.g. "report.sign" -> Rapor). */
export function actionCategory(action: string): CategoryMeta {
  const prefix = action.split(".")[0];
  if (action.startsWith("report_template")) return CATEGORY_META.report_template;
  return CATEGORY_META[prefix] ?? { label: "Diğer", variant: "muted" };
}
