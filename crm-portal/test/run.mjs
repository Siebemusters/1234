// Integratietest: start de echte server op een testpoort met tijdelijke
// data- én auth-store, test de API (incl. auth) + de UI-flow headless.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import pw from "/opt/node22/lib/node_modules/playwright/index.js";
const { chromium } = pw;

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PORT = 4123;
const BASE = `http://localhost:${PORT}`;
const stamp = Date.now();
const DATA = join(tmpdir(), "crm-test-" + stamp + ".json");
const AUTH = join(tmpdir(), "crm-auth-" + stamp + ".json");
const ADMIN = "admin";
const PASS = "supersecret123";

let failures = 0;
const check = (name, cond) => { console.log(`${cond ? "PASS" : "FAIL"}  ${name}`); if (!cond) failures++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let cookie = ""; // sessiecookie na login
async function api(m, p, b, sendCookie = true) {
  const headers = {};
  if (b) headers["Content-Type"] = "application/json";
  if (sendCookie && cookie) headers["Cookie"] = cookie;
  // Origin meesturen zodat de same-origin (CSRF) check slaagt.
  headers["Origin"] = BASE;
  const r = await fetch(BASE + "/api" + p, { method: m, headers, body: b ? JSON.stringify(b) : undefined });
  const setc = r.headers.get("set-cookie");
  if (setc) cookie = setc.split(";")[0];
  return { status: r.status, body: await r.json().catch(() => ({})), headers: r.headers };
}

const srv = spawn("node", ["server.js"], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), CRM_DATA_FILE: DATA, CRM_AUTH_FILE: AUTH, CRM_ADMIN_USER: ADMIN, CRM_ADMIN_PASSWORD: PASS },
  stdio: ["ignore", "ignore", "pipe"],
});
srv.stderr.on("data", (d) => process.stderr.write("[srv] " + d));

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(BASE + "/api/session"); if (r.status) return true; } catch {}
    await wait(100);
  }
  return false;
}

