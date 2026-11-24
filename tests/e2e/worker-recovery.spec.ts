import { expect, test } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../../scripts/migrate";

test("persistent worker recovers overdue rooms and Host grace after restart without browsers", async () => {
  test.setTimeout(60_000);
  const base = process.env.TEST_DATABASE_URL;
  if (!base || new URL(base).pathname !== "/vanexa_test") throw new Error("Dedicated test database required.");
  const schema = "vanexa_recovery_worker";
  const admin = new Pool({ connectionString: base });
  const isolated = new URL(base);
  isolated.searchParams.set("options", `-c search_path=${schema}`);
  const pool = new Pool({ connectionString: isolated.toString() });
  let child: ChildProcess | undefined;
  const stop = async () => {
    if (!child || child.exitCode !== null) return;
    const ended = once(child, "exit");
    child.kill("SIGKILL"); // crash, deliberately skipping graceful lease cleanup
    await ended;
  };
  const start = async () => {
    child = spawn(process.execPath, ["--import", "tsx", "server/ws-server.ts"], {
      cwd: process.cwd(), windowsHide: true, stdio: "ignore",
      env: { ...process.env, DATABASE_URL: isolated.toString(), WS_HOST: "127.0.0.1", WS_PORT: "3123", APP_ORIGIN: "http://127.0.0.1:3100" },
    });
    await expect.poll(async () => {
      try { return (await fetch("http://127.0.0.1:3123/health")).status; } catch { return 0; }
    }, { timeout: 15_000 }).toBe(200);
  };
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(isolated.toString());
    const host = randomUUID(), bank = randomUUID(), running = randomUUID(), lobby = randomUUID(), question = randomUUID();
    const active = randomUUID(), submitted = randomUUID(), absent = randomUUID(), hostParticipant = randomUUID();
    const attempt = randomUUID(), submittedAttempt = randomUUID();
    await pool.query("INSERT INTO hosts(id,username,password_hash) VALUES($1,'worker_host','fixture-not-used-for-login')", [host]);
    await pool.query("INSERT INTO question_banks(id,owner_id,name,category) VALUES($1,$2,'Recovery bank','TIU')", [bank, host]);
    for (const [id, status] of [[running, "RUNNING"], [lobby, "LOBBY"]]) await pool.query("INSERT INTO rooms(id,host_id,name,category,source_bank_id,duration_minutes,status,question_count,started_at,deadline_at,host_offline_since) VALUES($1,$2,'Recovery','TIU',$3,5,$4,1,clock_timestamp(),clock_timestamp()+interval '5 minutes',NULL)", [id, host, bank, status]);
    await pool.query("INSERT INTO room_questions(id,room_id,position,prompt,options,scoring_type,answer_key) VALUES($1,$2,1,'Question',ARRAY['A','B','C','D','E'],'SINGLE_CORRECT','B')", [question, running]);
    for (const id of [active, submitted, absent]) await pool.query("INSERT INTO participants(id,room_id,nickname,token_hash) VALUES($1,$2,$3,$4)", [id, running, id.slice(0, 8), id]);
    await pool.query("INSERT INTO participants(id,room_id,nickname,token_hash,is_host) VALUES($1,$2,'Host',$3,true)", [hostParticipant, lobby, hostParticipant]);
    await pool.query("INSERT INTO attempts(id,room_id,participant_id) VALUES($1,$2,$3)", [attempt, running, active]);
    await pool.query("INSERT INTO answers(id,attempt_id,question_id,selected_option,last_mutation_id) VALUES($1,$2,$3,'B',$4)", [randomUUID(), attempt, question, randomUUID()]);
    await pool.query("INSERT INTO attempts(id,room_id,participant_id,status,submitted_at,final_score) VALUES($1,$2,$3,'SUBMITTED','2026-01-01T00:00:00Z',1)", [submittedAttempt, running, submitted]);
    await pool.query("INSERT INTO presence_connections(id,server_id,room_id,participant_id,host_authority,expires_at) VALUES($1,$2,$3,$4,true,clock_timestamp()+interval '1 minute')", [randomUUID(), randomUUID(), lobby, hostParticipant]);
    await start();
    expect((await (await fetch("http://127.0.0.1:3123/health")).json()).finalizedRooms).toBe(0);
    await stop();
    // Simulate downtime crossing both persisted deadlines; no application/API clients exist.
    await pool.query("UPDATE rooms SET deadline_at=clock_timestamp()-interval '1 minute' WHERE id=$1", [running]);
    await pool.query("UPDATE presence_connections SET expires_at=clock_timestamp()-interval '6 minutes'");
    await start();
    const health = await (await fetch("http://127.0.0.1:3123/health")).json();
    expect(health.finalizedRooms).toBe(1);
    expect(health.closedRooms).toBe(1);
    const rooms = (await pool.query("SELECT id,status,close_reason FROM rooms ORDER BY id")).rows;
    expect(rooms.find(row => row.id === running).status).toBe("FINISHED");
    expect(rooms.find(row => row.id === lobby)).toMatchObject({ status: "CLOSED", close_reason: "HOST_OFFLINE" });
    const results = (await pool.query("SELECT participant_id,status,final_score::float8 AS score,submitted_at FROM attempts ORDER BY participant_id")).rows;
    expect(results).toHaveLength(3);
    expect(results.find(row => row.participant_id === active)).toMatchObject({ status: "EXPIRED", score: 1 });
    expect(results.find(row => row.participant_id === absent)).toMatchObject({ status: "EXPIRED", score: 0 });
    expect(results.find(row => row.participant_id === submitted)).toMatchObject({ status: "SUBMITTED", score: 1, submitted_at: new Date("2026-01-01T00:00:00Z") });
    await stop(); await start();
    expect((await (await fetch("http://127.0.0.1:3123/health")).json()).finalizedRooms).toBe(0);
    expect((await pool.query("SELECT participant_id,status,final_score::float8 AS score,submitted_at FROM attempts ORDER BY participant_id")).rows).toEqual(results);
  } finally {
    await stop();
    await pool.end();
    // Constant schema, exclusively inside the disposable vanexa_test database.
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
});
