ALTER TABLE question_banks ADD COLUMN revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0);
ALTER TABLE question_banks ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE bank_questions (
  id uuid PRIMARY KEY,
  bank_id uuid NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position > 0),
  source_number text NOT NULL CHECK (source_number ~ '^[1-9][0-9]*$'),
  prompt text NOT NULL CHECK (char_length(prompt) > 0),
  options text[] NOT NULL CHECK (
    array_ndims(options) = 1 AND array_lower(options, 1) = 1 AND array_length(options, 1) = 5
    AND array_position(options, NULL) IS NULL
    AND char_length(options[1]) > 0 AND char_length(options[2]) > 0
    AND char_length(options[3]) > 0 AND char_length(options[4]) > 0 AND char_length(options[5]) > 0
  ),
  scoring_type text NOT NULL CHECK (scoring_type IN ('SINGLE_CORRECT', 'WEIGHTED')),
  answer_key text,
  weights smallint[],
  explanation text NOT NULL DEFAULT '',
  source_text text NOT NULL,
  fingerprint text NOT NULL,
  UNIQUE(bank_id, position),
  CHECK (
    (scoring_type = 'SINGLE_CORRECT' AND answer_key IN ('A','B','C','D','E') AND answer_key IS NOT NULL AND weights IS NULL)
    OR (scoring_type = 'WEIGHTED' AND answer_key IS NULL AND weights IS NOT NULL
      AND array_ndims(weights) = 1 AND array_lower(weights, 1) = 1 AND array_length(weights, 1) = 5
      AND array_position(weights, NULL) IS NULL AND 0 <= ALL(weights) AND 5 >= ALL(weights))
  )
);
CREATE INDEX bank_questions_fingerprint_idx ON bank_questions(fingerprint);

ALTER TABLE import_drafts ADD COLUMN original_preview jsonb;
UPDATE import_drafts SET original_preview = preview;
ALTER TABLE import_drafts ALTER COLUMN original_preview SET NOT NULL;
ALTER TABLE import_drafts ADD COLUMN edit_state jsonb;
ALTER TABLE import_drafts ADD COLUMN revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0);
ALTER TABLE import_drafts ADD COLUMN confirmed_bank_id uuid REFERENCES question_banks(id);
ALTER TABLE import_drafts ADD COLUMN confirmation_key uuid;
ALTER TABLE import_drafts ADD COLUMN confirmed_revision integer;
ALTER TABLE import_drafts ADD CHECK (
  (confirmed_bank_id IS NULL AND confirmation_key IS NULL AND confirmed_revision IS NULL)
  OR (confirmed_bank_id IS NOT NULL AND confirmation_key IS NOT NULL AND confirmed_revision IS NOT NULL)
);
