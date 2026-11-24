ALTER TABLE question_banks DROP CONSTRAINT question_banks_category_check;
ALTER TABLE question_banks ADD CONSTRAINT question_banks_category_check CHECK(category IN ('TIU','TWK','TKP','RANDOM'));
ALTER TABLE rooms DROP CONSTRAINT rooms_category_check;
ALTER TABLE rooms ADD CONSTRAINT rooms_category_check CHECK(category IN ('TIU','TWK','TKP','RANDOM'));

ALTER TABLE participants ADD COLUMN account_id uuid REFERENCES hosts(id) ON DELETE SET NULL;
UPDATE participants p SET account_id=r.host_id FROM rooms r WHERE p.room_id=r.id AND p.is_host;
CREATE UNIQUE INDEX participants_room_account_idx ON participants(room_id,account_id) WHERE account_id IS NOT NULL;

-- Rooms no longer expire when their Host goes offline. Preserve finished Attempts.
UPDATE rooms SET status='LOBBY', close_reason=NULL, version=version+1 WHERE status='CLOSED' AND close_reason='HOST_OFFLINE';
