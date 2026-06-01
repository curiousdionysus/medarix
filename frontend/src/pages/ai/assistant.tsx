import * as React from "react";
import { toast } from "sonner";
import { Bot, Send, User as UserIcon, Sparkles, Trash2, Stethoscope } from "lucide-react";
import { useAiAssistant, type AssistantMessage } from "@/features/ai/api";
import { useApiError } from "@/features/i18n/helpers";
import { useT } from "@/features/i18n/locale-context";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const PROMPT_KEYS = ["assistant.prompt1", "assistant.prompt2", "assistant.prompt3", "assistant.prompt4"] as const;

export default function AiAssistantPage() {
  const t = useT();
  const apiErr = useApiError();
  const assistant = useAiAssistant();
  const [messages, setMessages] = React.useState<AssistantMessage[]>([]);
  const [input, setInput] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, assistant.isPending]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const next = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(next);
    setInput("");
    try {
      const res = await assistant.mutateAsync({ messages: next });
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
    } catch (err) {
      toast.error(apiErr(err, "assistant.fail"));
      setMessages((prev) => prev.slice(0, -1));
      setInput(trimmed);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-4">
      <PageHeader
        title={t("assistant.title")}
        description={t("assistant.descriptionShort")}
        icon={<Bot className="size-5" />}
        actions={
          messages.length > 0 ? (
            <Button variant="outline" size="sm" onClick={() => setMessages([])}>
              <Trash2 /> {t("assistant.clearChat")}
            </Button>
          ) : undefined
        }
      />

      <Card className="flex min-h-0 flex-1 flex-col">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <Stethoscope className="size-7" />
              </div>
              <div>
                <p className="font-semibold">{t("assistant.titleChat")}</p>
                <p className="mx-auto max-w-md text-sm text-muted-foreground">{t("assistant.introDesc")}</p>
              </div>
              <div className="grid w-full max-w-lg gap-2 sm:grid-cols-2">
                {PROMPT_KEYS.map((key) => (
                  <button
                    key={key}
                    onClick={() => send(t(key))}
                    className="rounded-lg border border-border p-3 text-left text-sm transition-colors hover:border-primary/50 hover:bg-secondary"
                  >
                    <Sparkles className="mb-1 size-4 text-accent" />
                    {t(key)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => <MessageBubble key={i} message={m} />)
          )}
          {assistant.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/12 text-primary">
                <Bot className="size-4" />
              </span>
              <Spinner /> {t("assistant.thinking")}
            </div>
          )}
        </div>

        <form onSubmit={onSubmit} className="border-t border-border p-3">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder={t("assistant.placeholder")}
              className="max-h-32 min-h-11 flex-1 resize-none"
            />
            <Button
              type="submit"
              size="icon"
              className="size-11 shrink-0"
              disabled={assistant.isPending || !input.trim()}
            >
              <Send className="size-5" />
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function MessageBubble({ message }: { message: AssistantMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          isUser ? "bg-secondary text-secondary-foreground" : "bg-primary/12 text-primary",
        )}
      >
        {isUser ? <UserIcon className="size-4" /> : <Bot className="size-4" />}
      </span>
      <div
        className={cn(
          "max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser ? "rounded-tr-sm bg-primary text-primary-foreground" : "rounded-tl-sm bg-muted",
        )}
      >
        {message.content}
      </div>
    </div>
  );
}
