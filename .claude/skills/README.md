# Skills

Drie skills die samenwerken rond het bouwen van software met discipline: eerst valideren of iets waarde heeft, dan goed bouwen, dan netjes overdragen.

| Skill | Wanneer | Wat het doet |
|---|---|---|
| [`roast`](./roast.md) | Vóór je bouwt, als de waarde onzeker is | Roept een raad van 5 persona-agents op die een idee of klantklus afbreken én opbouwen; een Judge velt één eerlijk oordeel — GO / RESHAPE / KILL — met de goedkoopste test om het te de-risken. Flags: `--snel`, `--vergelijk`. |
| [`fullstack-architect`](./fullstack-architect.md) | Bij substantieel fullstack-werk | Denkkader van een senior/staff engineer: architectuur, security, performance, UX en anti-spaghetti. Geen checklist die je opdreunt, maar een manier van denken. Triggert niet op triviale wijzigingen. |
| [`handoff-template`](./handoff-template.md) | Bij oplevering of overdracht | Gestructureerde overdracht: wat gebouwd is, welke keuzes en waarom, risico's, hoe te testen, en wat nog open staat. |

## Hoe ze samenhangen

```
onzeker over de waarde?  ──►  /roast   (bouw ik het juiste ding?)
                                  │
                                  ▼
        bouwen/ontwerpen  ──►  fullstack-architect   (bouw ik het góed?)
                                  │
                                  ▼
              opleveren   ──►  handoff-template   (draag ik het netjes over?)
```

`fullstack-architect` verwijst zelf naar `/roast` (vóór substantieel bouwen bij onzekere waarde) en naar `handoff-template` (bij oplevering). De drie zijn bewust in het Nederlands en direct van toon: eerlijk advies wint van prettig advies.
