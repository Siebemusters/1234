# CRM Portal

Een fullstack CRM-portal: Node-backend met REST-API + persistente opslag, en een Apple-achtige frontend. Klanten en offertes volledig bewerkbaar; logo's worden automatisch uit de website gehaald; meerdere offertes per klant.

**Zonder externe dependencies** — puur Node built-ins + vanilla JS. Geen `npm install`, geen build.

## Starten

```bash
node server.js
```

Open daarna http://localhost:4000.

Config via env-vars:
- `PORT` — poort (default 4000)
- `CRM_DATA_FILE` — pad naar het datastore-bestand (default `crm-portal/data/crm.json`)

## Functies

- **Dashboard:** totale omzet, conversie, € per klant, open/gesloten offertes, waarde openstaande offertes, waarde per status.
- **Klanten:** toevoegen/bewerken/verwijderen (naam, website, e-mail, telefoon, notities).
- **Offertes:** meerdere per klant; titel, waarde en status inline bewerkbaar. Klant verwijderen verwijdert diens offertes mee (cascade).
- **Logo automatisch:** vul de website in → het favicon van het domein verschijnt (128px), met een initialen-avatar als fallback.

### Echte merklogo's (optioneel)

Standaard gebruikt de app favicons (gratis, geen sleutel). Voor scherpere merklogo's via [logo.dev](https://logo.dev): open de browser-console en zet
```js
window.LOGO_DEV_TOKEN = "pk_jouw_publishable_token";
```
(logo.dev-tokens zijn publishable, dus veilig client-side.) Voor een permanente instelling: hardcode 'm in `public/app.js` bij `logoUrl`.

## Architectuur

```
server.js          HTTP-laag (routing, static, foutafhandeling) — dun
lib/store.js       Datalaag: JSON-persistentie + data-operaties + stats
lib/validate.js    Validatie aan de rand (elke input gecontroleerd)
public/            Frontend (index.html, styles.css, app.js) — vanilla JS
test/run.mjs       Integratietest (echte server + headless UI)
```

## Testen

```bash
node test/run.mjs
```

Start de echte server op een testpoort met een tijdelijke datastore en controleert de API (validatie, stats, cascade, path-traversal) en de UI-flow headless.

## Grenzen (bewust)

- **Single-user, geen login.** Bedoeld als lokale/interne portal. Zet dit niet zonder authenticatie + HTTPS online met echte klantdata.
- **JSON-opslag.** Prima voor één gebruiker; bij meerdere gelijktijdige gebruikers is een echte database (SQLite/Postgres) de volgende stap — de datalaag is bewust geïsoleerd zodat die swap klein blijft.
