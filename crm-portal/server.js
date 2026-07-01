// HTTP-laag: dun. Parseert requests, dwingt auth af, delegeert naar de store,
// serveert de frontend. Geen business-logica hier.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, normalize, extname } from "node:path";

import { Store, STATUSES } from "./lib/store.js";
import { validateCustomer, validateQuote, ValidationError } from "./lib/validate.js";
import { AuthStore } from "./lib/auth.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "public");
const DATA_FILE = process.env.CRM_DATA_FILE || join(__dirname, "data", "crm.json");
const AUTH_FILE = process.env.CRM_AUTH_FILE || join(__dirname, "data", "auth.json");
const PORT = Number(process.env.PORT) || 4000;
const MAX_BODY = 1_000_000; // 1 MB

const store = new Store(DATA_FILE);
const auth = new AuthStore(AUTH_FILE);

// Bootstrap: maak een admin uit env als er nog geen users zijn.
if (!auth.hasUsers()) {
  const u = process.env.CRM_ADMIN_USER;
  const p = process.env.CRM_ADMIN_PASSWORD;
  if (u && p) {
    try { auth.createUser(u, p); console.log(`Admin-gebruiker "${u.toLowerCase()}" aangemaakt.`); }
    catch (e) { console.error("Bootstrap admin mislukt:", e.message); }
  } else {
    console.warn("LET OP: geen gebruikers. Maak er een met:  node create-user.mjs <naam> <wachtwoord>");
    console.warn("of start met CRM_ADMIN_USER en CRM_ADMIN_PASSWORD gezet.");
  }
}

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".json": "application/json; charset=utf-8",
};

function isSecure(req) {
  return req.socket.encrypted === true || req.headers["x-forwarded-proto"] === "https";
}

function securityHeaders(req) {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "same-origin",
    // Favicons/logo's van externe hosts moeten laden; verder alles same-origin.
    "Content-Security-Policy":
      "default-src 'self'; img-src 'self' data: https://www.google.com https://img.logo.dev; " +
      "style-src 'self' 'unsafe-inline'; script-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  };
}

function send(res, status, body, headers = {}) {
  const payload = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
  res.end(payload);
}

function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function sessionCookie(token, req, { clear = false } = {}) {
  const attrs = ["sid=" + (clear ? "" : token), "HttpOnly", "SameSite=Strict", "Path=/"];
  attrs.push(clear ? "Max-Age=0" : "Max-Age=" + 7 * 24 * 60 * 60);
  if (isSecure(req)) attrs.push("Secure");
  return attrs.join("; ");
}

// CSRF-verdediging (naast SameSite=Strict): bij mutaties moet de Origin/Referer
// van dezelfde host komen.
function sameOrigin(req) {
  const origin = req.headers.origin || req.headers.referer;
  if (!origin) return true; // geen Origin op same-origin niet-CORS requests → ok
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new ValidationError("Request te groot.")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(new ValidationError("Ongeldige JSON.")); }
    });
    req.on("error", reject);
  });
}

async function serveStatic(req, res, pathname) {
  const rel = pathname === "/" ? "/index.html" : pathname;
  const filePath = normalize(join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, { error: "Verboden." }, securityHeaders(req));
  const headers = securityHeaders(req);
  try {
    const data = await readFile(filePath);
    res.writeHead(200, { "Content-Type": MIME[extname(filePath).toLowerCase()] || "application/octet-stream", ...headers });
    res.end(data);
  } catch {
    try {
      const data = await readFile(join(PUBLIC_DIR, "index.html"));
      res.writeHead(200, { "Content-Type": MIME[".html"], ...headers });
      res.end(data);
    } catch { send(res, 404, { error: "Niet gevonden." }, headers); }
  }
}

