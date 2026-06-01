// Lightweight Turkish radiology lexicon for in-editor term highlighting.
// Not exhaustive — used purely as a visual aid for the radiologist.
export const MEDICAL_TERMS = [
  "akciğer", "bronkovasküler", "opasite", "infiltrasyon", "plevral", "efüzyon",
  "pnömotoraks", "kardiyotorasik", "mediasten", "diyafragma", "nodül", "kitle",
  "lezyon", "kontrast", "hipodens", "hiperdens", "izodens", "ödem", "hematom",
  "anevrizma", "stenoz", "tromboz", "metastaz", "lenfadenopati", "atelektazi",
  "konsolidasyon", "fraktür", "kalsifikasyon", "kist", "apse", "fibrozis",
  "ventrikül", "korteks", "parankim", "serebral", "hepatik", "renal", "splenik",
  "pankreatik", "vasküler", "arteriyel", "venöz", "sinüs", "vertebra", "disk",
  "herniasyon", "spondiloz", "skolyoz", "osteofit", "ligaman", "tendon",
] as const;

export interface TextSegment {
  text: string;
  isTerm: boolean;
}

let cachedRegex: RegExp | null = null;
function termRegex(): RegExp {
  if (!cachedRegex) {
    const escaped = MEDICAL_TERMS.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    cachedRegex = new RegExp(`(${escaped.join("|")})`, "giu");
  }
  return cachedRegex;
}

export function segmentMedicalTerms(text: string): TextSegment[] {
  if (!text) return [];
  const regex = termRegex();
  const segments: TextSegment[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(regex)) {
    const idx = match.index ?? 0;
    if (idx > lastIndex) segments.push({ text: text.slice(lastIndex, idx), isTerm: false });
    segments.push({ text: match[0], isTerm: true });
    lastIndex = idx + match[0].length;
  }
  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex), isTerm: false });
  return segments;
}

export function countMedicalTerms(text: string): number {
  if (!text) return 0;
  return Array.from(text.matchAll(termRegex())).length;
}
