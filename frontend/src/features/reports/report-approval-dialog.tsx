import * as React from "react";
import { CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useT } from "@/features/i18n/locale-context";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  pending?: boolean;
}

export function ReportApprovalDialog({ open, onOpenChange, onConfirm, pending }: Props) {
  const t = useT();
  const [acknowledged, setAcknowledged] = React.useState(false);

  React.useEffect(() => {
    if (!open) setAcknowledged(false);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("reports.approvalDialogTitle")}</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 pt-1 text-sm leading-relaxed text-muted-foreground">
              <p>{t("reports.approvalDisclaimerIntro")}</p>
              <p>{t("reports.approvalDisclaimerRisks")}</p>
              <p>{t("reports.approvalDisclaimerAction")}</p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <label
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/30 p-4 transition-colors",
            acknowledged && "border-primary/40 bg-primary/5",
          )}
        >
          <input
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 rounded border-border accent-primary"
            checked={acknowledged}
            disabled={pending}
            onChange={(e) => setAcknowledged(e.target.checked)}
          />
          <span className="text-sm font-medium leading-snug">{t("reports.approvalCheckbox")}</span>
        </label>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            {t("reports.approvalCancel")}
          </Button>
          <Button type="button" disabled={!acknowledged || pending} onClick={onConfirm}>
            <CheckCircle2 className="size-4" />
            {pending ? t("reports.approvalSubmitting") : t("reports.approvalConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
