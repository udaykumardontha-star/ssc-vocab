import { VocabEntry, Category, Mode } from '@/types';

// ─── Prompt Templates ─────────────────────────────────────────────────────────

const OWS_PROMPT = `You are an expert SSC (Staff Selection Commission) exam vocabulary extractor.

Extract ONE WORD SUBSTITUTIONS from the given input text.

OUTPUT FORMAT (strict):
- Each line: WORD<TAB>TRIGGER
- WORD = the one-word substitute
- TRIGGER = 1 to 3 words describing what the word means
- No explanations, no numbering, no punctuation, no extra text
- One entry per line only

EXAMPLES:
Cynic\tHuman doubter
Bibliophile\tBook lover
Pessimist\tNegative outlook
Omnivore\tEats everything

INPUT:
{INPUT}

OUTPUT (only the entries, nothing else):`;

const VOCAB_PROMPT = `You are an expert SSC (Staff Selection Commission) exam vocabulary extractor.

Extract VOCABULARY WORDS with their synonyms/meanings from the given input text.

OUTPUT FORMAT (strict):
- Each line: WORD<TAB>TRIGGER
- WORD = the vocabulary word
- TRIGGER = 1 to 2 words (synonym or core meaning)
- No explanations, no numbering, no punctuation, no extra text
- One entry per line only

EXAMPLES:
Esteem\tRespect
Placid\tCalm
Conjecture\tGuess
Eloquent\tFluent speaker

INPUT:
{INPUT}

OUTPUT (only the entries, nothing else):`;

const IDIOMS_PROMPT = `You are an expert SSC (Staff Selection Commission) exam vocabulary extractor.

Extract IDIOMS AND PHRASES with their meanings from the given input text.

OUTPUT FORMAT (strict):
- Each line: IDIOM : MEANING
- IDIOM = the complete idiom or phrase
- MEANING = 1 to 3 words
- Separator is " : " (space colon space)
- No explanations, no numbering, no extra text
- One entry per line only

EXAMPLES:
Beat around the bush : Avoid topic
Piece of cake : Very easy
Spill the beans : Reveal secret
Cost an arm and a leg : Very expensive

INPUT:
{INPUT}

OUTPUT (only the entries, nothing else):`;

const MIXED_PROMPT = `You are an expert SSC (Staff Selection Commission) exam vocabulary extractor.

Analyze the input and extract OWS, Vocabulary, and Idioms.

OUTPUT FORMAT (strict):

OWS
(list of one-word substitutions — WORD<TAB>TRIGGER, trigger 1-3 words)

VOCAB
(list of vocabulary words — WORD<TAB>SYNONYM, synonym 1-2 words)

IDIOMS
(list of idioms — IDIOM : MEANING, meaning 1-3 words)

RULES:
- Each section header must be exactly: OWS, VOCAB, IDIOMS
- Skip a section if no entries found
- No extra text, no numbering, no explanations
- Trigger/synonym/meaning must be SHORT (max 3 words)

EXAMPLES:
OWS
Cynic\tHuman doubter
Pessimist\tBad outlook

VOCAB
Esteem\tRespect
Placid\tCalm

IDIOMS
Beat around the bush : Avoid topic
Piece of cake : Very easy

INPUT:
{INPUT}

OUTPUT:`;

const AUTO_PROMPT = `You are an expert SSC (Staff Selection Commission) exam vocabulary extractor.

Automatically detect and extract OWS, Vocabulary, and/or Idioms from the input.

Classify each item correctly:
- OWS (One Word Substitution): A single word that substitutes a phrase (e.g., Cynic = one who doubts human sincerity)
- VOCAB: Vocabulary word with its synonym (e.g., Esteem = Respect)
- IDIOM: Fixed phrase with figurative meaning (e.g., Piece of cake = Very easy)

OUTPUT FORMAT (strict):

OWS
WORD<TAB>TRIGGER (trigger: 1-3 words)

VOCAB
WORD<TAB>SYNONYM (synonym: 1-2 words)

IDIOMS
IDIOM : MEANING (meaning: 1-3 words)

Only include sections that have entries. No extra text.

INPUT:
{INPUT}

OUTPUT:`;

const OCR_EXTRACT_PROMPT = `You are an expert SSC exam vocabulary extractor with OCR capabilities.

First, extract all text from the image accurately.
Then, identify and extract OWS, Vocabulary, and Idioms from that text.

OUTPUT FORMAT (strict):

OCR_TEXT:
[The extracted text from the image]

---

OWS
WORD<TAB>TRIGGER (trigger: 1-3 words)

VOCAB
WORD<TAB>SYNONYM (synonym: 1-2 words)

IDIOMS
IDIOM : MEANING (meaning: 1-3 words)

Only include vocabulary sections that have entries. No extra text.`;

// ─── Gemini Service ───────────────────────────────────────────────────────────

const GEMINI_MODEL = 'gemini-3.5-flash';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiContent {
  parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }>;
}

