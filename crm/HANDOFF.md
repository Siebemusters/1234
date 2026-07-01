# Handoff — CRM Sunkissed Dune (Fase 1)
Datum: 2026-07-01 · Branch: claude/fullstack-architect-skill-0dfnng · Status: af (MVP)

## 1. Wat & waarom
Een persoonlijke CRM waarin je handmatig klanten en deals bijhoudt, zodat je in één scherm ziet hoeveel omzet je maakt, wat je conversie is, hoeveel euro per klant je genereert, en hoe je pipeline (open/gesloten deals + waarde per status) ervoor staat. Geen externe API's — bewust, omdat het om jouw eigen handmatig ingevoerde cijfers gaat.

## 2. Wat er gebouwd/gewijzigd is
- `crm/index.html` — de volledige app: één zelfstandig bestand (HTML + CSS + vanilla JS), geen dependencies, geen build.
- `crm/smoke-test.mjs` — headless test (Playwright/Chromium) op de metric-berekening + UI-flow.
- `crm/README.md` — gebruiksuitleg.

## 3. Belangrijke keuzes & trade-offs
- **Single-file HTML + localStorage i.p.v. React+Vite+SQLite.** Voor een persoonlijke, handmatige CRM is een build-tool + database-server overkill (fullstack-architect §10). Kleinste architectuur die het correct oplost, draait door het bestand te openen. Alternatief (backend) is bewust uitgesteld tot er een concrete reden is (multi-device/cloud).
- **Twee entiteiten: Klant → Deals (1-op-veel).** Nodig om zowel "€ per klant" (klant-telling) als "aantal deals / waarde per status" (deal-telling) correct te berekenen.
- **Conversie = gewonnen ÷ totaal deals.** Bewuste definitie; staat expliciet in de UI zodat er geen misverstand is. (Alternatief: gewonnen ÷ gesloten — niet gekozen, maar één regel aan te passen als je dat liever hebt.)
- **Open = Nieuw/In gesprek/Voorstel; Gesloten = Gewonnen/Verloren.**

## 4. Risico's & aandachtspunten
- **Data leeft in `localStorage`** — op dit apparaat/deze browser. Browserdata wissen = data weg. Mitigatie: Exporteren/Importeren (JSON-back-up) zit erin, maar het is handmatig; er is geen automatische back-up.
- **Geen multi-user / geen auth.** Dit is een lokale single-user tool; niet bedoeld om online te hosten met gevoelige klantdata zonder extra werk (auth, backend, HTTPS).
- **Input-validatie is client-side** (naam verplicht, waarde ≥ 0, deal moet klant hebben). Prima voor een lokale tool; zodra er een backend komt, moet validatie ook server-side (fullstack-architect §3).
- **XSS afgevangen** via HTML-escaping van alle door de gebruiker ingevoerde tekst bij het renderen.

## 5. Hoe je het test / draait
- **Draaien:** open `crm/index.html` in een browser.
- **Testen:** `node crm/smoke-test.mjs` — verwacht "ALLE TESTS GESLAAGD" (12 checks: metric-berekening met bekende dataset, deling-door-nul edge case, en end-to-end klant+deal toevoegen).

## 6. Wat er nog open staat
- [ ] Klant/deal **bewerken** (nu alleen toevoegen, status wijzigen, verwijderen).
- [ ] Datum per deal + omzet-over-tijd (nu is er geen tijdlijn).
- [ ] Automatische back-up / cloud-sync (nu handmatig via export).
- [ ] Instagram/LinkedIn-koppeling: niet in scope, en voor persoonlijke profielen grotendeels niet mogelijk via API (aparte discussie).

## 7. Voor de volgende stap
Als je verderging, zou ik beginnen bij **bewerken van bestaande deals/klanten** (kleinste ingreep, grootste dagelijks gemak). Wil je omzet-over-tijd zien, dan is de tweede stap een `datum`-veld op de deal + een simpele lijn-grafiek. Cloud/multi-device is pas nodig als je het op meerdere apparaten wilt gebruiken — dán pas een backend.
