import { createServer, type IncomingMessage } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import { Pool, Client } from "pg";
import { database } from "../lib/db";
import { disconnectPresence, reconcileRoom, registerPresence, roomSnapshot, runMaintenance } from "../lib/room-lifecycle";
import type { EventEnvelope } from "../lib/realtime-events";

if (!process.env.DATABASE_URL) process.loadEnvFile(".env.local");
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");
const pool = new Pool({ connectionString, max: 5 });
pool.on("error", () => console.error("Realtime database connection unavailable."));
const serverId = randomUUID();
const subscriptions = new Map<string, Set<WebSocket>>();
type Subscription = { connectionId: string; participantId: string };
type Peer = WebSocket & { alive?: boolean; renewing?: boolean; request?: IncomingMessage; rooms?: Map<string, Subscription> };
let stopping = false;
let listenerReady = false;
let maintenanceRunning = false;
let maintenanceAt: number | null = null;
let finalizedRooms = 0;
let closedRooms = 0;
let listenClient: Client | null = null;

const httpServer = createServer((request, response) => {
  if (request.url !== "/health") { response.writeHead(404).end(); return; }
  const ready = listenerReady && maintenanceAt !== null && Date.now() - maintenanceAt < 10_000;
  response.writeHead(ready ? 200 : 503, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ status: ready ? "ok" : "reconnecting", maintenanceAt, finalizedRooms, closedRooms }));
});
const wss = new WebSocketServer({ server: httpServer, maxPayload: 2048 });
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

function cookies(header = "") {
  const result: Record<string, string> = {};
  for (const part of header.split(";")) {
    const [name, ...value] = part.trim().split("=");
    try { result[name] = decodeURIComponent(value.join("=")); } catch { /* malformed cookie is not an identity */ }
  }
  return result;
}

async function authorize(request: IncomingMessage, roomId: string) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(roomId)) return null;
  if (request.headers.origin && request.headers.origin !== process.env.APP_ORIGIN) return null;
  const jar = cookies(request.headers.cookie);
  if (/^[a-f0-9]{64}$/.test(jar.vanexa_host_session ?? "")) {
    const account = (await pool.query<{ id: string; nickname: string; is_host: boolean; host_authority: boolean }>("SELECT p.id,p.nickname,p.is_host,(r.host_id=s.host_id AND p.is_host) AS host_authority FROM participants p JOIN rooms r ON r.id=p.room_id JOIN host_sessions s ON s.host_id=p.account_id WHERE r.id=$1 AND s.token_hash=$2 AND s.expires_at>clock_timestamp()", [roomId, tokenHash(jar.vanexa_host_session)])).rows[0];
    if (account) return { id: account.id, nickname: account.nickname, isHost: account.is_host, hostAuthority: account.host_authority };
  }
  const token = jar[`vanexa_guest_${roomId}`];
  if (!/^[a-f0-9]{64}$/.test(token ?? "")) return null;
  const guest = (await pool.query<{ id: string; nickname: string; is_host: boolean }>("SELECT id,nickname,is_host FROM participants WHERE room_id=$1 AND token_hash=$2", [roomId, tokenHash(token)])).rows[0];
  return guest ? { id: guest.id, nickname: guest.nickname, isHost: guest.is_host, hostAuthority: false } : null;
}

async function subscribe(peer: Peer, roomId: string) {
  if (peer.rooms!.has(roomId)) return;
  const auth = await authorize(peer.request!, roomId);
  if (!auth) { peer.close(4403, "Forbidden"); return; }
  const subscription = { connectionId: randomUUID(), participantId: auth.id };
  // Install cleanup before awaiting registration; a closing connection is never left as a live lease.
  peer.rooms!.set(roomId, subscription);
  if (!subscriptions.has(roomId)) subscriptions.set(roomId, new Set());
  subscriptions.get(roomId)!.add(peer);
  await registerPresence(roomId, auth.id, subscription.connectionId, serverId, auth.hostAuthority);
  if (peer.readyState !== WebSocket.OPEN) {
    const subscribers = subscriptions.get(roomId);
    subscribers?.delete(peer);
    if (!subscribers?.size) subscriptions.delete(roomId);
    peer.rooms!.delete(roomId);
    await disconnectPresence(subscription.connectionId);
    return;
  }
  peer.send(JSON.stringify({ type: "subscribed", roomId, isHost: auth.isHost, nickname: auth.nickname }));
  const snapshot = await roomSnapshot(pool, roomId);
  if (snapshot && peer.readyState === WebSocket.OPEN) peer.send(JSON.stringify({ eventId: randomUUID(), type: "room.snapshot", roomId, roomVersion: snapshot.room.version, occurredAt: snapshot.serverNow, payload: snapshot }));
}

