import "server-only";
import { cookies } from "next/headers";
import { currentHost } from "./auth";
import { database } from "./db";
import { isUuid } from "./mutations";
import { participantTokenHash, RoomError } from "./rooms";
import { reconcileRoom } from "./room-lifecycle";

export type LeaderboardEntry = { participantId: string; nickname: string; status: "ACTIVE" | "SUBMITTED" | "EXPIRED" | "WAITING"; score: number | null; rank: number | null };
export type LeaderboardData = { roomId: string; final: boolean; version: number; entries: LeaderboardEntry[] };

export async function getLeaderboard(roomId: string): Promise<LeaderboardData> {
  if (!isUuid(roomId)) throw new RoomError("ROOM_NOT_FOUND", "Room tidak ditemukan.", 404);
  const host = await currentHost();
  const guestToken = (await cookies()).get(`vanexa_guest_${roomId}`)?.value;
  const access = (await database().query<{ allowed: boolean }>("SELECT (host_id=$2::uuid OR EXISTS(SELECT 1 FROM participants WHERE room_id=$1 AND (account_id=$2::uuid OR token_hash=$3))) AS allowed FROM rooms WHERE id=$1", [roomId, host?.id ?? null, guestToken ? participantTokenHash(guestToken) : null])).rows[0];
  if (!access) throw new RoomError("ROOM_NOT_FOUND", "Room tidak ditemukan.", 404);
  if (!access.allowed) throw new RoomError("UNAUTHORIZED", "Leaderboard hanya untuk Host dan peserta room.", 401);
  await reconcileRoom(roomId);
  const row = (await database().query<{ status: string; version: number; entries: LeaderboardEntry[] }>(
    `WITH ranked AS (
       SELECT participant_id, final_score, RANK() OVER(ORDER BY final_score DESC) AS rank
       FROM attempts WHERE room_id=$1 AND session_id=(SELECT current_session_id FROM rooms WHERE id=$1) AND status IN ('SUBMITTED','EXPIRED') AND final_score IS NOT NULL
     )
     SELECT r.status,r.version,
       (SELECT COALESCE(jsonb_agg(jsonb_build_object('participantId',p.id,'nickname',p.nickname,'status',COALESCE(a.status,'WAITING'),'score',f.final_score,'rank',f.rank) ORDER BY f.rank NULLS LAST,p.joined_at,p.id),'[]'::jsonb)
        FROM participants p LEFT JOIN attempts a ON a.room_id=p.room_id AND a.participant_id=p.id AND a.session_id=r.current_session_id LEFT JOIN ranked f ON f.participant_id=p.id WHERE p.room_id=r.id) AS entries
     FROM rooms r WHERE r.id=$1`, [roomId],
  )).rows[0];
  return { roomId, final: row.status === "FINISHED", version: row.version, entries: row.entries };
}
