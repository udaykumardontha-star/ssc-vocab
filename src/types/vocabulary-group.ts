// ─── Vocabulary Group Types ───────────────────────────────────────────────────

export type WordType = 'RELATED' | 'OPPOSITE';

/**
 * A flat row as stored in the VOCAB_GROUPS Google Sheet.
 * Columns: GroupName | Word | Trigger | WordType | SourceWord | CreatedAt
 */
export interface VocabularyGroupWord {
  groupName: string;
  word: string;
  trigger: string;
  wordType: WordType;
  sourceWord: string;  // the VOCAB word that triggered group creation
  createdAt: string;
}

/**
 * A reconstructed vocabulary group (multiple sheet rows → one group object).
 */
export interface VocabularyGroup {
  groupName: string;
  trigger: string;       // shared trigger/theme of the group
  sourceWord: string;    // VOCAB word that triggered creation
  relatedWords: string[];
  oppositeWords: string[];
  createdAt: string;
}

/**
 * Raw JSON shape returned by Gemini for group generation.
 */
export interface GeminiGroupResponse {
  groupName: string;
  trigger: string;
  relatedWords: string[];
  oppositeWords: string[];
}
