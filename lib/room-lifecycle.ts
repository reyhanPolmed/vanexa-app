import { database, transaction } from "./db";
import type { PoolClient, Pool } from "pg";
import { publishRoomEvent } from "./realtime-events";
import { scoreAttempt } from "./scoring";

export const presenceLeaseMilliseconds = 60_000;
export type LifecycleRoom = { id: string; status: string; deadline_at: Date | string | null; host_offline_since: Date | string | null; version: number; current_session_id: string | null };

export async function lockRoom(client: PoolClient, id: string) {
  return (await client.query<LifecycleRoom>("SELECT id, status, deadline_at, host_offline_since, version, current_session_id FROM rooms WHERE id=$1 FOR UPDATE", [id])).rows[0] ?? null;
}

export async function serverDeadlinePassed(client: PoolClient, roomId: string) {
  return (await client.query<{ passed: boolean }>("SELECT deadline_at IS NOT NULL AND clock_timestamp() >= deadline_at AS passed FROM rooms WHERE id=$1", [roomId])).rows[0]?.passed ?? false;
}

// Caller must hold the Room lock. All answer/submit writers lock Room before Attempt.
export async function finalizeRoomLocked(client: PoolClient, room: Pick<LifecycleRoom, "id" | "status" | "deadline_at" | "current_session_id">) {
  if (room.status !== "RUNNING" || !await serverDeadlinePassed(client, room.id)) return false;
  // Participants who never opened the quiz still get an unanswered Result.
  await client.query("INSERT INTO attempts(id,room_id,participant_id,status,session_id) SELECT gen_random_uuid(),room_id,id,'ACTIVE',$2 FROM participants WHERE room_id=$1 ON CONFLICT(session_id,participant_id) DO NOTHING", [room.id, room.current_session_id]);
  const attempts = (await client.query<{ id: string }>("SELECT id FROM attempts WHERE room_id=$1 AND session_id=$2 AND status='ACTIVE' ORDER BY id FOR UPDATE", [room.id, room.current_session_id])).rows;
  for (const attempt of attempts) {
    const score = await scoreAttempt(client, room.id, attempt.id);
    await client.query("UPDATE attempts SET status='EXPIRED', final_score=$1, submitted_at=$2 WHERE id=$3", [score.totalScore, room.deadline_at, attempt.id]);
  }
  const updated = (await client.query<{ version: number }>("UPDATE rooms SET status='FINISHED', version=version+1 WHERE id=$1 RETURNING version", [room.id])).rows[0];
  await client.query("UPDATE quiz_sessions SET status='FINISHED',finished_at=deadline_at WHERE id=$1", [room.current_session_id]);
  await publishRoomEvent(client, { type: "quiz.finished", roomId: room.id, roomVersion: updated.version, payload: { status: "FINISHED" } });
  await publishRoomEvent(client, { type: "leaderboard.updated", roomId: room.id, roomVersion: updated.version, payload: {} });
  return true;
}

async function reconcilePresenceLocked(client: PoolClient, room: LifecycleRoom) {
  const expired = (await client.query<{ participant_id: string; host_authority: boolean; expires_at: Date }>("DELETE FROM presence_connections WHERE room_id=$1 AND expires_at <= clock_timestamp() RETURNING participant_id,host_authority,expires_at", [room.id])).rows;
  const hostPresent = (await client.query<{ online: boolean }>("SELECT EXISTS(SELECT 1 FROM presence_connections WHERE room_id=$1 AND host_authority AND expires_at > clock_timestamp()) AS online", [room.id])).rows[0].online;
  // last_seen leases survive a process crash; an already-running grace is never reset.
  if (room.status === "LOBBY" && !hostPresent && !room.host_offline_since) {
    const expiredHost = expired.filter((lease) => lease.host_authority).map((lease) => lease.expires_at.getTime());
    const since = expiredHost.length ? new Date(Math.max(...expiredHost)) : null;
    const updated = (await client.query<{ host_offline_since: Date; version: number }>("UPDATE rooms SET host_offline_since=COALESCE($2::timestamptz,clock_timestamp()), version=version+1 WHERE id=$1 RETURNING host_offline_since,version", [room.id, since])).rows[0];
    room.host_offline_since = updated.host_offline_since;
    room.version = updated.version;
    await publishRoomEvent(client, { type: "participant.presence_changed", roomId: room.id, roomVersion: room.version, payload: { hostOfflineSince: updated.host_offline_since.toISOString() } });
  }
  for (const participantId of new Set(expired.map((row) => row.participant_id))) {
    const online = (await client.query<{ online: boolean }>("SELECT EXISTS(SELECT 1 FROM presence_connections WHERE participant_id=$1 AND expires_at>clock_timestamp()) AS online", [participantId])).rows[0].online;
    if (!online) {
      const updated = (await client.query<{ version: number }>("UPDATE rooms SET version=version+1 WHERE id=$1 RETURNING version", [room.id])).rows[0];
      room.version = updated.version;
      await publishRoomEvent(client, { type: "participant.presence_changed", roomId: room.id, roomVersion: room.version, payload: { participantId, online: false } });
    }
  }
}

