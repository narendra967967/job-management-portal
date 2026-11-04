// Runs once when the server starts. Brings the admin knowledge base in line with
// docs/knowledge-base, so each environment answers from the docs it was
// deployed with. A failure is logged and never stops the server.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
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
