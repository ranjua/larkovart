function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export function studioEmailHtml(code: string, host: string) {
  if (!/^\d{6}$/.test(code)) throw new Error("Invalid email code");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your studio sign-in code</title></head>
<body style="margin:0;background:#f3f4f0;color:#17201c;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden">Your private studio is ready. This code expires in 10 minutes.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e3e7df">
<tr><td style="padding:30px 36px;background:#17201c;color:#ffffff"><span style="font-size:28px;font-weight:700;letter-spacing:-1.5px">larkova<span style="color:#d9f279">.</span></span><span style="float:right;font-size:10px;letter-spacing:2px;padding-top:12px;color:#cad2c9">ARTIST STUDIO</span></td></tr>
<tr><td style="padding:40px 36px 16px"><p style="margin:0 0 14px;font-size:11px;letter-spacing:2px;color:#788377">WELCOME BACK, YULIA</p><h1 style="margin:0 0 18px;font-size:32px;line-height:1.15;letter-spacing:-1.2px;font-weight:600">Your space to create.</h1><p style="margin:0;font-size:15px;line-height:1.7;color:#687267">Use this code to enter your private studio.<br>Your art, your collection, all in one place.</p></td></tr>
<tr><td style="padding:18px 36px 24px"><div style="background:#f0f5e8;border:1px solid #e1eacb;border-radius:12px;padding:24px 8px;text-align:center;font-family:Consolas,monospace;font-size:40px;line-height:1.3;letter-spacing:9px;font-weight:700;color:#17201c">${code}</div><p style="margin:12px 0 0;text-align:center;color:#788377;font-size:12px">One-time code · Expires in 10 minutes</p></td></tr>
<tr><td style="padding:0 36px 34px"><p style="margin:0;padding-top:22px;border-top:1px solid #e9ece5;font-size:12px;line-height:1.8;color:#788377">Enter it in the browser where you requested it. Never share this code. If you didn’t request it, you can safely ignore this email.</p><p style="margin:12px 0 0;font-size:11px;color:#98a093;word-break:break-all">${escapeHtml(host)}</p></td></tr>
</table><p style="font-size:11px;color:#899181;line-height:1.8;margin:22px 0">Larkova Art · Original works by Yulia Larkova<br>Guatemala City</p>
</td></tr></table></body></html>`;
}
