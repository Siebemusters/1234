# CRM Portal

Een fullstack CRM-portal: Node-backend met REST-API + persistente opslag, en een Apple-achtige frontend. Klanten en offertes volledig bewerkbaar; logo's worden automatisch uit de website gehaald; meerdere offertes per klant.

**Zonder externe dependencies** — puur Node built-ins + vanilla JS. Geen `npm install`, geen build.

## Starten

Maak eerst een gebruiker (er is geen open registratie):

```bash
node create-user.mjs jouwnaam "een-sterk-wachtwoord"
```

of start met een env-bootstrap (alleen de eerste keer, als er nog geen users zijn):

```bash
CRM_ADMIN_USER=jouwnaam CRM_ADMIN_PASSWORD="een-sterk-wachtwoord" node server.js
```

Daarna:

```bash
node server.js
```

Open http://localhost:4000 en log in.

Config via env-vars:
- `PORT` — poort (default 4000)
- `CRM_DATA_FILE` — pad naar de CRM-datastore (default `crm-portal/data/crm.json`)
- `CRM_AUTH_FILE` — pad naar de auth-store met users + sessies (default `crm-portal/data/auth.json`)
- `CRM_ADMIN_USER` / `CRM_ADMIN_PASSWORD` — bootstrap-gebruiker als er nog geen bestaat

## Beveiliging

- **Wachtwoorden** met `scrypt` (memory-hard) + per-user salt, timing-safe vergeleken. Nooit md5/sha1.
- **Sessies** server-side; het cookie is `HttpOnly` + `SameSite=Strict`. Alleen de hash van het sessietoken staat opgeslagen.
- **Rate limiting** op login tegen brute-force; constante responstijd tegen user-enumeration.
- **CSRF**: SameSite=Strict + same-origin-check op elke mutatie.
- **Security-headers**: CSP, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`.
- **De auth-store staat in `data/`** en is via `.gitignore` uitgesloten — commit nooit wachtwoordhashes.

> ⚠️ **HTTPS is jouw verantwoordelijkheid.** Deze server praat platte HTTP. Op `localhost` prima, maar zodra je 'm host, zet 'm **achter een HTTPS reverse proxy** (Caddy/nginx) of een platform dat TLS afhandelt — anders reizen wachtwoord en sessiecookie onversleuteld. De `Secure`-cookievlag gaat automatisch aan zodra de server via HTTPS (of `X-Forwarded-Proto: https`) benaderd wordt.

## Functies

- **Dashboard:** totale omzet, conversie, € per klant, open offertes, omzet uit nieuwe klanten vs. upsell, upsell-kansen, en waarde per status.
- **Groei:** grafieken van omzet per maand, cumulatieve omzet (groeilijn) en nieuwe offertes per maand.
- **Upsell:** elke offerte is *Nieuw* of *Upsell*; het dashboard splitst de omzet en toont een belletjeslijst van warme klanten (eerder gewonnen, nu geen lopend traject).
- **Klanten:** toevoegen/bewerken/verwijderen (naam, website, e-mail, telefoon, notities).
- **Offertes:** meerdere per klant; titel-type, waarde, status en win-datum inline bewerkbaar. Win-datum wordt automatisch gezet bij winst en is terug te dateren voor historische deals. Klant verwijderen verwijdert diens offertes mee (cascade).
- **Logo automatisch:** vul de website in → het favicon van het domein verschijnt (128px), met een initialen-avatar als fallback.

### Echte merklogo's (optioneel)

Standaard gebruikt de app favicons (gratis, geen sleutel). Voor scherpere merklogo's via [logo.dev](https://logo.dev): open de browser-console en zet
```js
window.LOGO_DEV_TOKEN = "pk_jouw_publishable_token";
```
(logo.dev-tokens zijn publishable, dus veilig client-side.) Voor een permanente instelling: hardcode 'm in `public/app.js` bij `logoUrl`.

## Architectuur

```
server.js          HTTP-laag (routing, auth-middleware, static, headers) — dun
lib/store.js       Datalaag: JSON-persistentie + data-operaties + stats
lib/validate.js    Validatie aan de rand (elke input gecontroleerd)
lib/auth.js        Auth-laag: scrypt-hashing, sessies, rate limiting
create-user.mjs    CLI om gebruikers aan te maken/resetten
public/            Frontend (index.html, styles.css, app.js) — vanilla JS
test/run.mjs       Integratietest (echte server + auth + headless UI)
```

## Testen

```bash
node test/run.mjs
```

Start de echte server op een testpoort met een tijdelijke datastore en controleert de API (validatie, stats, cascade, path-traversal) en de UI-flow headless.

## Grenzen (bewust)

- **HTTPS niet inbegrepen.** Zie de beveiligingssectie: host altijd achter TLS.
- **JSON-opslag.** Prima voor een kleine gebruikersgroep; bij veel gelijktijdige schrijvers is een echte database (SQLite/Postgres) de volgende stap — de datalaag is bewust geïsoleerd zodat die swap klein blijft.
