const QRCode = require("qrcode");
const {
  buildUpiIntentUrl,
  pickParams,
  validate,
  queryStringFromParams,
} = require("../lib/upi");

function getBaseUrl(req) {
  const proto =
    req.headers["x-forwarded-proto"] ||
    (req.headers.host?.includes("localhost") ? "http" : "https");
  const host =
    req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  return `${proto}://${host}`;
}

function sendJson(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, OPTIONS");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const params = pickParams(req.query || {});
  const check = validate(params);
  if (!check.ok) {
    return sendJson(res, 400, { error: check.error });
  }

  const upiIntentUrl = buildUpiIntentUrl(params);
  const qs = queryStringFromParams(params);
  const shareUrl = `${getBaseUrl(req)}/api/redirect?${qs}`;

  let qrCodeDataUrl;
  try {
    qrCodeDataUrl = await QRCode.toDataURL(upiIntentUrl, {
      type: "image/png",
      width: 256,
      margin: 2,
      errorCorrectionLevel: "M",
    });
  } catch (e) {
    return sendJson(res, 500, { error: "Failed to generate QR code" });
  }

  return sendJson(res, 200, {
    upiIntentUrl,
    shareUrl,
    qrCodeDataUrl,
  });
};
