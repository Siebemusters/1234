// Datalaag — leest/schrijft een JSON-bestand en levert de data-operaties.
// Geen business-logica in de HTTP-laag; die praat alleen met deze module.
import { readFileSync, writeFileSync, existsSync, renameSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";

export const STATUSES = ["Nieuw", "In gesprek", "Voorstel", "Gewonnen", "Verloren"];
export const OPEN_STATUSES = ["Nieuw", "In gesprek", "Voorstel"];
export const QUOTE_TYPES = ["Nieuw", "Upsell"];

export class Store {
  constructor(file) {
    this.file = file;
    this.data = { customers: [], quotes: [] };
    this._load();
    this._migrate();
  }

  // Vult ontbrekende velden op bestaande offertes (type, wonAt) zodat oude
  // data blijft werken na een schema-uitbreiding.
  _migrate() {
    let changed = false;
    for (const q of this.data.quotes) {
      if (q.type === undefined) { q.type = "Nieuw"; changed = true; }
      if (q.wonAt === undefined) {
        q.wonAt = q.status === "Gewonnen" ? (q.createdAt || new Date().toISOString()) : null;
        changed = true;
      }
    }
    if (changed) this._save();
  }

  _load() {
    if (existsSync(this.file)) {
      try {
        const parsed = JSON.parse(readFileSync(this.file, "utf8"));
        if (parsed && Array.isArray(parsed.customers) && Array.isArray(parsed.quotes)) {
          this.data = parsed;
        }
      } catch (e) {
        console.error("Kon datastore niet lezen, start leeg:", e.message);
      }
    }
  }

  // Atomische write: eerst naar tempbestand, dan hernoemen. Voorkomt corrupte
  // data als het proces halverwege een write sterft.
  _save() {
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = this.file + ".tmp";
    writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    renameSync(tmp, this.file);
  }

  // ---- Klanten ----
  listCustomers() {
    return this.data.customers;
  }

  getCustomer(id) {
    return this.data.customers.find((c) => c.id === id) || null;
  }

  createCustomer(input) {
    const now = new Date().toISOString();
    const customer = {
      id: randomUUID(),
      name: input.name,
      website: input.website || "",
      email: input.email || "",
      phone: input.phone || "",
      notes: input.notes || "",
      createdAt: now,
      updatedAt: now,
    };
    this.data.customers.push(customer);
    this._save();
    return customer;
  }

  updateCustomer(id, patch) {
    const c = this.getCustomer(id);
    if (!c) return null;
    for (const key of ["name", "website", "email", "phone", "notes"]) {
      if (patch[key] !== undefined) c[key] = patch[key];
    }
    c.updatedAt = new Date().toISOString();
    this._save();
    return c;
  }

  deleteCustomer(id) {
    const before = this.data.customers.length;
    this.data.customers = this.data.customers.filter((c) => c.id !== id);
    if (this.data.customers.length === before) return false;
    // Cascade: offertes van deze klant weg.
    this.data.quotes = this.data.quotes.filter((q) => q.customerId !== id);
    this._save();
    return true;
  }

  // ---- Offertes ----
  createQuote(input) {
    const now = new Date().toISOString();
    const status = input.status;
    const quote = {
      id: randomUUID(),
      customerId: input.customerId,
      title: input.title || "",
      value: input.value,
      status,
      type: input.type || "Nieuw",
      // Win-datum: expliciet meegegeven, anders automatisch bij winst.
      wonAt: input.wonAt || (status === "Gewonnen" ? now : null),
      createdAt: now,
      updatedAt: now,
    };
    this.data.quotes.push(quote);
    this._save();
    return quote;
  }

  getQuote(id) {
    return this.data.quotes.find((q) => q.id === id) || null;
  }

  updateQuote(id, patch) {
    const q = this.getQuote(id);
    if (!q) return null;
    if (patch.title !== undefined) q.title = patch.title;
    if (patch.value !== undefined) q.value = patch.value;
    if (patch.type !== undefined) q.type = patch.type;
    const explicitWon = patch.wonAt !== undefined;
    if (explicitWon) q.wonAt = patch.wonAt || null;
    if (patch.status !== undefined) {
      q.status = patch.status;
      // Win-datum automatisch beheren, tenzij expliciet meegegeven.
      if (patch.status === "Gewonnen") { if (!q.wonAt) q.wonAt = new Date().toISOString(); }
      else if (!explicitWon) { q.wonAt = null; }
    }
    q.updatedAt = new Date().toISOString();
    this._save();
    return q;
  }

  deleteQuote(id) {
    const before = this.data.quotes.length;
    this.data.quotes = this.data.quotes.filter((q) => q.id !== id);
    if (this.data.quotes.length === before) return false;
    this._save();
    return true;
  }

  // ---- Afgeleide cijfers (één bron van waarheid voor het dashboard) ----
  stats() {
    const quotes = this.data.quotes;
    let revenue = 0, openValue = 0, wonCount = 0, openCount = 0, closedCount = 0;
    const perStatus = {};
    STATUSES.forEach((s) => (perStatus[s] = { count: 0, value: 0 }));

    for (const q of quotes) {
      const v = Number(q.value) || 0;
      if (perStatus[q.status]) {
        perStatus[q.status].count += 1;
        perStatus[q.status].value += v;
      }
      if (q.status === "Gewonnen") { revenue += v; wonCount += 1; }
      if (OPEN_STATUSES.includes(q.status)) { openValue += v; openCount += 1; }
      else { closedCount += 1; }
    }

    const totalQuotes = quotes.length;
    const customerCount = this.data.customers.length;
    return {
      revenue,
      conversion: totalQuotes > 0 ? (wonCount / totalQuotes) * 100 : 0,
      valuePerCustomer: customerCount > 0 ? revenue / customerCount : 0,
      openCount,
      openValue,
      closedCount,
      wonCount,
      totalQuotes,
      customerCount,
      perStatus,
      monthly: this._monthly(),
      upsell: this._upsell(),
    };
  }

  // Omzet/activiteit per maand — de basis voor de groei-grafieken.
  _monthly() {
    const quotes = this.data.quotes;
    const key = (iso) => (iso ? String(iso).slice(0, 7) : null); // "YYYY-MM"

    // Bereikgrens bepalen: van eerste activiteit t/m huidige maand.
    const nowKey = key(new Date().toISOString());
    let minKey = nowKey;
    for (const q of quotes) {
      for (const k of [key(q.createdAt), key(q.wonAt)]) {
        if (k && k < minKey) minKey = k;
      }
    }

    // Maandenlijst opbouwen (min..nu), gemaximeerd op de laatste 24.
    const months = [];
    let [y, m] = minKey.split("-").map(Number);
    const [ny, nm] = nowKey.split("-").map(Number);
    while (y < ny || (y === ny && m <= nm)) {
      months.push(`${y}-${String(m).padStart(2, "0")}`);
      m += 1; if (m > 12) { m = 1; y += 1; }
      if (months.length > 240) break; // veiligheidsrem
    }
    const window = months.slice(-24);

    let cumulative = 0;
    // Cumulatief moet ook de omzet vóór het venster meenemen.
    const before = window[0];
    for (const q of quotes) {
      if (q.status === "Gewonnen" && key(q.wonAt) && key(q.wonAt) < before) cumulative += Number(q.value) || 0;
    }

    return window.map((mo) => {
      let wonRevenue = 0, wonCount = 0, newQuotes = 0;
      for (const q of quotes) {
        if (key(q.createdAt) === mo) newQuotes += 1;
        if (q.status === "Gewonnen" && key(q.wonAt) === mo) { wonRevenue += Number(q.value) || 0; wonCount += 1; }
      }
      cumulative += wonRevenue;
      return { month: mo, wonRevenue, wonCount, newQuotes, cumulative };
    });
  }

  // Upsell: aandeel omzet uit uitbreiding + warme klanten zonder lopend traject.
  _upsell() {
    const quotes = this.data.quotes;
    let upsellRevenue = 0, newBusinessRevenue = 0;
    for (const q of quotes) {
      if (q.status !== "Gewonnen") continue;
      const v = Number(q.value) || 0;
      if (q.type === "Upsell") upsellRevenue += v; else newBusinessRevenue += v;
    }

    const opportunities = [];
    for (const c of this.data.customers) {
      const cq = quotes.filter((q) => q.customerId === c.id);
      const wonValue = cq.filter((q) => q.status === "Gewonnen").reduce((s, q) => s + (Number(q.value) || 0), 0);
      const openCount = cq.filter((q) => OPEN_STATUSES.includes(q.status)).length;
      // Warme klant (heeft eerder gewonnen) zonder lopend traject = belletjeslijst.
      if (wonValue > 0 && openCount === 0) {
        const wonDates = cq.filter((q) => q.status === "Gewonnen" && q.wonAt).map((q) => q.wonAt).sort();
        opportunities.push({ customerId: c.id, name: c.name, wonValue, lastWonAt: wonDates[wonDates.length - 1] || null });
      }
    }
    opportunities.sort((a, b) => b.wonValue - a.wonValue);
    return { upsellRevenue, newBusinessRevenue, opportunities };
  }

  fullState() {
    return { customers: this.data.customers, quotes: this.data.quotes, stats: this.stats() };
  }
}
