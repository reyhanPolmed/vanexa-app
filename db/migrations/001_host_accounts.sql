CREATE TABLE hosts (
  id uuid PRIMARY KEY,
  username text NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9_]{3,32}$'),
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE host_sessions (
  token_hash text PRIMARY KEY,
  host_id uuid NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX host_sessions_host_id_idx ON host_sessions(host_id);

CREATE TABLE question_banks (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  category text NOT NULL CHECK (category IN ('TIU', 'TWK', 'TKP')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX question_banks_owner_id_idx ON question_banks(owner_id);

CREATE TABLE auth_attempts (
  bucket text PRIMARY KEY,
  attempts integer NOT NULL,
  reset_at timestamptz NOT NULL
);
