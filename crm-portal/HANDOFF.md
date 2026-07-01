# Handoff — CRM Portal (fullstack, met auth)
Datum: 2026-07-01 · Branch: claude/fullstack-architect-skill-0dfnng · Status: af (werkende MVP met login)

## 1. Wat & waarom
Een fullstack CRM-portal met backend die je zelf kunt draaien en waarin je alles bewerkt: klanten (incl. automatisch logo uit de website) en meerdere offertes per klant. Achter een login. Dashboard toont omzet, conversie, € per klant en de pipeline. Opvolger van de single-file `crm/` — die blijft staan als lichte variant.

## 2. Wat er gebouwd is
- `crm-portal/server.js` — HTTP-server (Node `http`), routing, auth-middleware, security-headers, static-serving, foutafhandeling.
- `crm-portal/lib/store.js` — datalaag: JSON-persistentie (atomische writes) + stats.
- `crm-portal/lib/validate.js` — inputvalidatie aan de rand.
- `crm-portal/lib/auth.js` — auth: scrypt-hashing, server-side sessies, rate limiting.
- `crm-portal/create-user.mjs` — CLI om gebruikers te maken/resetten.
- `crm-portal/public/` — frontend (`index.html`, `styles.css`, `app.js`), vanilla JS, Apple-achtig, met inlogscherm.
- `crm-portal/test/run.mjs` — integratietest (echte server + auth + headless UI, 28 checks).
- `README.md`, `.gitignore`.

## 2b. Beveiliging (wat er in zit)
- Wachtwoorden: `scrypt` + per-user salt, timing-safe vergelijking.
- Sessies: server-side, cookie `HttpOnly` + `SameSite=Strict`; alleen tokenhash opgeslagen.
- Rate limiting op login; constante responstijd tegen user-enumeration.
- CSRF: SameSite=Strict + same-origin-check op mutaties.
- Security-headers: CSP, nosniff, `X-Frame-Options: DENY`, Referrer-Policy.
- Auth-store staat in `data/` (gitignored) — hashes komen niet in git.

## 3. Belangrijke keuzes & trade-offs
- **Zero-dependency i.p.v. Express/React/Vite.** Niet uit principe, maar uit noodzaak: de npm-registry is in deze omgeving geblokkeerd (403). Puur Node + vanilla JS draait met `node server.js`, zonder install/build — betere portability en handoff. Trade-off: geen kant-en-klare framework-features; die schrijf je zelf (bewust klein gehouden).
- **JSON-opslag i.p.v. SQL.** Juist gedimensioneerd voor single-user. Datalaag is geïsoleerd (`lib/store.js`) zodat een swap naar SQLite/Postgres klein blijft.
- **Logo client-side via favicon.** Geen backend-proxy of API-key nodig; werkt direct. logo.dev-upgrade mogelijk via publishable token. Zie README.
- **Backend geeft na elke mutatie de volledige nieuwe state terug** → frontend hoeft geen aparte cache te synchen; simpel en consistent voor deze schaal.

## 4. Risico's & aandachtspunten
- **HTTPS ontbreekt bewust — dit is de belangrijkste openstaande beveiligingsstap.** Zonder TLS reizen wachtwoord + sessiecookie onversleuteld. Host achter een HTTPS reverse proxy. De `Secure`-cookievlag gaat vanzelf aan achter HTTPS / `X-Forwarded-Proto: https`.
- **Sessies + rate-limit-teller worden bij herstart deels geladen/gereset.** Sessies overleven herstart (opgeslagen); de in-memory rate-limit-teller reset bij herstart — acceptabel, maar bij een herstart-loop verdwijnt de brute-force-rem tijdelijk.
- **Logo-ophalen leunt op een externe bron** (Google favicons / logo.dev). Bij geen netwerk valt 'ie terug op initialen-avatar — getest, crasht niet. In deze testomgeving is die bron geblokkeerd; op een normale machine laden de favicons.
- **JSON-store is niet concurrency-safe** bij meerdere schrijvers tegelijk. Voor een kleine groep prima; anders → echte database.
- **Validatie staat server-side** (rand), niet alleen in de UI. XSS afgevangen doordat de frontend user-tekst via `textContent` rendert, niet via innerHTML.

## 5. Hoe je het test / draait
- **Gebruiker maken:** `node create-user.mjs <naam> <wachtwoord>` (min. 10 tekens).
- **Draaien:** `cd crm-portal && node server.js` → http://localhost:4000 → inloggen.
- **Testen:** `cd crm-portal && node test/run.mjs` → verwacht "ALLE TESTS GESLAAGD" (28 checks: auth, CSRF, rate-limit, security-headers, CRUD, stats, cascade, path-traversal, UI-login/logout). Deze test ving twee echte bugs tijdens het bouwen: (1) het `hidden`-attribuut werd door `display:flex` overschreven (eerst de modal-overlay, later de nav op het inlogscherm) → globaal gefixt met `[hidden]{display:none!important}`; (2) rate-limit-uitputting van admin blokkeerde de UI-login (testfout, opgelost met wegwerp-username).

## 6. Wat er nog open staat
- [ ] **HTTPS/hosting** — de belangrijkste stap vóór online gebruik met echte data.
- [ ] Echte database (SQLite/Postgres) bij een grotere gebruikersgroep.
- [ ] Wachtwoord wijzigen vanuit de UI (nu alleen via `create-user.mjs`).
- [ ] Zoeken/filteren/sorteren in de klantenlijst.
- [ ] Offerte-titel bewerken na aanmaken (nu alleen waarde + status inline).
- [ ] Automatische back-up (nu: kopieer de bestanden in `data/`).

## 7. Voor de volgende stap
Auth zit erin; **HTTPS/hosting is nu de belangrijkste beveiligingsstap** vóór dit online gaat — geen extra features. Daarna is zoeken/filteren in de klantenlijst de grootste dagelijkse winst. De swap naar SQLite is klein dankzij de geïsoleerde `lib/store.js`/`lib/auth.js`.
