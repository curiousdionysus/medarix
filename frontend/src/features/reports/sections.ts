import { getReportSections, legacySectionKey, type ReportSectionKey } from "@/features/i18n/report-sections";
import { getStoredLocale, type Locale } from "@/features/i18n/locale-context";

export type SectionKey = ReportSectionKey;
export type SectionMap = Record<SectionKey, string>;

function allSectionDefs() {
  return [...getReportSections("tr"), ...getReportSections("en")];
}

function emptyMap(): SectionMap {
  return getReportSections("en").reduce((acc, s) => {
    acc[s.key] = "";
    return acc;
  }, {} as SectionMap);
}

/** Parse a flat report string into structured sections (TR/EN headings). */
export function parseSections(content: string): { map: SectionMap; structured: boolean } {
  const map = emptyMap();
  if (!content) return { map, structured: false };

  const defs = allSectionDefs();
  const lines = content.split(/\r?\n/);
  let current: SectionKey | null = null;
  let matched = 0;
  const buffers: Partial<Record<SectionKey, string[]>> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    const headingMatch = defs.find((s) => {
      const re = new RegExp(`^${s.heading}\\s*:?\\s*$`, "i");
      const inline = new RegExp(`^${s.heading}\\s*:\\s*(.*)$`, "i");
      return re.test(trimmed) || inline.test(trimmed);
    });
    if (headingMatch) {
      matched++;
      current = headingMatch.key;
      buffers[current] = buffers[current] ?? [];
      const inline = trimmed.replace(new RegExp(`^${headingMatch.heading}\\s*:?\\s*`, "i"), "");
      if (inline) buffers[current]!.push(inline);
      continue;
    }
    if (current) {
      buffers[current] = buffers[current] ?? [];
      buffers[current]!.push(line);
    }
  }

  for (const [key, linesBuf] of Object.entries(buffers)) {
    const canon = legacySectionKey(key) ?? (key as SectionKey);
    if (canon in map) map[canon] = linesBuf!.join("\n").trim();
  }

  return { map, structured: matched >= 2 };
}

/** Serialize structured sections back into a flat report string. */
export function serializeSections(map: SectionMap, locale: Locale = getStoredLocale()): string {
  return getReportSections(locale)
    .filter((s) => map[s.key]?.trim())
    .map((s) => `${s.heading}:\n${map[s.key].trim()}`)
    .join("\n\n");
}
