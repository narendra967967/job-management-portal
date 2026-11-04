// Runs once when the server starts. Brings the admin knowledge base in line with
// docs/knowledge-base, so each environment answers from the docs it was
// deployed with. A failure is logged and never stops the server.
//
// The import has to sit inside the NEXT_RUNTIME check, not after an early
// return: the production (webpack) build compiles this file for the edge
// runtime too, and only this form drops the database code from that bundle.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { syncKbFromRepo } = await import("./lib/kb-files");
      const r = await syncKbFromRepo();
      console.log(
        `knowledge base sync: ${r.added} added, ${r.updated} updated, ${r.removed} removed, ${r.unchanged} unchanged`,
      );
      for (const e of r.errors) console.warn(`knowledge base file skipped: ${e.file}: ${e.error}`);
    } catch (e) {
      console.error("knowledge base sync failed at startup", e);
    }
  }
}
