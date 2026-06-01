import { useNavigate } from "react-router-dom";
import { FileQuestion } from "lucide-react";
import { useT } from "@/features/i18n/locale-context";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  const navigate = useNavigate();
  const t = useT();
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <EmptyState
        icon={FileQuestion}
        title={t("notFound.title")}
        description={t("notFound.description")}
        action={<Button onClick={() => navigate("/workspace/worklist")}>{t("notFound.backWorklist")}</Button>}
      />
    </div>
  );
}
