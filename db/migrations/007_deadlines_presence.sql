ALTER TABLE rooms ADD COLUMN host_offline_since timestamptz DEFAULT now();
ALTER TABLE rooms ADD COLUMN close_reason text;
CREATE INDEX rooms_due_deadline_idx ON rooms(deadline_at) WHERE status = 'RUNNING';

CREATE TABLE presence_connections (
  id uuid PRIMARY KEY,
  server_id uuid NOT NULL,
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  host_authority boolean NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX presence_connections_room_idx ON presence_connections(room_id, expires_at);
CREATE INDEX presence_connections_server_idx ON presence_connections(server_id);
