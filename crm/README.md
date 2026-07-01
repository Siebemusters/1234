# CRM — Sunkissed Dune

Een minimalistische, persoonlijke CRM voor het handmatig bijhouden van klanten en deals. Toont in één blik: totale omzet, conversie, € per klant, open/gesloten deals, waarde van openstaande deals en de waarde per status.

## Gebruiken

Open `index.html` in je browser. Dat is alles — geen server, geen installatie.

- **Klant toevoegen:** vul onderaan bij *Klanten* een naam in (bedrijf/e-mail optioneel).
- **Deal toevoegen:** kies een klant, vul waarde + status in bij *Deals*.
- **Status wijzigen:** verander de status direct in de dropdown in de deal-rij; de metrics updaten meteen.
- **Back-up:** *Exporteren* schrijft een JSON-bestand weg; *Importeren* leest 'm terug.

## Waar leeft de data?

In `localStorage` van je browser — dus op dit apparaat, in deze browser. Er is géén server en géén cloud-sync.

**Let op:** browserdata wissen = data weg. Maak regelmatig een back-up via *Exporteren*. Wil je later multi-device of cloud-opslag, dan is dat een aparte fase met een backend.

## Statussen

`Nieuw` · `In gesprek` · `Voorstel` → gelden als **open**.
`Gewonnen` · `Verloren` → gelden als **gesloten**.

- **Omzet** = som van *Gewonnen* deals.
- **Conversie** = gewonnen deals ÷ totaal deals.
- **€ per klant** = omzet ÷ aantal klanten.

## Test

```
node crm/smoke-test.mjs
```

Draait headless (Chromium via Playwright) en controleert de metric-berekening, de deling-door-nul edge case en de UI-flow.
