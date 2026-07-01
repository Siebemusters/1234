// Datalaag — leest/schrijft een JSON-bestand en levert de data-operaties.
// Geen business-logica in de HTTP-laag; die praat alleen met deze module.
import { readFileSync, writeFileSync, existsSync, renameSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";

export const STATUSES = ["Nieuw", "In gesprek", "Voorstel", "Gewonnen", "Verloren"];
export const OPEN_STATUSES = ["Nieuw", "In gesprek", "Voorstel"];

export class Store {
  constructor(file) {
    this.file = file;
    this.data = { customers: [], quotes: [] };
    this._load();
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
    const quote = {
      id: randomUUID(),
      customerId: input.customerId,
      title: input.title || "",
      value: input.value,
      status: input.status,
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
    if (patch.status !== undefined) q.status = patch.status;
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
    };
  }

  fullState() {
    return { customers: this.data.customers, quotes: this.data.quotes, stats: this.stats() };
  }
}