async function main() {
  check("server start", await waitForServer());

  // ---- auth: afgeschermd ----
  check("state zonder login -> 401", (await api("GET", "/state")).status === 401);
  check("klant aanmaken zonder login -> 401", (await api("POST", "/customers", { name: "X" })).status === 401);
  check("fout wachtwoord -> 401", (await api("POST", "/login", { username: ADMIN, password: "fout" })).status === 401);
  check("onbekende user -> 401", (await api("POST", "/login", { username: "nemo", password: "whatever123" })).status === 401);

  // security headers aanwezig
  const sess = await api("GET", "/session");
  check("security header CSP aanwezig", !!sess.headers.get("content-security-policy"));
  check("security header nosniff", sess.headers.get("x-content-type-options") === "nosniff");

  // ---- login ----
  const login = await api("POST", "/login", { username: ADMIN, password: PASS });
  check("login met juiste creds -> 200", login.status === 200 && login.body.user.username === ADMIN);
  check("sessiecookie is HttpOnly", /HttpOnly/i.test(login.headers.get("set-cookie") || ""));
  check("sessiecookie is SameSite=Strict", /SameSite=Strict/i.test(login.headers.get("set-cookie") || ""));
  check("state na login -> 200", (await api("GET", "/state")).status === 200);

  // ---- CSRF: mutatie met vreemde origin geweigerd ----
  const badOrigin = await fetch(BASE + "/api/customers", { method: "POST", headers: { "Content-Type": "application/json", "Cookie": cookie, "Origin": "https://evil.example" }, body: JSON.stringify({ name: "Hacker" }) });
  check("mutatie met vreemde origin -> 403", badOrigin.status === 403);

  // ---- CRUD + validatie (ingelogd) ----
  check("klant zonder naam -> 400", (await api("POST", "/customers", { name: "" })).status === 400);
  const c1 = await api("POST", "/customers", { name: "De Vries Studio", website: "devries.nl", email: "info@devries.nl" });
  check("klant aanmaken -> 201", c1.status === 201);
  const custId = c1.body.customers.find((c) => c.name === "De Vries Studio").id;

  await api("POST", "/quotes", { customerId: custId, title: "Website", value: 8000, status: "Gewonnen" });
  await api("POST", "/quotes", { customerId: custId, title: "SEO", value: 2000, status: "Voorstel" });
  await api("POST", "/quotes", { customerId: custId, title: "Onderhoud", value: 1200, status: "Nieuw" });
  const s = (await api("GET", "/state")).body;
  check("meerdere offertes per klant (3)", s.quotes.filter((q) => q.customerId === custId).length === 3);
  check("omzet = 8000", s.stats.revenue === 8000);
  check("open waarde = 3200", s.stats.openValue === 3200);
  check("conversie = 33%", Math.round(s.stats.conversion) === 33);

  // ---- win-datum + maand-data ----
  const wonQuote = s.quotes.find((q) => q.title === "Website");
  check("win-datum automatisch gezet bij Gewonnen", !!wonQuote.wonAt);
  check("maand-data aanwezig", Array.isArray(s.stats.monthly) && s.stats.monthly.length > 0);
  check("huidige maand bevat gewonnen omzet", s.stats.monthly.some((mo) => mo.wonRevenue === 8000));
  check("cumulatief veld aanwezig", s.stats.monthly.every((mo) => typeof mo.cumulative === "number"));

  // ---- upsell ----
  await api("POST", "/quotes", { customerId: custId, title: "Uitbreiding", value: 1500, status: "Gewonnen", type: "Upsell" });
  const s2 = (await api("GET", "/state")).body;
  check("upsell-omzet apart geteld", s2.stats.upsell.upsellRevenue === 1500);
  check("nieuwe-omzet apart geteld", s2.stats.upsell.newBusinessRevenue === 8000);
  check("fout offertetype -> 400", (await api("POST", "/quotes", { customerId: custId, value: 100, status: "Nieuw", type: "Xyz" })).status === 400);

  // upsell-kans: warme klant zonder lopend traject
  const c2 = await api("POST", "/customers", { name: "Warme Klant" });
  const c2id = c2.body.customers.find((c) => c.name === "Warme Klant").id;
  await api("POST", "/quotes", { customerId: c2id, title: "Deal", value: 5000, status: "Gewonnen" });
  const s3 = (await api("GET", "/state")).body;
  check("upsell-kans verschijnt voor warme klant", s3.stats.upsell.opportunities.some((o) => o.customerId === c2id));
  check("klant met open traject is geen upsell-kans", !s3.stats.upsell.opportunities.some((o) => o.customerId === custId));

  const del = await api("DELETE", "/customers/" + custId);
  check("klant verwijderen cascadeert offertes", !del.body.customers.some((c) => c.id === custId) && !del.body.quotes.some((q) => q.customerId === custId));

  // ---- logout ----
  await api("POST", "/logout");
  check("na logout: state -> 401", (await api("GET", "/state")).status === 401);

  // ---- rate limiting op login ----
  // Wegwerp-gebruikersnaam zodat we admin niet blokkeren voor de UI-test hierna.
  let got429 = false;
  for (let i = 0; i < 12; i++) {
    const r = await api("POST", "/login", { username: "bruteforce-bait", password: "fout" }, false);
    if (r.status === 429) { got429 = true; break; }
  }
  check("brute-force wordt gerate-limit (429)", got429);

  // ---- path traversal ----
  const trav = await (await fetch(BASE + "/../server.js")).text();
  check("path-traversal geblokkeerd", !trav.includes("createServer"));

  // ---- UI-flow (met login) ----
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(BASE);
  await page.waitForSelector("#l-user");
  check("UI toont inlogscherm als niet ingelogd", true);
  check("navigatie is verborgen op inlogscherm", await page.isHidden("#segmented"));
  await page.fill("#l-user", ADMIN);
  await page.fill("#l-pass", PASS);
  await page.click(".login-card button[type=submit]");
  await page.waitForSelector(".view-title");
  check("UI: login lukt en dashboard laadt", (await page.textContent(".metrics")).includes("Totale omzet"));

  // Groei-tab toont grafieken
  await page.click('.seg[data-view=growth]');
  await page.waitForSelector(".chart");
  check("UI: Groei-tab toont grafieken", (await page.$$(".chart")).length >= 1);
  await page.click('.seg[data-view=dashboard]');
  await page.waitForSelector(".view-title");

  check("UI laadt zonder JS-fouten", errors.length === 0);
  if (errors.length) console.log("  ", errors);

  // klant toevoegen via UI
  await page.click("#newCustomerBtn");
  await page.waitForSelector("#f-name");
  await page.fill("#f-name", "Bakker Retail");
  await page.click(".sheet-actions .btn-primary");
  await page.waitForTimeout(300);
  await page.keyboard.press("Escape");
  await page.click('.seg[data-view=customers]');
  await page.waitForSelector(".card-name");
  check("UI: nieuwe klant verschijnt", (await page.textContent(".grid")).includes("Bakker Retail"));

  // uitloggen via UI
  await page.click("#logoutBtn");
  await page.waitForSelector("#l-user");
  check("UI: uitloggen brengt terug naar inlogscherm", true);

  await browser.close();
}

main()
  .catch((e) => { console.error("Testfout:", e); failures++; })
  .finally(() => {
    srv.kill();
    for (const f of [DATA, DATA + ".tmp", AUTH, AUTH + ".tmp"]) { try { rmSync(f, { force: true }); } catch {} }
    console.log(failures === 0 ? "\nALLE TESTS GESLAAGD" : `\n${failures} TEST(S) GEFAALD`);
    process.exit(failures === 0 ? 0 : 1);
  });
