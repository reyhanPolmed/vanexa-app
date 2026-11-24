-- Rooms: tempat publik peserta berkumpul untuk kuis bersama
CREATE TABLE rooms (
  id uuid PRIMARY KEY,
  host_id uuid NOT NULL REFERENCES hosts(id),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  category text NOT NULL CHECK (category IN ('TIU', 'TWK', 'TKP')),
  source_bank_id uuid NOT NULL REFERENCES question_banks(id),
  duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 5 AND 180),
  status text NOT NULL DEFAULT 'LOBBY' CHECK (status IN ('LOBBY', 'RUNNING', 'FINISHED', 'CLOSED')),
  question_count integer NOT NULL CHECK (question_count > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  deadline_at timestamptz,
  version integer NOT NULL DEFAULT 0
);
CREATE INDEX rooms_category_status_idx ON rooms(category, status);
CREATE INDEX rooms_host_id_idx ON rooms(host_id);

-- Snapshot soal Room: copy dari bank_questions saat Room dibuat
CREATE TABLE room_questions (
  id uuid PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position > 0),
  prompt text NOT NULL CHECK (char_length(prompt) > 0),
  options text[] NOT NULL CHECK (cardinality(options) = 5),
  scoring_type text NOT NULL CHECK (scoring_type IN ('SINGLE_CORRECT', 'WEIGHTED')),
  answer_key text,
  weights smallint[],
  explanation text NOT NULL DEFAULT '',
  UNIQUE(room_id, position),
  CHECK (
    (scoring_type = 'SINGLE_CORRECT' AND answer_key IN ('A','B','C','D','E')
     AND answer_key IS NOT NULL AND weights IS NULL)
    OR (scoring_type = 'WEIGHTED' AND answer_key IS NULL AND weights IS NOT NULL
     AND array_ndims(weights) = 1 AND array_lower(weights, 1) = 1 AND array_length(weights, 1) = 5
     AND array_position(weights, NULL) IS NULL AND 0 <= ALL(weights) AND 5 >= ALL(weights))
  )
);

-- Peserta Room: guest identity via token hash
CREATE TABLE participants (
  id uuid PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  nickname text NOT NULL CHECK (char_length(nickname) BETWEEN 1 AND 32),
  token_hash text NOT NULL,
  is_host boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX participants_room_id_idx ON participants(room_id);
CREATE UNIQUE INDEX participants_token_hash_idx ON participants(token_hash);
