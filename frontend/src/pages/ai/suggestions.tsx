import * as React from "react";
import { Sparkles, ClipboardPaste } from "lucide-react";
import { AiSuggestionPanel } from "@/features/ai/suggestion-panel";
import { useT } from "@/features/i18n/locale-context";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { countMedicalTerms } from "@/features/dictation/medical-terms";

export default function SmartSuggestionsPage() {
  const t = useT();
  const [text, setText] = React.useState("");

  const paste = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      if (clip) setText(clip);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("suggestions.title")}
        description={t("suggestions.descriptionLong")}
        icon={<Sparkles className="size-5" />}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{t("suggestions.reportText")}</CardTitle>
            <Button variant="outline" size="sm" onClick={paste}>
              <ClipboardPaste /> {t("suggestions.paste")}
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("suggestions.placeholder")}
              className="min-h-[24rem] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {text
                ? t("suggestions.wordCount", {
                    words: String(text.trim().split(/\s+/).length),
                    terms: String(countMedicalTerms(text)),
                  })
                : t("suggestions.empty")}
            </p>
          </CardContent>
        </Card>

        <AiSuggestionPanel text={text} onApply={setText} className="h-fit" />
      </div>
    </div>
  );
}
