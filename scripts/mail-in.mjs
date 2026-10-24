// Jobtiva mail receiver — accepts forwarded job alerts over SMTP and hands them
// to the app (spec: docs/email-forwarding.md §6).
//
//   Gmail ──SMTP:25──► this process (port 2525 in the container)
//     RCPT  → cheap checks (route, token shape, rate caps) → ask the app
//             (/api/inbound/recipient) → 250 / 451 / 550. Unknown addresses
//             are refused before any body is sent.
//     DATA  → stream to a disk spool → 250 at once (no parsing on the connection).
//   dispatcher → POST each spooled message to the app (/api/inbound/email) with
//             fixed low concurrency, retry with backoff, delete when done.
//
// Never relays, never sends mail, never logs addresses or bodies. Back-pressure:
// when the spool is full or the app is down, senders get 451 and retry later on
// their own schedule, so bursts and retries never pile onto the web app.
//
// Env:
//   INBOUND_SECRET     bearer secret shared with the app(s) (≥ 32 chars)
//   INBOUND_ROUTES     receiving-domain=app-url pairs, comma separated, e.g.
//                      in.jobtiva.in=http://app-prod:3000,in.preprod.jobtiva.in=http://app-preprod:3000
//   INBOUND_PORT       default 2525
//   INBOUND_SPOOL      spool directory, default ./.mail-spool
//   INBOUND_HOSTNAME   name in the greeting, default the first route's domain
//   INBOUND_TLS_KEY / INBOUND_TLS_CERT   PEM paths; STARTTLS is offered when both exist

import { SMTPServer } from "smtp-server";
import { createWriteStream, existsSync, readFileSync } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { pipeline } from "node:stream/promises";

/* ---------------- config ---------------- */

const SECRET = process.env.INBOUND_SECRET ?? "";
if (SECRET.length < 32) {
  console.error("[mail-in] INBOUND_SECRET must be set (≥ 32 chars).");
  process.exit(1);
}

/** receiving domain → app base URL */
const ROUTES = new Map(
  (process.env.INBOUND_ROUTES ?? "")
    .split(",")
    .map((pair) => pair.trim().split("="))
    .filter(([d, u]) => d && u)
    .map(([d, u]) => [d.trim().toLowerCase(), u.trim().replace(/\/+$/, "")]),
);
if (!ROUTES.size) {
  console.error("[mail-in] INBOUND_ROUTES is empty (domain=url,...).");
  process.exit(1);
}

const PORT = Number(process.env.INBOUND_PORT ?? 2525);
const SPOOL = path.resolve(process.env.INBOUND_SPOOL ?? ".mail-spool");
const HOSTNAME = process.env.INBOUND_HOSTNAME ?? [...ROUTES.keys()][0];

const MAX_MESSAGE_BYTES = 10 * 1024 * 1024 + 64 * 1024; // app max (10 MB) + header slack
const MAX_CLIENTS = 50; // simultaneous connections
const MAX_RECIPIENTS = 5; // per message (Gmail forwarding sends one)
const SOCKET_TIMEOUT_MS = 30_000; // idle
const SESSION_MAX_MS = 5 * 60_000; // total per connection
const PER_IP_CONNECTIONS_PER_MIN = 120;
const PER_IP_CONCURRENT = 10;
const PER_TOKEN_MESSAGES_PER_HOUR = 60;
const SPOOL_MAX_FILES = 1000;
const SPOOL_MAX_BYTES = 256 * 1024 * 1024;
const SPOOL_MAX_AGE_MS = 24 * 60 * 60_000;
const DISPATCH_CONCURRENCY = 2;
const DISPATCH_TICK_MS = 1_000;
const RECIPIENT_TIMEOUT_MS = 5_000;
const DISPATCH_TIMEOUT_MS = 60_000;
const RETRY_STEPS_MS = [30_000, 60_000, 120_000, 300_000, 600_000, 1_800_000, 3_600_000];

const TOKEN_RE = /^[a-km-np-z2-9]{12}$/; // shape of lib/email-intake-data.ts newToken()

const log = (...args) => console.log("[mail-in]", ...args);

/* ---------------- small helpers ---------------- */

/** "::ffff:1.2.3.4" (IPv4 seen on a dual-stack socket) → "1.2.3.4", so rate
 *  limits and fail2ban (deploy/vps/fail2ban) see one form per client. */
function clientIp(addr) {
  return String(addr ?? "?").replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/i, "");
}

function smtpError(code, message) {
  const err = new Error(message);
  err.responseCode = code;
  return err;
}

/** "<token>@<domain>" → { token, domain } (lowercased), or null */
function splitAddress(address) {
  const a = String(address ?? "").trim().toLowerCase();
  const at = a.lastIndexOf("@");
  return at < 1 ? null : { token: a.slice(0, at), domain: a.slice(at + 1) };
}

