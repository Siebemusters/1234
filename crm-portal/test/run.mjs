// Integratietest: start de echte server op een testpoort met een tijdelijke
// datastore, test de API + de UI-flow headless. Geen mocks.
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
const DATA = join(tmpdir(), "crm-test-" + Date.now() + ".json");

let failures = 0;
const check = (name, cond) => { console.log(`${cond ? "PASS" : "FAIL"}  ${name}`); if (!cond) failures++; };
const api = async (m, p, b) => {
  const r = await fetch(BASE + "/api" + p, { method: m, headers: b ? { "Content-Type": "application/json" } : undefined, body: b ? JSON.stringify(b) : undefined });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- start server ----
const srv = spawn("node", ["server.js"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), CRM_DATA_FILE: DATA }, stdio: ["ignore", "pipe", "pipe"] });
srv.stderr.on("data", (d) => process.stderr.write("[srv] " + d));

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(BASE + "/api/state"); if (r.ok) return true; } catch {}
    await wait(100);
  }
  return false;
}

async function main() {
  check("server start", await waitForServer());

  // ---- API: validatie ----
  check("lege state: 0 klanten", (await api("GET", "/state")).body.customers.length === 0);
  check("klant zonder naam -> 400", (await api("POST", "/customers", { name: "" })).status === 400);
  check("ongeldige e-mail -> 400", (await api("POST", "/customers", { name: "X", email: "geenmail" })).status === 400);

  // ---- API: happy path ----
  const c1 = await api("POST", "/customers", { name: "De Vries Studio", website: "devries.nl", email: "info@devries.nl" });
  check("klant aanmaken -> 201", c1.status === 201);
  const custId = c1.body.customers[0].id;

  check("offerte zonder klant -> 400", (await api("POST", "/quotes", { value: 100, status: "Nieuw" })).status === 400);
  check("offerte met onbekende klant -> 400", (await api("POST", "/quotes", { customerId: "nope", value: 100, status: "Nieuw" })).status === 400);
  check("offerte met foute status -> 400", (await api("POST", "/quotes", { customerId: custId, value: 100, status: "Xyz" })).status === 400);
  check("offerte met negatieve waarde -> 400", (await api("POST", "/quotes", { customerId: custId, value: -5, status: "Nieuw" })).status === 400);

  await api("POST", "/quotes", { customerId: custId, title: "Website", value: 8000, status: "Gewonnen" });
  await api("POST", "/quotes", { customerId: custId, title: "SEO", value: 2000, status: "Voorstel" });
  const afterQuotes = await api("GET", "/state");
  check("2 offertes aangemaakt", afterQuotes.body.quotes.length === 2);

  const st = afterQuotes.body.stats;
  check("omzet = 8000 (alleen gewonnen)", st.revenue === 8000);
  check("conversie = 50%", Math.round(st.conversion) === 50);
  check("open waarde = 2000", st.openValue === 2000);
  check("€ per klant = 8000", st.valuePerCustomer === 8000);
  check("status Voorstel waarde = 2000", st.perStatus["Voorstel"].value === 2000);

  // ---- meerdere offertes per klant (kernvereiste) ----
  await api("POST", "/quotes", { customerId: custId, title: "Onderhoud", value: 1200, status: "Nieuw" });
  check("klant kan meerdere offertes hebben (3)", (await api("GET", "/state")).body.quotes.filter(q => q.customerId === custId).length === 3);

  // ---- patch + delete ----
  const q = afterQuotes.body.quotes[0];
  const patched = await api("PATCH", "/quotes/" + q.id, { status: "Verloren" });
  check("offerte status wijzigen", patched.body.quotes.find(x => x.id === q.id).status === "Verloren");
  check("omzet nu 0 na verlies", patched.body.stats.revenue === 0);

  const del = await api("DELETE", "/customers/" + custId);
  check("klant verwijderen cascadeert offertes", del.body.customers.length === 0 && del.body.quotes.length === 0);

  // ---- security: path traversal ----
  const trav = await fetch(BASE + "/../server.js");
  const travTxt = await trav.text();
  check("path-traversal geblokkeerd (geen serverbroncode)", !travTxt.includes("createServer"));

  // ---- UI-flow headless ----
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(BASE);
  await page.waitForSelector(".view-title");
  check("UI laadt zonder JS-fouten", errors.length === 0);
  if (errors.length) console.log("  ", errors);

  check("dashboard toont Totale omzet", (await page.textContent(".metrics")).includes("Totale omzet"));

  // klant toevoegen via UI
  await page.click("#newCustomerBtn");
  await page.waitForSelector("#f-name");
  await page.fill("#f-name", "Bakker Retail");
  await page.fill("#f-website", "bakker.nl");
  await page.click(".sheet-actions .btn-primary"); // Klant aanmaken
  await page.waitForTimeout(300);
  // offerte toevoegen (sheet is heropend in edit-modus)
  await page.waitForSelector(".section-label");
  const valInput = page.locator(".sheet .row input[type=number]").last();
  await valInput.fill("5000");
  await page.click(".sheet .btn-ghost"); // + Offerte toevoegen
  await page.waitForTimeout(300);
  // sluit en check klantenlijst
  await page.keyboard.press("Escape");
  await page.click('.seg[data-view=customers]');
  await page.waitForSelector(".card-name");
  check("UI: nieuwe klant verschijnt in lijst", (await page.textContent(".grid")).includes("Bakker Retail"));

  await browser.close();
}

main()
  .catch((e) => { console.error("Testfout:", e); failures++; })
  .finally(() => {
    srv.kill();
    try { rmSync(DATA, { force: true }); rmSync(DATA + ".tmp", { force: true }); } catch {}
    console.log(failures === 0 ? "\nALLE TESTS GESLAAGD" : `\n${failures} TEST(S) GEFAALD`);
    process.exit(failures === 0 ? 0 : 1);
  });
