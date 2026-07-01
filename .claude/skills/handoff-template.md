---
name: handoff-template
description: Gebruik dit wanneer werk moet worden overgedragen aan een andere developer, een volgende sessie, of aan de gebruiker zelf na afronding — of wanneer iemand vraagt om een "handoff", een overdracht, een samenvatting van wat er gebouwd is, of een "wat is er gedaan en wat staat nog open". Genereert een gestructureerde overdracht: wat gebouwd is, welke keuzes gemaakt zijn en waarom, welke risico's er zijn, hoe je het test, en wat er nog open staat. Wordt automatisch aangeroepen door de fullstack-architect skill bij oplevering, maar werkt ook los.
argument-hint: "[wat er af is / het werk om over te dragen]"
---

# Handoff Template

Een handoff is geen changelog en geen commit-message. Het is het document dat de volgende persoon — een andere developer, een toekomstige jij, of de gebruiker — in vijf minuten laat begrijpen wat er is gebeurd, waarom, en waar hij moet oppassen. Als de overdracht dat niet doet, is hij waardeloos.

## De gouden regel

> Schrijf voor iemand die de context niet heeft. Aannames die in jouw hoofd vanzelfsprekend zijn, zijn voor de ontvanger onzichtbaar. Elke keuze die je niet uitlegt, wordt straks blind teruggedraaid of verkeerd voortgezet. Wees eerlijk over wat níet af is — een verzwegen losse eindje is duurder dan een eerlijk "dit staat nog open".

## Wat je doet

1. **Verzamel de feiten, verzin niets.** Baseer de handoff op wat er echt is gewijzigd (diff, bestanden, commits), niet op wat je van plan was. Klopt iets niet met de code, dan wint de code.
2. **Vul de template hieronder in.** Sla een sectie alleen over als hij écht niet van toepassing is — zet er dan `n.v.t.` bij, laat 'm niet stilletjes weg.
3. **Wees expliciet over open eindjes en risico's.** Dit is het belangrijkste deel. Een handoff die alleen het goede nieuws vertelt, is een val.
4. **Houd het skimbaar.** Kopjes, bullets, korte zinnen. De ontvanger scant eerst, leest daarna.

## De template

```
# Handoff — [korte titel van het werk]
Datum: [datum] · Branch/PR: [ref] · Status: [af / af m.u.v. open punten / work in progress]

## 1. Wat & waarom
[2-4 zinnen: welk probleem loste dit op, voor wie. Niet "wat de code doet" maar "waarom dit bestaat".]

## 2. Wat er gebouwd/gewijzigd is
- [Bestand/module] — [wat er veranderde, in één regel]
- ...
[Groepeer per laag of feature als het veel is. Geen dump van elke regel — de belangrijke dingen.]

## 3. Belangrijke keuzes & trade-offs
- [Keuze] — [waarom, en wat het alternatief was]
[Alleen de keuzes die niet vanzelfsprekend zijn. Dit voorkomt dat iemand ze blind terugdraait.]

## 4. Risico's & aandachtspunten
- [Wat kan er stuk / waar moet de volgende persoon opletten]
- [Security-, data- of performance-punten die relevant blijven]

## 5. Hoe je het test / draait
[Concrete stappen: welk commando, welke env-vars, hoe je de happy path én een faalscenario checkt. Geen "npm start" zonder context.]

## 6. Wat er nog open staat
- [ ] [Losse eindjes, bewust overgeslagen scope, bekende bugs, TODO's]
[Leeg? Zeg dan expliciet "niets open" — geen lege sectie laten raden.]

## 7. Voor de volgende stap
[Eén of twee zinnen: als ik verderging, zou ik hier beginnen. Concreet.]
```

## Regels

- **Verzin geen groene vinkjes.** Is iets niet getest, zeg dat het niet getest is. Faalde een test, zet 'm bij open punten.
- **Geen jargon zonder uitleg** als de ontvanger mogelijk niet-technisch is (bijv. de gebruiker zelf). Pas het register aan op wie het leest.
- **Kort waar het kan, lang waar het moet.** Sectie 4 (risico's) en 6 (open punten) mogen nooit worden ingekort om het af te laten lijken.
- **Secrets, tokens en interne credentials horen niet in een handoff.** Verwijs naar waar ze staan (secret manager, env), plak ze nooit in.
