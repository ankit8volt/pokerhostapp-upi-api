const { buildUpiIntentUrl, pickParams, validate } = require("../lib/upi");

function sendJson(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

module.exports = function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const params = pickParams(req.query || {});
  const check = validate(params);
  if (!check.ok) {
    return sendJson(res, 400, { error: check.error });
  }

  const upiIntentUrl = buildUpiIntentUrl(params);
  res.statusCode = 302;
  res.setHeader("Location", upiIntentUrl);
  res.setHeader("Cache-Control", "private, max-age=60");
  if (req.method === "HEAD") {
    return res.end();
  }
  return res.end();
};
