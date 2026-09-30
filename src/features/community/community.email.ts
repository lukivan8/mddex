/** Email-client-safe tables and inline styles; no dependency on app CSS or scripts. */
export function confirmationEmail(code: string, editing = false) {
  if (!/^\d{6}$/.test(code)) throw new Error("Invalid confirmation code");
  const purpose = editing ? "edit your build" : "publish your build";
  const subject = "Confirm your email — MDDEX";
  const text = `MDDEX · Community builds\n\nYour confirmation code is ${code}.\n\nEnter this code in MDDEX to ${purpose}. It expires in 10 minutes.\n\nKeep this code to yourself. If you didn't request it, you can ignore this email.\n\nhttps://mddex.net/community\nIndependent fan-made tool. Not affiliated with Mojang or Microsoft.`;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark light"><title>${subject}</title></head>
<body style="margin:0;padding:0;background-color:#080f12;color:#e2e8eb;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Enter your confirmation code to ${purpose}. Valid for 10 minutes.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#080f12;"><tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;">
<tr><td style="padding:0 0 28px;"><a href="https://mddex.net" style="text-decoration:none;color:#e2e8eb;"><img src="https://mddex.net/mddex-logo.png" width="36" height="36" alt="" style="vertical-align:middle;border:0;"> <span style="vertical-align:middle;font-family:Consolas,'Courier New',monospace;font-size:24px;font-weight:bold;">MDDEX<span style="color:#6bd0ee;">.</span></span></a></td></tr>
<tr><td style="border:1px solid #293439;border-top:3px solid #6bd0ee;background-color:#10191d;padding:32px 24px;">
<p style="margin:0 0 16px;color:#91a1a8;font-family:Consolas,'Courier New',monospace;font-size:11px;letter-spacing:2px;">COMMUNITY BUILDS</p>
<h1 style="margin:0 0 16px;color:#e2e8eb;font-size:26px;line-height:34px;">Confirm your email<span style="color:#6bd0ee;">.</span></h1>
<p style="margin:0 0 24px;color:#bdc9ce;font-size:15px;line-height:24px;">Enter this code in MDDEX to ${purpose}.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:22px 8px;background-color:#080f12;border:1px solid #324850;color:#6bd0ee;font-family:Consolas,'Courier New',monospace;font-size:36px;font-weight:bold;letter-spacing:8px;">${code}</td></tr></table>
<p style="margin:16px 0 0;color:#91a1a8;font-size:13px;line-height:22px;">Expires in 10 minutes. Keep this code to yourself.</p>
</td></tr>
<tr><td style="padding:24px 0 0;color:#91a1a8;font-size:13px;line-height:22px;">If you didn't request this code, you can ignore this email.</td></tr>
<tr><td style="padding:24px 0 0;"><a href="https://mddex.net/community" style="color:#6bd0ee;font-size:13px;text-decoration:underline;">Community builds</a><p style="margin:16px 0 0;color:#788a92;font-size:11px;line-height:18px;">Independent fan-made tool.<br>Not affiliated with Mojang or Microsoft.</p></td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html, text };
}

export async function sendConfirmationEmail(
  apiKey: string,
  from: string,
  to: string,
  code: string,
  challengeId: string,
  editing: boolean,
) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `community-otp/${challengeId}`,
    },
    body: JSON.stringify({
      from: `MDDEX <${from}>`,
      to: [to],
      ...confirmationEmail(code, editing),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    // Provider response bodies can contain recipient information; never log them.
    console.error("Community email delivery failed", {
      status: response.status,
    });
    throw new Error("Email delivery failed");
  }
  const result: unknown = await response.json();
  if (
    !result ||
    typeof result !== "object" ||
    !("id" in result) ||
    typeof result.id !== "string"
  ) {
    throw new Error("Invalid email provider response");
  }
}
