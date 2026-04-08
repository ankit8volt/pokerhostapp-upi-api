#!/usr/bin/env node
/**
 * Smoke tests for deployed UPI API (generate + redirect).
 * Usage:
 *   node scripts/test-deploy.mjs [BASE_URL]
 *   BASE_URL=https://your-app.vercel.app node scripts/test-deploy.mjs
 */

/**
 * Set BASE_URL to your deployment (production is easiest — preview URLs often
 * return 401 unless you add VERCEL_PROTECTION_BYPASS from the project’s
 * Deployment Protection settings).
 */
const DEFAULT_BASE =
  process.env.BASE_URL ||
  process.argv[2] ||
  "https://pokerhostapp-upi-api.vercel.app";

function protectionHeaders() {
  const t = process.env.VERCEL_PROTECTION_BYPASS;
  if (!t) return {};
  return {
    "x-vercel-protection-bypass": t,
  };
}

function normalizeBase(url) {
  return String(url).replace(/\/+$/, "");
}

const sample = {
  pa: "testmerchant@okaxis",
  pn: "Test Merchant",
  am: "1.00",
  tn: "Deploy smoke test",
  tr: `test-${Date.now()}`,
};

function buildQuery(obj) {
  return new URLSearchParams(
    Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, String(v)]))
  ).toString();
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const base = normalizeBase(DEFAULT_BASE);
  const qs = buildQuery(sample);
  const generateUrl = `${base}/api/generate?${qs}`;
  const redirectUrl = `${base}/api/redirect?${qs}`;

  console.log("Base:", base);
  console.log("");

  // --- Flow 1: /api/generate ---
  console.log("1) GET /api/generate …");
  const genRes = await fetch(generateUrl, { headers: protectionHeaders() });
  if (genRes.status === 401) {
    const hint =
      "Got 401 — Vercel Deployment Protection is likely on (common for preview URLs). " +
      "Use your production domain as BASE_URL, or set VERCEL_PROTECTION_BYPASS " +
      "(Project → Settings → Deployment Protection → Protection Bypass for Automation).";
    throw new Error(hint);
  }
  assert(genRes.ok, `generate: expected 2xx, got ${genRes.status}`);
  const genJson = await genRes.json();
  assert(
    typeof genJson.upiIntentUrl === "string" && genJson.upiIntentUrl.startsWith("upi://pay?"),
    "generate: missing or invalid upiIntentUrl"
  );
  assert(
    genJson.upiIntentUrl.includes("pa=") &&
      genJson.upiIntentUrl.includes("pn=") &&
      genJson.upiIntentUrl.includes("am="),
    "generate: upiIntentUrl missing expected query keys"
  );
  assert(
    typeof genJson.shareUrl === "string" && genJson.shareUrl.includes("/api/redirect?"),
    "generate: missing or invalid shareUrl"
  );
  assert(
    typeof genJson.qrCodeDataUrl === "string" &&
      genJson.qrCodeDataUrl.startsWith("data:image/png;base64,"),
    "generate: missing or invalid qrCodeDataUrl"
  );
  const qrPayload = Buffer.from(
    genJson.qrCodeDataUrl.replace(/^data:image\/png;base64,/, ""),
    "base64"
  );
  assert(qrPayload.length > 100, "generate: QR PNG payload suspiciously small");
  console.log("   OK — upiIntentUrl:", genJson.upiIntentUrl.slice(0, 72) + "…");
  console.log("   OK — shareUrl:", genJson.shareUrl.slice(0, 72) + "…");
  console.log("   OK — qrCodeDataUrl length:", genJson.qrCodeDataUrl.length);

  // shareUrl should match same host as base (deployment may normalize host)
  const share = new URL(genJson.shareUrl);
  assert(
    share.pathname === "/api/redirect",
    `generate: shareUrl path should be /api/redirect, got ${share.pathname}`
  );

  // --- Flow 2: /api/redirect (302 + Location) ---
  console.log("");
  console.log("2) GET /api/redirect (no redirect follow) …");
  const redRes = await fetch(redirectUrl, {
    redirect: "manual",
    headers: protectionHeaders(),
  });
  assert(
    redRes.status === 302 || redRes.status === 307 || redRes.status === 308,
    `redirect: expected 302/307/308, got ${redRes.status}`
  );
  const location = redRes.headers.get("Location");
  assert(location, "redirect: missing Location header");
  assert(
    location.startsWith("upi://pay?"),
    `redirect: Location should start with upi://pay?, got: ${location.slice(0, 80)}`
  );
  // Same intent as server-side builder (normalize for comparison)
  assert(
    location === genJson.upiIntentUrl,
    `redirect: Location should equal generate.upiIntentUrl\n   gen:  ${genJson.upiIntentUrl}\n   loc:  ${location}`
  );
  console.log("   OK — status:", redRes.status);
  console.log("   OK — Location matches generate.upiIntentUrl");

  // --- Flow 2b: shareUrl from response ---
  console.log("");
  console.log("3) GET shareUrl from generate response …");
  const shareRes = await fetch(genJson.shareUrl, {
    redirect: "manual",
    headers: protectionHeaders(),
  });
  assert(
    shareRes.status === 302 || shareRes.status === 307 || shareRes.status === 308,
    `shareUrl: expected redirect status, got ${shareRes.status}`
  );
  const loc2 = shareRes.headers.get("Location");
  assert(loc2 === genJson.upiIntentUrl, "shareUrl: Location differs from upiIntentUrl");
  console.log("   OK — share link redirects to same UPI intent");

  // --- Negative: missing param ---
  console.log("");
  console.log("4) GET /api/generate (missing tr) → expect 400 …");
  const badQs = new URLSearchParams(qs);
  badQs.delete("tr");
  const badRes = await fetch(`${base}/api/generate?${badQs.toString()}`, {
    headers: protectionHeaders(),
  });
  assert(badRes.status === 400, `expected 400, got ${badRes.status}`);
  const badJson = await badRes.json();
  assert(badJson.error, "expected JSON error body");
  console.log("   OK —", badJson.error);

  console.log("");
  console.log("All checks passed.");
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
