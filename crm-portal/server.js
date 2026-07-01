// HTTP-laag: dun. Parseert requests, delegeert naar de store, serveert de
// frontend. Geen business-logica hier.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, normalize, extname } from "node:path";

import { Store, STATUSES } from "./lib/store.js";
import { validateCustomer, validateQuote, ValidationError } from "./lib/validate.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "public");
const DATA_FILE = process.env.CRM_DATA_FILE || join(__dirname, "data", "crm.json");
const PORT = Number(process.env.PORT) || 4000;
const MAX_BODY = 1_000_000; // 1 MB — genoeg voor deze payloads, stopt misbruik.

const store = new Store(DATA_FILE);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
};

function send(res, status, body, headers = {}) {
  const payload = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new ValidationError("Request te groot."));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new ValidationError("Ongeldige JSON."));
      }
    });
    req.on("error", reject);
  });
}

async function serveStatic(req, res, pathname) {
  const rel = pathname === "/" ? "/index.html" : pathname;
  // Path-traversal blokkeren: geresolvede pad moet binnen PUBLIC_DIR blijven.
  const filePath = normalize(join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    return send(res, 403, { error: "Verboden." });
  }
  try {
    const data = await readFile(filePath);
    const type = MIME[extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  } catch {
    // SPA-fallback: onbekende paden -> index.html.
    try {
      const data = await readFile(join(PUBLIC_DIR, "index.html"));
      res.writeHead(200, { "Content-Type": MIME[".html"] });
      res.end(data);
    } catch {
      send(res, 404, { error: "Niet gevonden." });
    }
  }
}

async function handleApi(req, res, pathname) {
  const parts = pathname.split("/").filter(Boolean); // ["api", "customers", ":id"]
  const [, resource, id] = parts;

  // GET /api/state
  if (req.method === "GET" && resource === "state") {
    return send(res, 200, store.fullState());
  }
  if (req.method === "GET" && resource === "meta") {
    return send(res, 200, { statuses: STATUSES });
  }

  // /api/customers
  if (resource === "customers") {
    if (req.method === "POST") {
      const body = await readBody(req);
      const input = validateCustomer(body);
      store.createCustomer(input);
      return send(res, 201, store.fullState());
    }
    if (req.method === "PATCH" && id) {
      const body = await readBody(req);
      const patch = validateCustomer(body, { partial: true });
      if (!store.updateCustomer(id, patch)) return send(res, 404, { error: "Klant niet gevonden." });
      return send(res, 200, store.fullState());
    }
    if (req.method === "DELETE" && id) {
      if (!store.deleteCustomer(id)) return send(res, 404, { error: "Klant niet gevonden." });
      return send(res, 200, store.fullState());
    }
  }

  // /api/quotes
  if (resource === "quotes") {
    if (req.method === "POST") {
      const body = await readBody(req);
      const input = validateQuote(body);
      if (!store.getCustomer(input.customerId)) {
        return send(res, 400, { error: "Onbekende klant voor deze offerte." });
      }
      store.createQuote(input);
      return send(res, 201, store.fullState());
    }
    if (req.method === "PATCH" && id) {
      const body = await readBody(req);
      const patch = validateQuote(body, { partial: true });
      if (!store.updateQuote(id, patch)) return send(res, 404, { error: "Offerte niet gevonden." });
      return send(res, 200, store.fullState());
    }
    if (req.method === "DELETE" && id) {
      if (!store.deleteQuote(id)) return send(res, 404, { error: "Offerte niet gevonden." });
      return send(res, 200, store.fullState());
    }
  }

  send(res, 404, { error: "Onbekend endpoint." });
}

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (pathname.startsWith("/api/")) {
      await handleApi(req, res, pathname);
    } else {
      await serveStatic(req, res, pathname);
    }
  } catch (err) {
    if (err instanceof ValidationError) {
      // Verwachte fout -> duidelijke, voorspelbare 400.
      return send(res, 400, { error: err.message });
    }
    // Onverwachte fout -> loggen, generieke melding, geen interne details lekken.
    console.error("Onverwachte fout:", err);
    send(res, 500, { error: "Er ging iets mis op de server." });
  }
});

// Alleen luisteren als dit bestand direct gestart wordt (niet in tests die importeren).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(PORT, () => {
    console.log(`CRM-portal draait op http://localhost:${PORT}`);
    console.log(`Data: ${DATA_FILE}`);
  });
}

export { server, store };