async function postJson(url, body, timeoutMs) {
  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${SECRET}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Sliding-window counters, pruned periodically (memory stays bounded). */
class RateCounter {
  constructor(windowMs) {
    this.windowMs = windowMs;
    this.hits = new Map();
  }
  /** Records a hit; returns how many hits this key has in the window. */
  hit(key) {
    const now = Date.now();
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    list.push(now);
    this.hits.set(key, list);
    return list.length;
  }
  prune() {
    const now = Date.now();
    for (const [key, list] of this.hits) {
      const kept = list.filter((t) => now - t < this.windowMs);
      if (kept.length) this.hits.set(key, kept);
      else this.hits.delete(key);
    }
  }
}

const ipConnections = new RateCounter(60_000);
const tokenMessages = new RateCounter(60 * 60_000);
const ipOpen = new Map(); // ip → open connections

/* ---------------- spool ---------------- */
// Each queued delivery is <id>.eml (raw bytes) + <id>.json (meta). The meta is
// written last via rename, so a crash mid-write never leaves a half entry queued.

/** id → { id, recipient, url, receivedAt, attempts, nextAt, bytes } */
const queue = new Map();
const inFlight = new Set();
let spoolBytes = 0;

const emlPath = (id) => path.join(SPOOL, `${id}.eml`);
const metaPath = (id) => path.join(SPOOL, `${id}.json`);

async function writeMeta(entry) {
  const tmp = `${metaPath(entry.id)}.tmp`;
  await writeFile(tmp, JSON.stringify(entry));
  await rename(tmp, metaPath(entry.id));
}

async function removeEntry(id) {
  const entry = queue.get(id);
  queue.delete(id);
  if (entry) spoolBytes -= entry.bytes;
  await rm(metaPath(id), { force: true });
  await rm(emlPath(id), { force: true });
}

const spoolFull = () => queue.size >= SPOOL_MAX_FILES || spoolBytes >= SPOOL_MAX_BYTES;

async function loadSpool() {
  await mkdir(SPOOL, { recursive: true });
  const names = await readdir(SPOOL);
  for (const name of names) {
    const full = path.join(SPOOL, name);
    if (name.endsWith(".tmp") || name.endsWith(".part")) {
      await rm(full, { force: true }); // interrupted writes
      continue;
    }
    if (!name.endsWith(".json")) continue;
    try {
      const entry = JSON.parse(await readFile(full, "utf8"));
      if (!existsSync(emlPath(entry.id))) throw new Error("missing body");
      queue.set(entry.id, entry);
      spoolBytes += entry.bytes;
    } catch {
      await rm(full, { force: true });
    }
  }
  // Bodies whose meta never got written (crash between the two writes).
  for (const name of names) {
    if (name.endsWith(".eml") && !queue.has(name.slice(0, -4))) await rm(path.join(SPOOL, name), { force: true });
  }
  if (queue.size) log(`resumed ${queue.size} spooled message(s)`);
}

/* ---------------- dispatcher ---------------- */

async function deliver(entry) {
  const raw = await readFile(emlPath(entry.id));
  const res = await fetch(`${entry.url}/api/inbound/email`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${SECRET}`,
      "content-type": "message/rfc822",
      "x-inbound-recipient": entry.recipient,
    },
    body: raw,
    signal: AbortSignal.timeout(DISPATCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const outcome = await res.json();
  return Number(outcome?.code);
}

async function dispatchOne(entry) {
  inFlight.add(entry.id);
  try {
    let code;
    try {
      code = await deliver(entry);
    } catch (err) {
      code = 0;
      log(`dispatch error (${entry.id.slice(0, 8)}): ${err instanceof Error ? err.message : err}`);
    }
    if (code === 250 || code === 550) {
      await removeEntry(entry.id);
      return;
    }
    // 451 or unreachable app → back off and keep it.
    entry.attempts += 1;
    entry.nextAt = Date.now() + RETRY_STEPS_MS[Math.min(entry.attempts - 1, RETRY_STEPS_MS.length - 1)];
    await writeMeta(entry).catch(() => {});
  } finally {
    inFlight.delete(entry.id);
  }
}

async function tick() {
  const now = Date.now();
  for (const entry of queue.values()) {
    if (inFlight.size >= DISPATCH_CONCURRENCY) break;
    if (inFlight.has(entry.id)) continue;
    if (now - entry.receivedAt > SPOOL_MAX_AGE_MS) {
      log(`dropped a message after 24 h of retries (${entry.attempts} attempts)`);
      await removeEntry(entry.id);
      continue;
    }
    if (entry.nextAt <= now) void dispatchOne(entry);
  }
}

/* ---------------- SMTP ---------------- */

const tlsKey = process.env.INBOUND_TLS_KEY;
const tlsCert = process.env.INBOUND_TLS_CERT;
const tls = tlsKey && tlsCert && existsSync(tlsKey) && existsSync(tlsCert)
  ? { key: readFileSync(tlsKey), cert: readFileSync(tlsCert) }
  : null;
if (!tls) log("no TLS certificate configured — STARTTLS is not offered");

const server = new SMTPServer({
  name: HOSTNAME,
  banner: "Jobtiva inbound",
  ...(tls ?? {}),
  hideSTARTTLS: !tls,
  disabledCommands: tls ? ["AUTH"] : ["AUTH", "STARTTLS"],
  authOptional: true,
  disableReverseLookup: true, // no DNS work per connection
  logger: false,
  size: MAX_MESSAGE_BYTES,
  rejectOversized: true,
  maxClients: MAX_CLIENTS,
  maxRecipients: MAX_RECIPIENTS,
  socketTimeout: SOCKET_TIMEOUT_MS,
  closeTimeout: 10_000,

  onConnect(session, callback) {
    const ip = clientIp(session.remoteAddress);
    if (ipConnections.hit(ip) > PER_IP_CONNECTIONS_PER_MIN || (ipOpen.get(ip) ?? 0) >= PER_IP_CONCURRENT) {
      log(`throttled ip=${ip}`);
      return callback(smtpError(421, "Too many connections, try again later"));
    }
    ipOpen.set(ip, (ipOpen.get(ip) ?? 0) + 1);
    session.counted = true;
    session.deadline = setTimeout(() => {
      for (const conn of server.connections) if (conn.session === session) conn.close();
    }, SESSION_MAX_MS);
    callback();
  },

  onClose(session) {
    clearTimeout(session.deadline);
    if (!session.counted) return;
    const ip = clientIp(session.remoteAddress);
    const n = (ipOpen.get(ip) ?? 1) - 1;
    if (n > 0) ipOpen.set(ip, n);
    else ipOpen.delete(ip);
  },

  onMailFrom(_address, _session, callback) {
    if (spoolFull()) return callback(smtpError(451, "Busy, try again later"));
    callback();
  },

  async onRcptTo(address, session, callback) {
    const parts = splitAddress(address.address);
    const url = parts && ROUTES.get(parts.domain);
    // Not one of our domains → never relay. Wrong token shape → no app call needed.
    if (!url) return callback(smtpError(550, "Relay access denied"));
    if (!TOKEN_RE.test(parts.token)) return callback(smtpError(550, "No such recipient"));
    if (tokenMessages.hit(`${parts.domain}/${parts.token}`) > PER_TOKEN_MESSAGES_PER_HOUR) {
      return callback(smtpError(451, "Too many messages for this address, try again later"));
    }
    try {
      const outcome = await postJson(
        `${url}/api/inbound/recipient`,
        { recipient: address.address, mailFrom: session.envelope.mailFrom?.address ?? "" },
        RECIPIENT_TIMEOUT_MS,
      );
      const code = Number(outcome?.code);
      if (code === 250) {
        address.appUrl = url;
        return callback();
      }
      if (code === 550) return callback(smtpError(550, "No such recipient"));
      return callback(smtpError(451, "Try again later"));
    } catch (err) {
      log(`recipient check failed (${parts.domain}): ${err instanceof Error ? err.message : err}`);
      return callback(smtpError(451, "Try again later"));
    }
  },

  onData(stream, session, callback) {
    const id = randomUUID();
    const part = `${emlPath(id)}.part`;
    pipeline(stream, createWriteStream(part))
      .then(async () => {
        if (stream.sizeExceeded) {
          await rm(part, { force: true });
          return callback(smtpError(552, "Message too large"));
        }
        const { size } = await stat(part);
        const recipients = session.envelope.rcptTo;
        // One spool entry per recipient (almost always exactly one).
        for (let i = 0; i < recipients.length; i++) {
          const rid = i === 0 ? id : randomUUID();
          if (i === 0) await rename(part, emlPath(rid));
          else await writeFile(emlPath(rid), await readFile(emlPath(id)));
          const entry = {
            id: rid,
            recipient: recipients[i].address,
            url: recipients[i].appUrl,
            receivedAt: Date.now(),
            attempts: 0,
            nextAt: 0,
            bytes: size,
          };
          await writeMeta(entry);
          queue.set(rid, entry);
          spoolBytes += size;
        }
        callback(null, "Queued");
      })
      .catch(async (err) => {
        await rm(part, { force: true });
        log(`spool write failed: ${err instanceof Error ? err.message : err}`);
        callback(smtpError(451, "Try again later"));
      });
  },
});

server.on("error", (err) => {
  // Per-connection protocol/TLS errors; the IP is logged for fail2ban.
  log(`smtp error ip=${clientIp(err.remoteAddress)} code=${err.code ?? "?"}`);
});

/* ---------------- start / stop ---------------- */

await loadSpool();
const ticker = setInterval(() => void tick().catch((err) => log("tick failed:", err?.message ?? err)), DISPATCH_TICK_MS);
const pruner = setInterval(() => {
  ipConnections.prune();
  tokenMessages.prune();
}, 60_000);

server.listen(PORT, () => log(`listening on :${PORT} for ${[...ROUTES.keys()].join(", ")}`));

let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  log("shutting down");
  clearInterval(ticker);
  clearInterval(pruner);
  server.close(() => {});
  // Let in-flight deliveries finish (anything unfinished stays spooled).
  const started = Date.now();
  const wait = setInterval(() => {
    if (!inFlight.size || Date.now() - started > 15_000) {
      clearInterval(wait);
      process.exit(0);
    }
  }, 200);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
