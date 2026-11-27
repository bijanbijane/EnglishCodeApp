export type CefrLevel = "PRE_A1" | "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export type VocabularyDifficulty = 1 | 2 | 3;
export type PartOfSpeech = "n" | "v" | "adj" | "adv" | "prep" | "conj" | "other";

export interface VocabularyEntry {
  word: string;
  sense: string;
  pos: PartOfSpeech;
  definition: string;
  level: VocabularyDifficulty;
  synonyms: string[];
  related?: string[];
  verified: boolean;
  note?: string;
}

export interface VocabularyDataset {
  meta: {
    title: string;
    version: string;
    license: string;
    language: "en";
  };
  entries: VocabularyEntry[];
}

export interface ErrorCorrectionRecord {
  id: string;
  category: string;
  cefr: CefrLevel;
  learner_sentence: string;
  corrected_sentence: string;
  explanation: string;
  practice_prompt: string;
  tags: string[];
}

export interface ErrorCorrectionFilter {
  cefr?: CefrLevel;
  category?: string;
  tag?: string;
  limit?: number;
}
