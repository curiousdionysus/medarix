import * as React from "react";
import { toast } from "sonner";
import { Sparkles, Check, RefreshCw, Wand2, SpellCheck, Stethoscope, ListTree } from "lucide-react";
import { useAiSuggestion } from "./api";
import { useApiError } from "@/features/i18n/helpers";
import { useT } from "@/features/i18n/locale-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const KINDS = [
  { id: "improve", labelKey: "suggestions.improve", icon: Wand2 },
  { id: "grammar", labelKey: "suggestions.grammar", icon: SpellCheck },
  { id: "terminology", labelKey: "suggestions.terminology", icon: Stethoscope },
  { id: "structure", labelKey: "suggestions.structure", icon: ListTree },
] as const;

interface Props {
  text: string;
  onApply: (result: string) => void;
  className?: string;
  compact?: boolean;
}

export function AiSuggestionPanel({ text, onApply, className, compact }: Props) {
  const t = useT();
  const apiErr = useApiError();
  const suggestion = useAiSuggestion();
  const [kind, setKind] = React.useState<string>("improve");
  const [result, setResult] = React.useState<string>("");

  const run = async (k: string) => {
    setKind(k);
    if (!text.trim()) {
      toast.warning(t("suggestions.enterTextFirst"));
      return;
    }
    setResult("");
    try {
      const res = await suggestion.mutateAsync({ text, kind: k });
      setResult(res.result);
    } catch (err) {
      toast.error(apiErr(err, "suggestions.fail"));
    }
  };

  return (
    <Card className={className}>
      <CardHeader className={cn(compact && "p-4")}>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-accent" />
          {t("suggestions.panelTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className={cn("space-y-3", compact && "p-4 pt-0")}>
        <div className="grid grid-cols-2 gap-2">
          {KINDS.map((k) => (
            <Button
              key={k.id}
              variant={kind === k.id ? "default" : "outline"}
              size="sm"
              onClick={() => run(k.id)}
              disabled={suggestion.isPending}
              className="justify-start"
            >
              <k.icon />
              {t(k.labelKey)}
            </Button>
          ))}
        </div>

        {suggestion.isPending && (
          <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            <Spinner /> {t("suggestions.preparing")}
          </div>
        )}

        {result && !suggestion.isPending && (
          <div className="space-y-2">
            <div className="max-h-64 overflow-y-auto rounded-lg border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
              {result}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                onClick={() => {
                  onApply(result);
                  toast.success(t("suggestions.applied"));
                  setResult("");
                }}
              >
                <Check /> {t("suggestions.apply")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => run(kind)}>
                <RefreshCw /> {t("suggestions.retry")}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
