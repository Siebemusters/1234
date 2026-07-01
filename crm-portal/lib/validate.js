// Validatie aan de rand: elke input van buiten wordt hier gecontroleerd
// vóór hij de store raakt. De frontend "al gevalideerd" telt niet.
import { STATUSES, QUOTE_TYPES } from "./store.js";

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

function str(v) {
  return typeof v === "string" ? v.trim() : "";
}

export function validateCustomer(body, { partial = false } = {}) {
  const out = {};
  if (!partial || body.name !== undefined) {
    const name = str(body.name);
    if (!name) throw new ValidationError("Naam is verplicht.");
    if (name.length > 200) throw new ValidationError("Naam is te lang.");
    out.name = name;
  }
  for (const key of ["website", "email", "phone", "notes"]) {
    if (body[key] !== undefined) out[key] = str(body[key]).slice(0, 2000);
  }
  if (out.email && !/^\S+@\S+\.\S+$/.test(out.email)) {
    throw new ValidationError("Ongeldig e-mailadres.");
  }
  return out;
}

export function validateQuote(body, { partial = false } = {}) {
  const out = {};
  if (!partial) {
    const customerId = str(body.customerId);
    if (!customerId) throw new ValidationError("Klant is verplicht.");
    out.customerId = customerId;
  }
  if (!partial || body.value !== undefined) {
    const value = Number(body.value);
    if (!Number.isFinite(value) || value < 0) {
      throw new ValidationError("Waarde moet 0 of hoger zijn.");
    }
    out.value = value;
  }
  if (!partial || body.status !== undefined) {
    const status = str(body.status);
    if (!STATUSES.includes(status)) {
      throw new ValidationError("Onbekende status.");
    }
    out.status = status;
  }
  if (body.title !== undefined) out.title = str(body.title).slice(0, 300);
  if (body.type !== undefined) {
    const type = str(body.type);
    if (!QUOTE_TYPES.includes(type)) throw new ValidationError("Onbekend offertetype.");
    out.type = type;
  }
  if (body.wonAt !== undefined) {
    const w = str(body.wonAt);
    if (w === "") out.wonAt = null;
    else if (isNaN(Date.parse(w))) throw new ValidationError("Ongeldige win-datum.");
    else out.wonAt = w;
  }
  return out;
}
