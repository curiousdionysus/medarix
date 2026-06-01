import { segmentMedicalTerms } from "@/features/dictation/medical-terms";
import { cn } from "@/lib/utils";

export function HighlightedText({ text, className }: { text: string; className?: string }) {
  const segments = segmentMedicalTerms(text);
  return (
    <p className={cn("cursor-default select-text whitespace-pre-wrap leading-relaxed", className)}>
      {segments.map((seg, i) =>
        seg.isTerm ? (
          <mark
            key={i}
            className="rounded bg-accent/15 px-0.5 font-medium text-accent decoration-clone"
          >
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </p>
  );
}
