import { config } from "dotenv";
config({ path: ".env.local" }); config();
import { Client } from "pg";
async function main(){const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();
if(process.argv[2]==="clean"){const r=await c.query("delete from support_tickets where email like '%@example.invalid'");console.log("cleaned:",r.rowCount);}
else{
  const rows=[
    ["Jane","t1@example.invalid","Login button not working","bug","open","/leads"],
    ["Raj","t2@example.invalid","How do I change my plan?","question","in_progress","/settings"],
    ["Mia","t3@example.invalid","Invoice missing GST","billing","open","contact"],
  ];
  for(const [name,email,subject,category,status,source] of rows){
    await c.query(`insert into support_tickets (name,email,subject,message,category,source,status) values ($1,$2,$3,$4,$5,$6,$7)`,[name,email,subject,`<p>${subject} — details here.</p>`,category,source,status]);
  }
  console.log("inserted 3 test tickets");
}
await c.end();}
main().catch(e=>{console.error(e);process.exit(1);});