async function callGemini(
  apiKey: string,
  contents: GeminiContent[],
  model = GEMINI_MODEL
): Promise<string> {
  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error?.error?.message || `Gemini API error: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ─── Text Extraction ──────────────────────────────────────────────────────────

export async function extractFromText(
  input: string,
  mode: Mode,
  apiKey: string
): Promise<string> {
  const promptMap: Record<Mode, string> = {
    ows: OWS_PROMPT,
    vocabulary: VOCAB_PROMPT,
    idioms: IDIOMS_PROMPT,
    mixed: MIXED_PROMPT,
    auto: AUTO_PROMPT,
  };

  const prompt = promptMap[mode].replace('{INPUT}', input.trim());
  const contents: GeminiContent[] = [{ parts: [{ text: prompt }] }];
  return callGemini(apiKey, contents);
}

// ─── Image OCR + Extraction ───────────────────────────────────────────────────

export interface ImageExtractionResult {
  ocrText: string;
  rawOutput: string;
}

export async function extractFromImage(
  base64Data: string,
  mimeType: string,
  apiKey: string
): Promise<ImageExtractionResult> {
  const contents: GeminiContent[] = [
    {
      parts: [
        { text: OCR_EXTRACT_PROMPT },
        { inline_data: { mime_type: mimeType, data: base64Data } },
      ],
    },
  ];

  const rawOutput = await callGemini(apiKey, contents);

  // Parse OCR text section
  const ocrMatch = rawOutput.match(/OCR_TEXT:\s*([\s\S]*?)(?:---|\n\n(?:OWS|VOCAB|IDIOMS))/i);
  const ocrText = ocrMatch ? ocrMatch[1].trim() : '';

  return { ocrText, rawOutput };
}

// ─── Parse Gemini Raw Output into Structured Entries ─────────────────────────

export function parseGeminiOutput(raw: string, defaultMode?: Mode): VocabEntry[] {
  const entries: VocabEntry[] = [];
  const now = new Date().toISOString();

  // Remove OCR section if present
  const cleaned = raw.replace(/OCR_TEXT:[\s\S]*?---\s*/i, '').trim();

  // Check if output has section headers (mixed/auto mode)
  const hasHeaders =
    /^(OWS|VOCAB|IDIOMS)\s*$/im.test(cleaned);

  if (hasHeaders) {
    // Parse sectioned output
    const sections = parseSections(cleaned);

    sections.ows.forEach((line) => {
      const entry = parseOwsOrVocabLine(line, 'OWS', now);
      if (entry) entries.push(entry);
    });

    sections.vocab.forEach((line) => {
      const entry = parseOwsOrVocabLine(line, 'VOCAB', now);
      if (entry) entries.push(entry);
    });

    sections.idioms.forEach((line) => {
      const entry = parseIdiomLine(line, now);
      if (entry) entries.push(entry);
    });
  } else {
    // Single-mode output
    const lines = cleaned.split('\n').map((l) => l.trim()).filter(Boolean);
    const category: Category =
      defaultMode === 'ows'
        ? 'OWS'
        : defaultMode === 'idioms'
        ? 'IDIOM'
        : 'VOCAB';

    lines.forEach((line) => {
      if (defaultMode === 'idioms') {
        const entry = parseIdiomLine(line, now);
        if (entry) entries.push(entry);
      } else {
        const entry = parseOwsOrVocabLine(line, category, now);
        if (entry) entries.push(entry);
      }
    });
  }

  return entries;
}

interface ParsedSections {
  ows: string[];
  vocab: string[];
  idioms: string[];
}

function parseSections(text: string): ParsedSections {
  const result: ParsedSections = { ows: [], vocab: [], idioms: [] };

  const lines = text.split('\n');
  let current: keyof ParsedSections | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (/^OWS$/i.test(trimmed)) { current = 'ows'; continue; }
    if (/^VOCAB(ULARY)?$/i.test(trimmed)) { current = 'vocab'; continue; }
    if (/^IDIOMS?$/i.test(trimmed)) { current = 'idioms'; continue; }

    if (current) {
      result[current].push(trimmed);
    }
  }

  return result;
}

function parseOwsOrVocabLine(
  line: string,
  category: Category,
  now: string
): VocabEntry | null {
  // Support tab or multiple spaces as separator
  const parts = line.split(/\t|  +/);
  if (parts.length >= 2) {
    const word = parts[0].trim();
    const trigger = parts.slice(1).join(' ').trim();
    if (word && trigger) {
      return { category, word, trigger, createdAt: now };
    }
  }
  // Fallback: try splitting on last space group
  const match = line.match(/^(.+?)\s{2,}(.+)$/);
  if (match) {
    return { category, word: match[1].trim(), trigger: match[2].trim(), createdAt: now };
  }
  return null;
}

function parseIdiomLine(line: string, now: string): VocabEntry | null {
  const idx = line.indexOf(' : ');
  if (idx > -1) {
    const word = line.substring(0, idx).trim();
    const trigger = line.substring(idx + 3).trim();
    if (word && trigger) {
      return { category: 'IDIOM', word, trigger, createdAt: now };
    }
  }
  // Fallback colon split
  const colonIdx = line.indexOf(':');
  if (colonIdx > -1) {
    const word = line.substring(0, colonIdx).trim();
    const trigger = line.substring(colonIdx + 1).trim();
    if (word && trigger) {
      return { category: 'IDIOM', word, trigger, createdAt: now };
    }
  }
  return null;
}
