"use client";

import { useEffect, useRef, useState } from "react";
import type { roomSnapshot } from "@/lib/room-lifecycle";

export type RoomSnapshot = NonNullable<Awaited<ReturnType<typeof roomSnapshot>>>;

export function useRoomSync(roomId: string, enabled: boolean, initialVersion: number, onSnapshot: (snapshot: RoomSnapshot) => void, onEvent?: (type: string) => void, wsUrl?: string) {
  const callbacks = useRef({ onSnapshot, onEvent });
  useEffect(() => { callbacks.current = { onSnapshot, onEvent }; }, [onSnapshot, onEvent]);
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let forbidden = false;
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let backoff = 1000;
    let version = initialVersion;
    let requestNumber = 0;
    let appliedRequest = 0;
    const seen = new Set<string>();
    const controllers = new Set<AbortController>();
    function deleted() {
      forbidden = true;
      socket?.close();
      window.location.assign("/");
    }
    async function refresh() {
      if (stopped || forbidden) return;
      const sequence = ++requestNumber;
      const controller = new AbortController();
      controllers.add(controller);
      try {
        const response = await fetch(`/api/rooms/${roomId}`, { cache: "no-store", signal: controller.signal });
        if (!stopped && response.status === 404) { deleted(); return; }
        if (!response.ok) return;
        const snapshot: RoomSnapshot = await response.json();
        if (stopped || sequence < appliedRequest || snapshot.room.version < version) return;
        appliedRequest = sequence;
        version = snapshot.room.version;
        callbacks.current.onSnapshot(snapshot);
      } catch { /* reconnect/polling retries against authoritative database state */ }
      finally { controllers.delete(controller); }
    }
    function schedule() {
      if (stopped || forbidden) return;
      retry = setTimeout(connect, Math.round(backoff * (0.8 + Math.random() * 0.4)));
      backoff = Math.min(backoff * 2, 30_000);
    }
    function connect() {
      if (stopped || forbidden) return;
      try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const base = wsUrl || process.env.NEXT_PUBLIC_WS_URL || `${protocol}//${window.location.hostname}:3001`;
      const url = new URL(base);
      url.searchParams.set("roomId", roomId);
      socket = new WebSocket(url);
      socket.onopen = () => { backoff = 1000; setConnected(true); void refresh(); };
      socket.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data);
          if (event.type === "subscribed") { void refresh(); return; }
          if (event.roomId !== roomId) return;
          if (event.eventId) {
            if (seen.has(event.eventId)) return;
            seen.add(event.eventId);
            if (seen.size > 256) seen.delete(seen.values().next().value!);
          }
          if (!Number.isInteger(event.roomVersion) || event.roomVersion < version) return;
          if (event.type === "room.deleted") { deleted(); return; }
          if (event.type === "room.snapshot" && event.payload?.room && event.payload.room.version >= version) {
            version = event.payload.room.version;
            callbacks.current.onSnapshot(event.payload);
          } else {
            // Full resync also handles version gaps; never reconstruct missing deltas.
            void refresh();
          }
          callbacks.current.onEvent?.(event.type);
        } catch { /* malformed envelopes never replace server state */ }
      };
      socket.onclose = (event) => {
        if (stopped) return;
        setConnected(false);
        forbidden = forbidden || event.code === 4403 || event.code === 4401;
        schedule();
      };
      socket.onerror = () => socket?.close();
      } catch { schedule(); }
    }
    const online = () => { void refresh(); };
    window.addEventListener("online", online);
    const poll = setInterval(() => { void refresh(); callbacks.current.onEvent?.("resync"); }, 10_000);
    connect();
    void refresh();
    return () => {
      stopped = true;
      clearTimeout(retry); clearInterval(poll);
      window.removeEventListener("online", online);
      for (const controller of controllers) controller.abort();
      socket?.close();
    };
  }, [roomId, enabled, wsUrl, initialVersion]);
  return connected;
}
