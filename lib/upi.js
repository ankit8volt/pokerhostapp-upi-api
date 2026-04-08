/**
 * UPI intent: upi://pay?pa=&pn=&am=&cu=INR&tn=&tr=
 * pn and tn must be URL-encoded (we encode all query values).
 */

const REQUIRED = ["pa", "pn", "am", "tn", "tr"];

function enc(v) {
  return encodeURIComponent(String(v));
}

function buildUpiIntentUrl({ pa, pn, am, cu = "INR", tn, tr }) {
  return `upi://pay?pa=${enc(pa)}&pn=${enc(pn)}&am=${enc(am)}&cu=${enc(
    cu
  )}&tn=${enc(tn)}&tr=${enc(tr)}`;
}

function pickParams(query) {
  return {
    pa: query.pa,
    pn: query.pn,
    am: query.am,
    cu: query.cu || "INR",
    tn: query.tn,
    tr: query.tr,
  };
}

function validate(params) {
  const missing = REQUIRED.filter((k) => {
    const v = params[k];
    return v === undefined || v === null || String(v).trim() === "";
  });
  if (missing.length) {
    return {
      ok: false,
      error: `Missing required parameters: ${missing.join(", ")}`,
    };
  }
  const am = String(params.am).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(am)) {
    return {
      ok: false,
      error:
        "Invalid amount: use a positive number with at most two decimal places (e.g. 100 or 100.50)",
    };
  }
  return { ok: true };
}

function queryStringFromParams(params) {
  const q = new URLSearchParams();
  q.set("pa", params.pa);
  q.set("pn", params.pn);
  q.set("am", String(params.am).trim());
  q.set("cu", params.cu || "INR");
  q.set("tn", params.tn);
  q.set("tr", params.tr);
  return q.toString();
}

module.exports = {
  buildUpiIntentUrl,
  pickParams,
  validate,
  queryStringFromParams,
};