wss.on("connection", (peer: Peer, request) => {
  peer.alive = true;
  peer.request = request;
  peer.rooms = new Map();
  const pending = new Map<string, Promise<void>>();
  const connect = (roomId: string) => {
    if (pending.has(roomId)) return;
    const work = subscribe(peer, roomId).catch(() => { if (peer.readyState === WebSocket.OPEN) peer.close(1011, "Subscription unavailable"); });
    pending.set(roomId, work);
  };
  peer.on("pong", () => { peer.alive = true; });
  peer.on("error", () => {});
  peer.on("close", () => {
    for (const [roomId, membership] of peer.rooms!) {
      const room = subscriptions.get(roomId);
      room?.delete(peer);
      if (!room?.size) subscriptions.delete(roomId);
      void disconnectPresence(membership.connectionId).catch(() => {});
    }
  });
  try {
    const roomId = new URL(request.url ?? "/", "http://localhost").searchParams.get("roomId");
    if (roomId) connect(roomId);
  } catch { peer.close(1008, "Invalid subscription"); }
  peer.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());
      if (message.action === "subscribe" && typeof message.roomId === "string") connect(message.roomId);
      else if (message.action === "ping") peer.send(JSON.stringify({ type: "pong", time: Date.now() }));
    } catch { /* malformed payload is ignored */ }
  });
});

async function listen() {
  const client = new Client({ connectionString });
  listenClient = client;
  let retryScheduled = false;
  const retry = () => {
    listenerReady = false;
    if (retryScheduled || stopping) return;
    retryScheduled = true;
    void client.end().catch(() => {});
    setTimeout(() => { if (!stopping) void listen(); }, 2000).unref();
  };
  client.on("error", retry);
  client.on("end", retry);
  client.on("notification", (message) => {
    if (message.channel !== "vanexa_events" || !message.payload) return;
    try {
      const event = JSON.parse(message.payload) as EventEnvelope;
      for (const peer of subscriptions.get(event.roomId) ?? []) if (peer.readyState === WebSocket.OPEN) peer.send(JSON.stringify(event));
    } catch { /* only committed, well-formed envelopes are forwarded */ }
  });
  try { await client.connect(); await client.query("LISTEN vanexa_events"); listenerReady = true; }
  catch { retry(); }
}

async function maintain() {
  if (maintenanceRunning || stopping) return;
  maintenanceRunning = true;
  try { const result = await runMaintenance(); finalizedRooms += result.finished; closedRooms += result.closed; maintenanceAt = Date.now(); }
  catch { console.error("Room maintenance unavailable; retrying without changing deadlines."); }
  finally { maintenanceRunning = false; }
}

const heartbeat = setInterval(() => {
  for (const peer of wss.clients as Set<Peer>) {
    if (!peer.alive) { peer.terminate(); continue; }
    peer.alive = false;
    peer.ping();
    if (peer.renewing) continue;
    peer.renewing = true;
    void (async () => {
      for (const [roomId, membership] of peer.rooms ?? []) {
        const auth = await authorize(peer.request!, roomId);
        if (!auth) { peer.close(4403, "Forbidden"); break; }
        await registerPresence(roomId, membership.participantId, membership.connectionId, serverId, auth.hostAuthority);
        if (peer.readyState !== WebSocket.OPEN) await disconnectPresence(membership.connectionId);
      }
    })().catch(() => { peer.close(1011, "Presence unavailable"); }).finally(() => { peer.renewing = false; });
  }
}, 15_000);
const maintenance = setInterval(() => { void maintain(); }, 1000);

async function stop() {
  if (stopping) return;
  stopping = true;
  clearInterval(heartbeat); clearInterval(maintenance);
  for (const peer of wss.clients) peer.terminate();
  const rooms = (await pool.query<{ room_id: string }>("UPDATE presence_connections SET expires_at=clock_timestamp() WHERE server_id=$1 RETURNING room_id", [serverId])).rows;
  for (const roomId of new Set(rooms.map((row) => row.room_id))) await reconcileRoom(roomId);
  await listenClient?.end().catch(() => {});
  await pool.end(); await database().end();
  wss.close(); httpServer.close();
}
process.once("SIGTERM", () => { void stop().then(() => process.exit(0)); });
process.once("SIGINT", () => { void stop().then(() => process.exit(0)); });

void (async () => {
  await listen();
  await maintain();
  httpServer.listen(Number(process.env.WS_PORT ?? 3001), process.env.WS_HOST ?? "0.0.0.0", () => console.log("Vanexa WebSocket and room maintenance ready."));
})().catch(() => { console.error("Realtime service failed to start."); process.exit(1); });

export { httpServer, wss, pool, listenClient };
