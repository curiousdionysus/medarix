// Structured radiology report sections (matching the AI gateway prompt order).
export const REPORT_SECTIONS = [
  { key: "inceleme", heading: "İNCELEME", label: "İnceleme" },
  { key: "klinik", heading: "KLİNİK BİLGİ", label: "Klinik Bilgi" },
  { key: "karsilastirma", heading: "KARŞILAŞTIRMA", label: "Karşılaştırma" },
  { key: "bulgular", heading: "BULGULAR", label: "Bulgular" },
  { key: "sonuc", heading: "SONUÇ", label: "Sonuç" },
  { key: "oneri", heading: "ÖNERİ", label: "Öneri" },
] as const;

export type SectionKey = (typeof REPORT_SECTIONS)[number]["key"];
export type SectionMap = Record<SectionKey, string>;

const HEADINGS = REPORT_SECTIONS.map((s) => s.heading);

function emptyMap(): SectionMap {
  return REPORT_SECTIONS.reduce((acc, s) => {
    acc[s.key] = "";
    return acc;
  }, {} as SectionMap);
}

/** Parse a flat report string into structured sections. */
export function parseSections(content: string): { map: SectionMap; structured: boolean } {
  const map = emptyMap();
  if (!content) return { map, structured: false };

  const lines = content.split(/\r?\n/);
  let current: SectionKey | null = null;
  let matched = 0;
  const buffers: Record<string, string[]> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    const headingMatch = REPORT_SECTIONS.find((s) => {
      const re = new RegExp(`^${s.heading}\\s*:?\\s*$`, "i");
      const inline = new RegExp(`^${s.heading}\\s*:\\s*(.*)$`, "i");
      return re.test(trimmed) || inline.test(trimmed);
    });
    if (headingMatch) {
      matched++;
      current = headingMatch.key;
      buffers[current] = buffers[current] ?? [];
      const inline = trimmed.replace(new RegExp(`^${headingMatch.heading}\\s*:?\\s*`, "i"), "");
      if (inline) buffers[current].push(inline);
      continue;
    }
    if (current) {
      buffers[current] = buffers[current] ?? [];
      buffers[current].push(line);
    }
  }

  for (const key of Object.keys(buffers)) {
    map[key as SectionKey] = buffers[key].join("\n").trim();
  }

  return { map, structured: matched >= 2 };
}

/** Serialize structured sections back into a flat report string. */
export function serializeSections(map: SectionMap): string {
  return REPORT_SECTIONS.filter((s) => map[s.key]?.trim())
    .map((s) => `${s.heading}:\n${map[s.key].trim()}`)
    .join("\n\n");
}

void HEADINGS;
