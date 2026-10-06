import { config } from "dotenv";
config({ path: ".env.local" }); config();
import { Client } from "pg";
async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const u = (await c.query(`select id from "user" where email=$1`, ["narendragpt967967@gmail.com"])).rows[0];
  if (!u) { console.log("user not found"); await c.end(); return; }
  if (process.argv[2] === "clean") {
    const r = await c.query("delete from notifications where user_id=$1 and type='lead-purge'", [u.id]);
    console.log("deleted test notifications:", r.rowCount);
  } else {
    await c.query(
      `insert into notifications (user_id, type, title, body) values ($1,'lead-purge',$2,$3)`,
      [u.id, "Old leads cleared", "3 old leads removed (2 Discarded, 1 Closed) as part of routine database cleanup. Preset policy: leads marked Discarded, Closed with no activity for 90+ days are removed automatically — no action needed."],
    );
    console.log("inserted test notification for", u.id);
  }
  await c.end();
}
main().catch(e=>{console.error(e);process.exit(1);});