export async function reconcileRoom(roomId: string) {
  return transaction(async (client) => {
    const room = await lockRoom(client, roomId);
    if (!room) return { finished: false, closed: false };
    const initialStatus = room.status;
    await reconcilePresenceLocked(client, room);
    const finished = await finalizeRoomLocked(client, room);
    return { finished, closed: initialStatus === "LOBBY" && room.status === "CLOSED" };
  });
}

export async function runMaintenance() {
  const rooms = (await database().query<{ id: string }>(
    `SELECT id FROM rooms WHERE (status='RUNNING' AND deadline_at<=clock_timestamp())
      OR EXISTS(SELECT 1 FROM presence_connections p WHERE p.room_id=rooms.id AND p.expires_at<=clock_timestamp())
      ORDER BY created_at, id LIMIT 100`,
  )).rows;
  let finished = 0, closed = 0;
  for (const room of rooms) {
    const result = await reconcileRoom(room.id);
    if (result.finished) finished++;
    if (result.closed) closed++;
  }
  return { processed: rooms.length, finished, closed };
}

export async function registerPresence(roomId: string, participantId: string, connectionId: string, serverId: string, hostAuthority: boolean) {
  return transaction(async (client) => {
    const room = await lockRoom(client, roomId);
    if (!room) return false;
    await reconcilePresenceLocked(client, room);
    await finalizeRoomLocked(client, room);
    const previous = (await client.query<{ online: boolean }>("SELECT EXISTS(SELECT 1 FROM presence_connections WHERE participant_id=$1 AND expires_at>clock_timestamp()) AS online", [participantId])).rows[0].online;
    await client.query("INSERT INTO presence_connections(id,server_id,room_id,participant_id,host_authority,expires_at) VALUES($1,$2,$3,$4,$5,clock_timestamp()+interval '60 seconds') ON CONFLICT(id) DO UPDATE SET expires_at=EXCLUDED.expires_at,host_authority=EXCLUDED.host_authority", [connectionId, serverId, roomId, participantId, hostAuthority]);
    if (!hostAuthority && room.status === "LOBBY") await reconcilePresenceLocked(client, room);
    const restoreHost = hostAuthority && room.status === "LOBBY" && room.host_offline_since !== null;
    if (restoreHost) await client.query("UPDATE rooms SET host_offline_since=NULL WHERE id=$1", [roomId]);
    if (!previous || restoreHost) {
      const updated = (await client.query<{ version: number }>("UPDATE rooms SET version=version+1 WHERE id=$1 RETURNING version", [roomId])).rows[0];
      await publishRoomEvent(client, { type: "participant.presence_changed", roomId, roomVersion: updated.version, payload: { participantId, online: true } });
    }
    return true;
  });
}

export async function disconnectPresence(connectionId: string) {
  const row = (await database().query<{ room_id: string }>("SELECT room_id FROM presence_connections WHERE id=$1", [connectionId])).rows[0];
  if (!row) return;
  await transaction(async (client) => {
    const room = await lockRoom(client, row.room_id);
    if (!room) return;
    // Mark the lease expired; reconciliation emits only the final-tab offline event.
    await client.query("UPDATE presence_connections SET expires_at=clock_timestamp() WHERE id=$1", [connectionId]);
    await reconcilePresenceLocked(client, room);
  });
}

export async function roomSnapshot(target: Pool | PoolClient, roomId: string) {
  type ParticipantRow = { id: string; nickname: string; isHost: boolean; joinedAt: string; online: boolean };
  const row = (await target.query<{ id: string; host_id: string; name: string; category: "TIU" | "TWK" | "TKP" | "RANDOM"; duration_minutes: number; status: "LOBBY" | "RUNNING" | "FINISHED" | "CLOSED"; question_count: number; created_at: Date; started_at: Date | null; deadline_at: Date | null; host_offline_since: Date | null; close_reason: string | null; version: number; current_session_id: string | null; host_username: string; server_now: Date; members: ParticipantRow[] }>(
    `SELECT r.*, h.username AS host_username, clock_timestamp() AS server_now,
       (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',p.id,'nickname',p.nickname,'isHost',p.is_host,'joinedAt',p.joined_at,'online',EXISTS(SELECT 1 FROM presence_connections c WHERE c.participant_id=p.id AND c.expires_at>clock_timestamp())) ORDER BY p.joined_at,p.id),'[]'::jsonb) FROM participants p WHERE p.room_id=r.id) AS members
       FROM rooms r JOIN hosts h ON h.id=r.host_id WHERE r.id=$1`, [roomId])).rows[0];
  if (!row) return null;
  return { room: { id: row.id, hostId: row.host_id, name: row.name, category: row.category, durationMinutes: row.duration_minutes, status: row.status, questionCount: row.question_count, createdAt: row.created_at.toISOString(), startedAt: row.started_at?.toISOString() ?? null, deadlineAt: row.deadline_at?.toISOString() ?? null, version: row.version, currentSessionId: row.current_session_id, hostUsername: row.host_username, hostOfflineSince: row.host_offline_since?.toISOString() ?? null, closeReason: row.close_reason }, participants: row.members.map(p=>({...p,joinedAt:new Date(p.joinedAt).toISOString()})), serverNow: row.server_now.toISOString() };
}