async function handleApi(req, res, pathname) {
  const parts = pathname.split("/").filter(Boolean);
  const [, resource, id] = parts;
  const cookies = parseCookies(req);
  const secHeaders = securityHeaders(req);
  const isMutation = req.method !== "GET";

  // CSRF: mutaties moeten same-origin zijn.
  if (isMutation && !sameOrigin(req)) return send(res, 403, { error: "Ongeldige oorsprong." }, secHeaders);

  // ---- Publieke auth-endpoints ----
  if (resource === "login" && req.method === "POST") {
    const body = await readBody(req);
    const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "?";
    const rateKey = String(body.username || "").toLowerCase() + "|" + ip;
    const r = auth.login(body.username || "", body.password || "", rateKey);
    if (!r.ok) {
      const status = r.reason === "rate" ? 429 : 401;
      const msg = r.reason === "rate" ? "Te veel pogingen. Wacht even." : "Onjuiste gebruikersnaam of wachtwoord.";
      return send(res, status, { error: msg }, secHeaders);
    }
    return send(res, 200, { user: r.user }, { ...secHeaders, "Set-Cookie": sessionCookie(r.token, req) });
  }

  const user = auth.userForToken(cookies.sid);

  if (resource === "session" && req.method === "GET") {
    // Statuscheck: 200 met user of null (uitgelogd is geen fout).
    return send(res, 200, { user: user || null }, secHeaders);
  }
  if (resource === "logout" && req.method === "POST") {
    auth.logout(cookies.sid);
    return send(res, 200, { ok: true }, { ...secHeaders, "Set-Cookie": sessionCookie("", req, { clear: true }) });
  }

  // ---- Vanaf hier: auth verplicht ----
  if (!user) return send(res, 401, { error: "Niet ingelogd." }, secHeaders);

  if (req.method === "GET" && resource === "state") return send(res, 200, store.fullState(), secHeaders);
  if (req.method === "GET" && resource === "meta") return send(res, 200, { statuses: STATUSES }, secHeaders);

  if (resource === "customers") {
    if (req.method === "POST") { store.createCustomer(validateCustomer(await readBody(req))); return send(res, 201, store.fullState(), secHeaders); }
    if (req.method === "PATCH" && id) {
      if (!store.updateCustomer(id, validateCustomer(await readBody(req), { partial: true }))) return send(res, 404, { error: "Klant niet gevonden." }, secHeaders);
      return send(res, 200, store.fullState(), secHeaders);
    }
    if (req.method === "DELETE" && id) {
      if (!store.deleteCustomer(id)) return send(res, 404, { error: "Klant niet gevonden." }, secHeaders);
      return send(res, 200, store.fullState(), secHeaders);
    }
  }

  if (resource === "quotes") {
    if (req.method === "POST") {
      const input = validateQuote(await readBody(req));
      if (!store.getCustomer(input.customerId)) return send(res, 400, { error: "Onbekende klant voor deze offerte." }, secHeaders);
      store.createQuote(input);
      return send(res, 201, store.fullState(), secHeaders);
    }
    if (req.method === "PATCH" && id) {
      if (!store.updateQuote(id, validateQuote(await readBody(req), { partial: true }))) return send(res, 404, { error: "Offerte niet gevonden." }, secHeaders);
      return send(res, 200, store.fullState(), secHeaders);
    }
    if (req.method === "DELETE" && id) {
      if (!store.deleteQuote(id)) return send(res, 404, { error: "Offerte niet gevonden." }, secHeaders);
      return send(res, 200, store.fullState(), secHeaders);
    }
  }

  send(res, 404, { error: "Onbekend endpoint." }, secHeaders);
}

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (pathname.startsWith("/api/")) await handleApi(req, res, pathname);
    else await serveStatic(req, res, pathname);
  } catch (err) {
    if (err instanceof ValidationError) return send(res, 400, { error: err.message }, securityHeaders(req));
    console.error("Onverwachte fout:", err);
    send(res, 500, { error: "Er ging iets mis op de server." }, securityHeaders(req));
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(PORT, () => {
    console.log(`CRM-portal draait op http://localhost:${PORT}`);
    console.log(`Data: ${DATA_FILE}`);
    console.log("Productie: draai dit achter HTTPS (reverse proxy). Zonder TLS reizen wachtwoord en sessie onversleuteld.");
  });
}

export { server, store, auth };
