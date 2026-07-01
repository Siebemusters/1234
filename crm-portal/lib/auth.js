// Auth-laag — wachtwoordhashing (scrypt), server-side sessies, rate limiting.
// Alleen Node built-ins. Users + sessies in een apart bestand, gescheiden van
// de CRM-data (zodat een CRM-back-up nooit wachtwoordhashes bevat).
import { readFileSync, writeFileSync, existsSync, renameSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { scryptSync, randomBytes, timingSafeEqual, createHash, randomUUID } from "node:crypto";

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 }; // ~16 MB werk per hash
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dagen

export function hashPassword(password) {
  const salt = randomBytes(16);
  const dk = scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("hex")}$${dk.toString("hex")}`;
}

export function verifyPassword(password, stored) {
  try {
    const [alg, N, r, p, saltHex, hashHex] = String(stored).split("$");
    if (alg !== "scrypt") return false;
    const expected = Buffer.from(hashHex, "hex");
    const dk = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length, { N: +N, r: +r, p: +p });
    return dk.length === expected.length && timingSafeEqual(dk, expected);
  } catch {
    return false;
  }
}

const sha256 = (s) => createHash("sha256").update(s).digest("hex");

export class AuthStore {
  constructor(file) {
    this.file = file;
    this.data = { users: [], sessions: {} };
    // Dummy-hash om timing gelijk te houden als de user niet bestaat
    // (voorkomt user-enumeration via responstijd).
    this._dummy = hashPassword(randomBytes(16).toString("hex"));
    this._rate = new Map(); // key -> { count, resetAt }
    this._load();
  }

  _load() {
    if (existsSync(this.file)) {
      try {
        const p = JSON.parse(readFileSync(this.file, "utf8"));
        if (p && Array.isArray(p.users)) this.data = { users: p.users, sessions: p.sessions || {} };
      } catch (e) {
        console.error("Kon auth-store niet lezen:", e.message);
      }
    }
  }
  _save() {
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = this.file + ".tmp";
    writeFileSync(tmp, JSON.stringify(this.data, null, 2), { mode: 0o600 });
    renameSync(tmp, this.file);
  }

  hasUsers() { return this.data.users.length > 0; }
  getUserByName(username) {
    const u = String(username).trim().toLowerCase();
    return this.data.users.find((x) => x.username === u) || null;
  }

  createUser(username, password) {
    const u = String(username).trim().toLowerCase();
    if (!u) throw new Error("Gebruikersnaam is verplicht.");
    if (!password || password.length < 10) throw new Error("Wachtwoord moet minstens 10 tekens zijn.");
    if (this.getUserByName(u)) throw new Error("Gebruiker bestaat al.");
    const user = { id: randomUUID(), username: u, password: hashPassword(password), createdAt: new Date().toISOString() };
    this.data.users.push(user);
    this._save();
    return { id: user.id, username: user.username };
  }

  setPassword(username, password) {
    const user = this.getUserByName(username);
    if (!user) throw new Error("Gebruiker niet gevonden.");
    if (!password || password.length < 10) throw new Error("Wachtwoord moet minstens 10 tekens zijn.");
    user.password = hashPassword(password);
    this._save();
  }

  // Rate limiting: max attempts per window, per sleutel (username+ip).
  _rateBlocked(key, { max = 8, windowMs = 15 * 60 * 1000 } = {}) {
    const now = Date.now();
    const rec = this._rate.get(key);
    if (!rec || now > rec.resetAt) { this._rate.set(key, { count: 0, resetAt: now + windowMs }); return false; }
    return rec.count >= max;
  }
  _rateHit(key) {
    const rec = this._rate.get(key);
    if (rec) rec.count += 1;
  }
  _rateReset(key) { this._rate.delete(key); }

  // Geeft { ok, token, user } of { ok:false, reason }.
  login(username, password, rateKey) {
    if (this._rateBlocked(rateKey)) return { ok: false, reason: "rate" };
    const user = this.getUserByName(username);
    // Altijd een scrypt draaien (ook bij onbekende user) -> constante tijd.
    const valid = user ? verifyPassword(password, user.password) : (verifyPassword(password, this._dummy), false);
    if (!valid) { this._rateHit(rateKey); return { ok: false, reason: "credentials" }; }
    this._rateReset(rateKey);
    const token = randomBytes(32).toString("hex");
    // Alleen de hash van het token opslaan -> een gelekt auth-bestand geeft
    // geen bruikbare sessietokens.
    this.data.sessions[sha256(token)] = { userId: user.id, exp: Date.now() + SESSION_TTL_MS };
    this._save();
    return { ok: true, token, user: { id: user.id, username: user.username } };
  }

  userForToken(token) {
    if (!token) return null;
    const rec = this.data.sessions[sha256(token)];
    if (!rec) return null;
    if (Date.now() > rec.exp) { delete this.data.sessions[sha256(token)]; this._save(); return null; }
    const user = this.data.users.find((u) => u.id === rec.userId);
    return user ? { id: user.id, username: user.username } : null;
  }

  logout(token) {
    if (token && this.data.sessions[sha256(token)]) { delete this.data.sessions[sha256(token)]; this._save(); }
  }
}
