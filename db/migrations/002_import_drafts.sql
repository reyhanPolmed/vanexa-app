CREATE TABLE import_drafts (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  page_count integer NOT NULL CHECK (page_count BETWEEN 1 AND 50),
  preview jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours'
);
CREATE INDEX import_drafts_owner_idx ON import_drafts(owner_id);
CREATE INDEX import_drafts_expiry_idx ON import_drafts(expires_at);
