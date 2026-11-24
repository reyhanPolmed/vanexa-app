CREATE TABLE quiz_sessions (
  id uuid PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES rooms(id),
  number integer NOT NULL,
  status text NOT NULL CHECK(status IN ('RUNNING','FINISHED')),
  started_at timestamptz NOT NULL,
  deadline_at timestamptz NOT NULL,
  finished_at timestamptz,
  UNIQUE(room_id,number)
);
INSERT INTO quiz_sessions(id,room_id,number,status,started_at,deadline_at,finished_at)
SELECT gen_random_uuid(),r.id,1,CASE WHEN r.status='RUNNING' THEN 'RUNNING' ELSE 'FINISHED' END,
  COALESCE(r.started_at,r.created_at),COALESCE(r.deadline_at,r.created_at+r.duration_minutes*interval '1 minute'),
  CASE WHEN r.status='RUNNING' THEN NULL ELSE COALESCE(r.deadline_at,r.created_at) END
FROM rooms r WHERE r.started_at IS NOT NULL OR EXISTS(SELECT 1 FROM attempts a WHERE a.room_id=r.id);
ALTER TABLE rooms ADD COLUMN current_session_id uuid REFERENCES quiz_sessions(id);
UPDATE rooms r SET current_session_id=s.id FROM quiz_sessions s WHERE s.room_id=r.id;
ALTER TABLE attempts ADD COLUMN session_id uuid REFERENCES quiz_sessions(id);
UPDATE attempts a SET session_id=r.current_session_id FROM rooms r WHERE r.id=a.room_id;
ALTER TABLE attempts ALTER COLUMN session_id SET NOT NULL;
ALTER TABLE attempts DROP CONSTRAINT attempts_room_id_participant_id_key;
ALTER TABLE attempts ADD CONSTRAINT attempts_session_participant_key UNIQUE(session_id,participant_id);
CREATE INDEX quiz_sessions_room_idx ON quiz_sessions(room_id,number DESC);
