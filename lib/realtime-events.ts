import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { database } from "./db";

export type EventType = "room.snapshot" | "participant.joined" | "participant.presence_changed" | "quiz.started" | "room.closed" | "room.deleted" | "quiz.finished" | "leaderboard.updated";
export type EventEnvelope<T = unknown> = { eventId: string; type: EventType; roomId: string; roomVersion: number; occurredAt: string; payload: T };

export async function publishRoomEvent<T>(client: PoolClient | null, event: { type: EventType; roomId: string; roomVersion: number; payload: T }): Promise<EventEnvelope<T>> {
  const envelope = { ...event, eventId: randomUUID(), occurredAt: new Date().toISOString() };
  // Send only invalidation/status metadata; NOTIFY has an 8 KiB payload limit.
  await (client ?? database()).query("SELECT pg_notify('vanexa_events', $1)", [JSON.stringify(envelope)]);
  return envelope;
}
