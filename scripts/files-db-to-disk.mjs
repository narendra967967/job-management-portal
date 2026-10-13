// One-off (VPS cutover): move résumé bytes stored in Postgres (resume_files, rows
// with blob_url = 'db') onto disk under UPLOADS_DIR, repoint blob_url at the file
// ('local:<key>'), and drop the DB copy. Idempotent — safe to re-run.
//
// Runs INSIDE the app image (so it writes into the app's uploads volume):
//   docker compose run --rm app-preprod node scripts/files-db-to-disk.mjs

import pg from "pg";
import { promises as fs } from "node:fs";
import path from "node:path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
const base = path.resolve(process.env.UPLOADS_DIR || "/data/uploads");
const pool = new pg.Pool({ connectionString: url });

let moved = 0;
try {
  const { rows } = await pool.query(
    `select r.id, r.user_id, r.file_type, f.data
       from resumes r join resume_files f on f.resume_id = r.id
      where r.blob_url = 'db'`,
  );
  for (const r of rows) {
    const key = `resumes/${r.user_id}/${r.id}.${r.file_type}`;
    const full = path.resolve(base, key);
    if (!full.startsWith(base + path.sep)) throw new Error(`Unsafe key for résumé ${r.id}`);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, r.data, { mode: 0o640 });
    const { size } = await fs.stat(full);
    if (size !== r.data.length) throw new Error(`Size mismatch writing résumé ${r.id}`);

    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("update resumes set blob_url = $1 where id = $2", [`local:${key}`, r.id]);
      await client.query("delete from resume_files where resume_id = $1", [r.id]);
      await client.query("commit");
    } catch (err) {
      await client.query("rollback");
      throw err;
    } finally {
      client.release();
    }
    moved += 1;
  }
  console.log(`Moved ${moved} résumé file(s) to ${base}.`);
} catch (err) {
  console.error("Failed:", err instanceof Error ? err.message : err, `(moved ${moved} before the error)`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
