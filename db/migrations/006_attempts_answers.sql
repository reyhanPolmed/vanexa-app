-- Attempts: Pengerjaan kuis per peserta dalam sebuah room
CREATE TABLE attempts (
  id uuid PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUBMITTED', 'EXPIRED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  final_score numeric,
  UNIQUE(room_id, participant_id)
);
CREATE INDEX attempts_room_id_idx ON attempts(room_id);
CREATE INDEX attempts_participant_id_idx ON attempts(participant_id);

-- Answers: Jawaban peserta untuk setiap soal dalam sebuah attempt
CREATE TABLE answers (
  id uuid PRIMARY KEY,
  attempt_id uuid NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES room_questions(id) ON DELETE CASCADE,
  selected_option text CHECK (selected_option IS NULL OR selected_option IN ('A', 'B', 'C', 'D', 'E')),
  revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  last_mutation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(attempt_id, question_id)
);
CREATE INDEX answers_attempt_id_idx ON answers(attempt_id);
CREATE INDEX answers_question_id_idx ON answers(question_id);
