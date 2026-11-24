import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate";
import { hashPassword } from "../lib/password";

export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || new URL(url).pathname !== "/vanexa_test") throw new Error("Use the dedicated vanexa_test database.");
  const pool = new Pool({ connectionString: url });
  try {
    // Fixture preparation only: never read back storage to assert application behavior.
    await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
    await migrate(url);
    await migrate(url); // Migration runner must also tolerate a repeated invocation.
    const passwordHash = await hashPassword("Practice-test-only-2026");
    for (const username of ["host_a", "host_b", "limited_host", "import_host", "confirm_host", "confirm_race", "confirm_owner", "room_host"]) {
      const hostId = randomUUID();
      await pool.query("INSERT INTO hosts (id, username, password_hash) VALUES ($1, $2, $3)", [hostId, username, passwordHash]);
      if (username === "host_a") await pool.query("INSERT INTO question_banks (id, owner_id, name, category) VALUES ($1, $2, $3, $4)", ["aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa", hostId, "Latihan TIU pribadi A", "TIU"]);
      if (username === "host_b") await pool.query("INSERT INTO question_banks (id, owner_id, name, category) VALUES ($1, $2, $3, $4)", ["bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb", hostId, "Latihan TWK pribadi B", "TWK"]);
      if (username === "import_host") await pool.query("INSERT INTO import_drafts (id, owner_id, file_name, page_count, preview, original_preview, expires_at) VALUES ($1, $2, 'expired.pdf', 1, '{}', '{}', now() - interval '1 minute')", ["cccccccc-cccc-4ccc-cccc-cccccccccccc", hostId]);
      if (username === "room_host") {
        const bankId = "11111111-1111-4111-1111-111111111111";
        await pool.query("INSERT INTO question_banks (id, owner_id, name, category) VALUES ($1, $2, $3, $4)", [bankId, hostId, "Bank Soal Room TIU", "TIU"]);
        await pool.query(
          `INSERT INTO bank_questions (id, bank_id, position, source_number, prompt, options, scoring_type, answer_key, explanation, source_text, fingerprint)
           VALUES ($1, $2, 1, '1', 'Berapakah 2 + 3?', ARRAY['4','5','6','7','8'], 'SINGLE_CORRECT', 'B', '2 + 3 = 5', 'QUESTION: 1\nTYPE: SINGLE_CORRECT\nPROMPT:\nBerapakah 2 + 3?\nA: 4\nB: 5\nC: 6\nD: 7\nE: 8\nKEY: B\nEXPLANATION:\n2 + 3 = 5.\n---END---', 'fp_tiu_1')`,
          [randomUUID(), bankId],
        );
        const emptyBankId = "22222222-2222-4222-2222-222222222222";
        await pool.query("INSERT INTO question_banks (id, owner_id, name, category) VALUES ($1, $2, $3, $4)", [emptyBankId, hostId, "Bank Kosong TIU", "TIU"]);

        const multiBankId = "33333333-3333-4333-3333-333333333333";
        await pool.query("INSERT INTO question_banks (id, owner_id, name, category) VALUES ($1, $2, $3, $4)", [multiBankId, hostId, "Bank Multi Soal TIU", "TIU"]);
        for (const [pos, prompt, options, key, explanation] of [
          [1, "Berapakah 2 + 3?", ["4", "5", "6", "7", "8"], "B", "2 + 3 = 5"],
          [2, "Berapakah 10 + 20?", ["10", "20", "30", "40", "50"], "C", "10 + 20 = 30"],
          [3, "Berapakah 7 x 8?", ["54", "56", "58", "60", "62"], "B", "7 x 8 = 56"],
        ] as const) {
          await pool.query(
            `INSERT INTO bank_questions (id, bank_id, position, source_number, prompt, options, scoring_type, answer_key, explanation, source_text, fingerprint)
             VALUES ($1, $2, $3, $4, $5, $6, 'SINGLE_CORRECT', $7, $8, $9, $10)`,
            [
              randomUUID(),
              multiBankId,
              pos,
              String(pos),
              prompt,
              options,
              key,
              explanation,
              `QUESTION: ${pos}\nTYPE: SINGLE_CORRECT\nPROMPT:\n${prompt}\nA: ${options[0]}\nB: ${options[1]}\nC: ${options[2]}\nD: ${options[3]}\nE: ${options[4]}\nKEY: ${key}\nEXPLANATION:\n${explanation}\n---END---`,
              `fp_multi_${pos}`,
            ],
          );
        }

        const weightedBankId = "44444444-4444-4444-4444-444444444444";
        await pool.query("INSERT INTO question_banks (id, owner_id, name, category) VALUES ($1, $2, $3, $4)", [weightedBankId, hostId, "Bank Soal Berbobot TKP", "TKP"]);
        await pool.query(
          `INSERT INTO bank_questions (id, bank_id, position, source_number, prompt, options, scoring_type, weights, explanation, source_text, fingerprint)
           VALUES ($1, $2, 1, '1', 'Bagaimana sikap Anda menghadapi rekan kerja yang terlambat?', ARRAY['Abaikan','Tegur keras','Tanyakan alasannya','Laporkan atasan','Ajak diskusi solutif'], 'WEIGHTED', ARRAY[1,2,3,4,5], 'Mengajak diskusi solutif bernilai paling tinggi.', 'QUESTION: 1\nTYPE: WEIGHTED\n...', 'fp_tkp_1')`,
          [randomUUID(), weightedBankId],
        );
        await pool.query(
          `INSERT INTO bank_questions (id, bank_id, position, source_number, prompt, options, scoring_type, weights, explanation, source_text, fingerprint)
           VALUES ($1, $2, 2, '2', 'Bagaimana respon Anda terhadap perubahan sistem kerja mendadak?', ARRAY['Sangat siap dan adaptif','Menyesuaikan perlahan','Menunggu instruksi','Mengeluh sebentar','Menolak perubahan'], 'WEIGHTED', ARRAY[5,4,3,2,1], '', 'QUESTION: 2\nTYPE: WEIGHTED\n...', 'fp_tkp_2')`,
          [randomUUID(), weightedBankId],
        );
      }
    }
    execFileSync(process.execPath, ["--import", "tsx", "scripts/create-host.ts"], {
      env: { ...process.env, DATABASE_URL: url, HOST_USERNAME: "empty_host", HOST_PASSWORD: "Practice-test-only-2026" },
      stdio: "pipe",
    });
  } finally { await pool.end(); }
}
