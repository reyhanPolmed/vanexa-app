export const importLimits = {
  bytes: 5 * 1024 * 1024,
  pages: 50,
  questions: 200,
  textCharacters: 500_000,
  extractionMilliseconds: 15_000,
  draftHours: 24,
} as const;

export const letters = ["A", "B", "C", "D", "E"] as const;
export type Letter = typeof letters[number];
export type ImportIssue = { field: string; code: string; message: string };
export type PreviewQuestion = {
  sourceNumber: string;
  type: string;
  prompt: string;
  options: Partial<Record<Letter, string>>;
  key: string | null;
  weights: Partial<Record<Letter, number>>;
  explanation: string;
  rawText: string;
  errors: ImportIssue[];
};
export type ImportPreview = {
  templateVersion: "VANEXA-PDF-V1";
  category: string;
  bankName: string;
  questions: PreviewQuestion[];
  errors: ImportIssue[];
};

export class ImportFailure extends Error {
  constructor(public code: string, message: string, public status = 422) { super(message); }
}
