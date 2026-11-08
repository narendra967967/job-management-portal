import "server-only";

// Amazon SES through the AWS SDK (SES API v2). The mailer sends with it when
// Settings → Email delivery says Amazon SES; Test connection reads the account
// (sandbox, sending paused, quota). Messages are built by nodemailer exactly as
// for SMTP and handed to SES raw, so headers like List-Unsubscribe survive.

import { createHash } from "node:crypto";
import { GetAccountCommand, SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import type { SesCredentials } from "@/lib/email-delivery";
import type { SesAccountInfo } from "@/lib/email-delivery-model";

/**
 * Local testing only: send to a stand-in SES endpoint instead of AWS. Ignored in
 * production, so a stray variable there can't redirect real email.
 */
const endpoint = process.env.NODE_ENV !== "production" ? process.env.SES_ENDPOINT || undefined : undefined;

// One client per set of credentials, reused across sends (broadcasts send many).
let cached: { key: string; client: SESv2Client } | null = null;

export function sesClient(c: Pick<SesCredentials, "region" | "accessKeyId" | "secretAccessKey">): SESv2Client {
  const key = createHash("sha256").update(`${c.region}\n${c.accessKeyId}\n${c.secretAccessKey}`).digest("hex");
  if (cached?.key === key) return cached.client;
  cached?.client.destroy();
  const client = new SESv2Client({
    region: c.region,
    credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
    maxAttempts: 3,
    requestHandler: { connectionTimeout: 5_000, requestTimeout: 15_000 },
    ...(endpoint ? { endpoint } : {}),
  });
  cached = { key, client };
  return client;
}

/** The pieces nodemailer's SES transport needs. */
export function sesTransportOptions(c: SesCredentials) {
  return { SES: { sesClient: sesClient(c), SendEmailCommand } };
}

/** What SES says about the account. Needs ses:GetAccount on the IAM user. */
export async function getSesAccount(c: SesCredentials): Promise<SesAccountInfo> {
  const a = await sesClient(c).send(new GetAccountCommand({}));
  return {
    productionAccess: !!a.ProductionAccessEnabled,
    sendingEnabled: a.SendingEnabled !== false,
    max24HourSend: Math.round(a.SendQuota?.Max24HourSend ?? 0),
    sentLast24Hours: Math.round(a.SendQuota?.SentLast24Hours ?? 0),
    maxSendRate: Math.round((a.SendQuota?.MaxSendRate ?? 0) * 100) / 100,
  };
}

/** An AWS error in words an admin can act on. Never includes the secret. */
export function sesErrorMessage(e: unknown, region = ""): string {
  const err = e as { name?: string; Code?: string; code?: string; message?: string; cause?: { code?: string } };
  const name = err?.name ?? err?.Code ?? "";
  const msg = (err?.message ?? String(e)).slice(0, 300);
  const net = err?.code ?? err?.cause?.code ?? "";
  if (["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ETIMEDOUT"].includes(net) || /getaddrinfo|ENOTFOUND/.test(msg)) {
    return `Couldn't reach Amazon SES${region ? ` in ${region}` : ""}. Check the region, and that the server can reach AWS.`;
  }
  switch (name) {
    case "InvalidClientTokenId":
    case "UnrecognizedClientException":
      return "AWS doesn't recognize that access key ID. Check it, and that the key is still active in IAM.";
    case "SignatureDoesNotMatch":
    case "InvalidSignatureException":
      return "The secret access key doesn't match the access key ID.";
    case "AccessDenied":
    case "AccessDeniedException":
      return "This access key isn't allowed to do that. Its IAM policy needs ses:SendEmail, ses:SendRawEmail and ses:GetAccount.";
    case "AccountSuspendedException":
    case "SendingPausedException":
      return "AWS has paused sending for this SES account. Check the SES console for the reason.";
    case "MailFromDomainNotVerifiedException":
      return "The custom MAIL FROM domain isn't verified in SES.";
    case "TooManyRequestsException":
    case "LimitExceededException":
    case "ThrottlingException":
      return "SES is limiting how fast this account can send. Try again in a minute.";
    case "MessageRejected":
      return /not verified/i.test(msg)
        ? `SES refused it because an address isn't verified. While the account is in the sandbox, the from address and every recipient must be verified in SES. (${msg})`
        : `SES refused the email: ${msg}`;
    default:
      return `Amazon SES said: ${msg}`;
  }
}
