// One-off (VPS cutover, run on the AWS preprod box BEFORE dumping the DB):
// copy every S3-stored résumé into Postgres (resume_files) and repoint its row to
// blob_url = 'db', so a plain pg_dump carries the files off AWS. On the VPS,
// scripts/files-db-to-disk.mjs then moves them onto disk. Idempotent.
//
// Usage on the preprod box (repo root, box env):
//   docker run --rm --env-file .env -v "$PWD:/app" -w /app node:22-bookworm-slim \
//     bash -lc "npm ci --no-audit --no-fund && npx tsx db/resumes-s3-to-db.ts"

import { config } from "dotenv";
import { Pool } from "pg";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

config({ path: ".env.local" });
config();

async function main() {
  const url = process.env.DATABASE_URL;
  const bucket = process.env.S3_BUCKET;
  if (!url) throw new Error("DATABASE_URL is not set.");
  if (!bucket) throw new Error("S3_BUCKET is not set — nothing to copy.");

  const s3 = new S3Client({ region: process.env.S3_REGION || process.env.AWS_REGION || "ap-south-1" });
  const pool = new Pool({ connectionString: url });

  const { rows } = await pool.query<{ id: string; user_id: string; blob_url: string }>(
    `select id, user_id, blob_url from resumes
      where blob_url not in ('db', 'pending') and blob_url not like 'local:%'`,
  );
  console.log(`Found ${rows.length} S3-stored résumé(s).`);

  let copied = 0;
  for (const r of rows) {
    const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: r.blob_url }));
    const data = Buffer.from(await res.Body!.transformToByteArray());
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(
        `insert into resume_files (resume_id, user_id, content_type, data)
         values ($1, $2, $3, $4)
         on conflict (resume_id) do update set content_type = excluded.content_type, data = excluded.data`,
        [r.id, r.user_id, res.ContentType || "application/octet-stream", data],
      );
      await client.query("update resumes set blob_url = 'db' where id = $1", [r.id]);
      await client.query("commit");
      copied += 1;
    } catch (err) {
      await client.query("rollback");
      throw err;
    } finally {
      client.release();
    }
  }
  console.log(`Copied ${copied} file(s) into Postgres. S3 objects were left untouched.`);
  await pool.end();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
