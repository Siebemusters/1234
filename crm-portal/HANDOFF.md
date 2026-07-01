# Handoff — CRM Portal (fullstack)
Datum: 2026-07-01 · Branch: claude/fullstack-architect-skill-0dfnng · Status: af (werkende MVP)

## 1. Wat & waarom
Een fullstack CRM-portal met backend die je zelf kunt draaien en waarin je alles bewerkt: klanten (incl. automatisch logo uit de website) en meerdere offertes per klant. Dashboard toont omzet, conversie, € per klant en de pipeline. Opvolger van de single-file `crm/` — die blijft staan als lichte variant.

## 2. Wat er gebouwd is
- `crm-portal/server.js` — HTTP-server (Node `http`), routing, static-serving, foutafhandeling.
- `crm-portal/lib/store.js` — datalaag: JSON-persistentie (atomische writes) + stats.
- `crm-portal/lib/validate.js` — inputvalidatie aan de rand.
- `crm-portal/public/` — frontend (`index.html`, `styles.css`, `app.js`), vanilla JS, Apple-achtig.
- `crm-portal/test/run.mjs` — integratietest (echte server + headless UI, 24 checks).
- `README.md`, `.gitignore`.

## 3. Belangrijke keuzes & trade-offs
- **Zero-dependency i.p.v. Express/React/Vite.** Niet uit principe, maar uit noodzaak: de npm-registry is in deze omgeving geblokkeerd (403). Puur Node + vanilla JS draait met `node server.js`, zonder install/build — betere portability en handoff. Trade-off: geen kant-en-klare framework-features; die schrijf je zelf (bewust klein gehouden).
- **JSON-opslag i.p.v. SQL.** Juist gedimensioneerd voor single-user. Datalaag is geïsoleerd (`lib/store.js`) zodat een swap naar SQLite/Postgres klein blijft.
- **Logo client-side via favicon.** Geen backend-proxy of API-key nodig; werkt direct. logo.dev-upgrade mogelijk via publishable token. Zie README.
- **Backend geeft na elke mutatie de volledige nieuwe state terug** → frontend hoeft geen aparte cache te synchen; simpel en consistent voor deze schaal.

## 4. Risico's & aandachtspunten
- **Geen authenticatie / geen HTTPS.** Lokale single-user portal. NIET online zetten met echte klantdata zonder auth + HTTPS + backups erbij (fase 2).
- **Logo-ophalen leunt op een externe bron** (Google favicons / logo.dev). Bij geen netwerk valt 'ie terug op initialen-avatar — getest, crasht niet. In deze testomgeving is die bron geblokkeerd, dus previews tonen de fallback; op een normale machine laden de favicons.
- **JSON-store is niet concurrency-safe** bij meerdere schrijvers tegelijk. Voor één gebruiker geen probleem; anders → echte database.
- **Validatie staat server-side** (rand), niet alleen in de UI. XSS afgevangen doordat de frontend user-tekst via `textContent` rendert, niet via innerHTML.

## 5. Hoe je het test / draait
- **Draaien:** `cd crm-portal && node server.js` → http://localhost:4000
- **Testen:** `cd crm-portal && node test/run.mjs` → verwacht "ALLE TESTS GESLAAGD" (24 checks). Tijdens het bouwen ving deze test een echte bug: het `hidden`-attribuut op de modal-overlay werd door `display:flex` overschreven waardoor de onzichtbare overlay alle klikken opving — gefixt met `.scrim[hidden]{display:none}`.

## 6. Wat er nog open staat
- [ ] Authenticatie + HTTPS + hosting (nodig vóór online gebruik met echte data).
- [ ] Echte database (SQLite/Postgres) bij multi-user.
- [ ] Zoeken/filteren/sorteren in de klantenlijst (nu ongesorteerd toegevoegd).
- [ ] Offerte-titel bewerken na aanmaken (nu alleen waarde + status inline aanpasbaar).
- [ ] Automatische back-up (nu: kopieer het JSON-bestand).

## 7. Voor de volgende stap
Als je dit online wilt gebruiken, is authenticatie de eerste en belangrijkste stap — niet meer features. Wil je het lokaal houden en uitbreiden, dan is zoeken/filteren in de klantenlijst de grootste dagelijkse winst. De swap naar SQLite is klein dankzij de geïsoleerde `lib/store.js` en pas nodig zodra meer dan één persoon tegelijk schrijft.
