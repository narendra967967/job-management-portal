// The two trust decisions of the inbound pipeline (pure — testable on their
// own): does a signature vouch for a site, and is the sender allowed.

import { domainWithin, type InboundSender } from "@/lib/email-intake-model";

/** The parts of mailauth's authenticate() result these checks read. */
export interface AuthLike {
  dkim?: { results?: { status?: { result?: string }; signingDomain?: string }[] };
  arc?: unknown;
}

/** Does a passing DKIM signature — or Gmail's passing ARC seal recording one —
 *  vouch for `domain`? Returns the vouching signing domain, or null. */
export function signedFor(auth: AuthLike, domain: string): string | null {
  for (const r of auth.dkim?.results ?? []) {
    if (r.status?.result === "pass" && r.signingDomain && domainWithin(r.signingDomain, domain)) {
      return r.signingDomain.toLowerCase();
    }
  }
  // Forwarding can break the original signature; Gmail's ARC seal then
  // records what it verified on arrival. Trust it only when the chain passes
  // and the seal is Google's.
  const arc = auth.arc as
    | {
        status?: { result?: string };
        signature?: { signingDomain?: string };
        authenticationResults?: { dkim?: { result?: string; header?: { d?: string; i?: string } }[] };
      }
    | undefined;
  if (arc?.status?.result === "pass" && arc.signature?.signingDomain && domainWithin(arc.signature.signingDomain, "google.com")) {
    for (const d of arc.authenticationResults?.dkim ?? []) {
      const dom = (d.header?.d ?? d.header?.i ?? "").replace(/^.*@/, "").toLowerCase();
      if (d.result === "pass" && dom && domainWithin(dom, domain)) return dom;
    }
  }
  return null;
}

export function matchSender(senders: InboundSender[], from: string): InboundSender | null {
  const dom = from.slice(from.lastIndexOf("@") + 1).toLowerCase();
  for (const s of senders) {
    if (!s.enabled) continue;
    if (s.match.startsWith("*@") ? domainWithin(dom, s.match.slice(2)) : s.match === from) return s;
  }
  return null;
}
