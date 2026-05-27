import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const http = httpRouter();

http.route({
  path: "/unsubscribe",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const token = url.searchParams.get("t");
    if (!token) return text("Missing token.", 400);

    const dotIndex = token.indexOf(".");
    if (dotIndex < 1) return text("Invalid token.", 400);

    const userIdRaw = token.slice(0, dotIndex);
    const providedSig = token.slice(dotIndex + 1);

    const secret = process.env.UNSUBSCRIBE_SIGNING_SECRET;
    if (!secret) return text("Unsubscribe is not configured.", 500);

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sigBuf = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(userIdRaw),
    );
    const expectedSig = base64UrlEncode(new Uint8Array(sigBuf));
    if (!timingSafeEqual(expectedSig, providedSig)) {
      return text("Invalid signature.", 400);
    }

    await ctx.runMutation(internal.weeklyDigest._toggleDigest, {
      userId: userIdRaw as Id<"users">,
      enabled: false,
    });

    return html(
      `<!doctype html><html><body style="font-family:system-ui,sans-serif;background:#010102;color:#f7f8f8;padding:48px;text-align:center;">
        <h1 style="font-size:22px;margin:0 0 8px;">Unsubscribed</h1>
        <p style="color:#8a8f98;">You won't receive the Whatabrick weekly digest anymore. You can re-enable it any time from your settings.</p>
      </body></html>`,
    );
  }),
});

export default http;

function text(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function html(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function base64UrlEncode(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
