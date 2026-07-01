---
name: stresstest
description: Verifieer, stresstest en (op jouw akkoord) herstel een tool VÓÓR oplevering. Detecteert zelf de test/lint/build-commando's van het project (taalonafhankelijk), duwt de code tot hij breekt op randgevallen, foutafhandeling, security en load, en eindigt met een hard oordeel — KLAAR VOOR OPLEVERING of NIET KLAAR. Doel: geen enkele tool breekt bij de klant. Default is diagnose + fix-voorstel (jouw akkoord); `--fix` doet gelaagde auto-heal.
---

# /stresstest — De opleverkeuring

Jouw taak: bewijzen dat wat de gebruiker gaat opleveren **klopt, doet wat beloofd is, en niet breekt** — vóórdat de klant het aanraakt. Een tool die bij de klant breekt kost de gebruiker zijn reputatie en zijn vervolgopdracht. Deze skill is het filter dat dat tegenhoudt.

Dit is **niet** `/roast`. `/roast` beslist vóór je begint of iets geld oplevert. `/stresstest` bewaakt de kwaliteit bij oplevering. Meng ze niet: hier gaat het niet over marge of markt, maar over "houdt dit stand?".

## De gouden regel

> Je bent geen ja-knikker die "de tests zijn groen" roept om de gebruiker blij te maken. Je bent de laatste keuring vóór de klant. **Groen forceren door tests te versoepelen, te skippen of een probleem te verzwijgen is de duurste fout die je kunt maken** — je verplaatst de breuk gewoon naar de klant, waar hij het meeste kost. Liever een eerlijke NIET KLAAR dan een valse KLAAR.

---

## Twee kernconcepten

- **VERIFY** — "verify before delivery". Klopt het? Doet het wat is beloofd? Draait het überhaupt?
- **STRESS TEST** — duw het tot het breekt. Zoek de zwakke plekken vóór de klant ze vindt.

VERIFY zonder STRESS TEST levert schijnzekerheid ("werkt op mijn machine"). STRESS TEST zonder VERIFY test iets wat de belofte niet eens waarmaakt. Je doet altijd beide, in die volgorde.

---

## Modi

- **Default (diagnose):** je vindt problemen, geeft **per probleem één concreet fix-voorstel** (met aanpak/diff), en wacht op akkoord vóór je iets aanpast. Na een goedgekeurde fix hertest je om te bewijzen dat het echt groen is én dat je niks anders brak.
- **`--fix` (gelaagde auto-heal):** je fixt triviale zaken zelf en herhaalt tot groen, maar **stopt en vraagt** bij riskante wijzigingen. Zie STAP 3.

Herken `--fix` in de input. Zonder die vlag is diagnose de default — pas nooit ongevraagd code aan.

---

## STAP 0 — Detecteer stack & commando's (taalonafhankelijk, altijd eerst)

Hardcode nooit een taal of commando. Lees wat het project zelf gebruikt. Zoek in deze volgorde en pak wat aanwezig is:

| Signaal | Test | Lint / format | Typecheck | Build | Run |
|---|---|---|---|---|---|
| `package.json` | `scripts.test` / `jest` / `vitest` | `scripts.lint` / eslint / prettier | `tsc --noEmit` | `scripts.build` | `scripts.start` |
| `pyproject.toml` / `setup.cfg` / `tox.ini` | `pytest` / `tox` | `ruff` / `flake8` / `black --check` | `mypy` / `pyright` | — | `python -m ...` |
| `go.mod` | `go test ./...` | `go vet` / `golangci-lint` | (in build) | `go build ./...` | `go run` |
| `Cargo.toml` | `cargo test` | `cargo clippy` / `cargo fmt --check` | (in build) | `cargo build` | `cargo run` |
| `composer.json` | `phpunit` / `composer test` | `phpcs` / `phpstan` | `phpstan` | — | — |
| `Gemfile` | `rspec` / `rake test` | `rubocop` | — | — | — |
| `pom.xml` / `build.gradle` | `mvn test` / `gradle test` | checkstyle / spotbugs | (compiler) | `mvn package` | — |
| `Makefile` | `make test` | `make lint` | — | `make build` | `make run` |

**Regels:**
1. Geef expliciet weer wat je gedetecteerd hebt: "Ik draai `X` voor tests, `Y` voor lint, `Z` voor build."
2. Meerdere manifests (monorepo/polyglot)? Detecteer per onderdeel en draai per onderdeel.
3. **Niets gevonden → STAP 0-fallback:** verzin geen tests in stilte. Stel een minimale set smoke- en randgeval-tests voor die de belofte van de tool afdekt, **vraag akkoord**, en draai ze pas daarna. Zonder testbaarheid is het per definitie NIET KLAAR — ongetest opleveren is precies wat deze skill moet tegenhouden.

---

## STAP 1 — VERIFY (doet het wat beloofd is?)

1. **Draai de bestaande keten** die je in STAP 0 vond: build → typecheck → lint → tests. In die volgorde; een gebroken build maakt de rest zinloos.
2. **Happy path tegen de belofte.** Wat moet deze tool volgens de opdracht/scope doen? Draai het echte scenario en controleer dat de output klopt — niet dat het "geen error gaf", maar dat het het juiste doet.
3. **Rood in VERIFY = direct NIET KLAAR.** Noteer wat faalt en ga door naar SELF-HEAL; stresstesten van iets dat de basis niet haalt is verspilling.

> **VERIFY-uitkomst:** [groen / rood — wat draaide, wat faalde]

---

## STAP 2 — STRESS TEST (duw het tot het breekt)

Vier categorieën, **allemaal verplicht**. Per categorie: benoem concrete aanvalsvectoren, voer ze uit waar mogelijk (test/script/aanroep), en noteer wat breekt.

### 1. Randgevallen & foute input 🧨
Leeg, `null`/`undefined`, 0 en negatief, extreem groot, verkeerd type, verkeerde encoding/unicode/emoji, grenswaarden (off-by-one), dubbele/ontbrekende velden, gelijktijdige aanroepen. Vraag: wat gebeurt er bij input die de "gelukkige" ontwikkelaar nooit intypt?

### 2. Foutafhandeling & herstel 🔧
Crasht het netjes of stort het onbegrijpelijk in? Zijn foutmeldingen bruikbaar (geen stacktrace naar de eindgebruiker, geen stille `catch {}` die fouten opslokt)? Herstelt het na een fout, of blijft het in een kapotte staat hangen? Wat bij een falende externe afhankelijkheid (API down, timeout, lege response)?

### 3. Security 🔒
Injectie (SQL/command/path/prompt), ongevalideerde of niet-geëscapete input die ergens uitkomt (query, shell, HTML, bestandspad), **lekkende secrets** (keys/tokens/wachtwoorden in code, logs, output, error messages, of gecommit), onveilige defaults (open CORS, debug aan, admin zonder auth), en te ruime rechten. Dit is de categorie die de gebruiker het duurst kan komen te staan.

### 4. Load / performance ⏱️
Gedrag onder herhaling en volume: N+1 queries, ongebonden geheugengroei, blokkerende calls, geen paginatie/limiet, traagheid die lineair (of erger) meegroeit. **Default: cheap, niet-destructieve probes** — een verhoogde maar redelijke hoeveelheid, geen echte load-aanval op productie of externe systemen. Zwaar of destructief load-testen alleen op expliciet verzoek.

> **Zwakke plekken gevonden:** [genummerde lijst per categorie, of "geen" met bewijs]

---

## STAP 3 — SELF-HEAL

### Default (diagnose + fix-voorstel)
Per gevonden probleem:
1. **Diagnose** — root cause in één of twee zinnen, niet het symptoom.
2. **Eén concreet fix-voorstel** — de aanpak + de diff/het bestand dat verandert.
3. **Wacht op akkoord.** Pas niets ongevraagd aan.
4. **Na akkoord: toepassen + hertesten.** Bewijs dat het probleem weg is én dat je niks anders brak (draai de relevante checks opnieuw). Een fix zonder hertest telt niet als opgelost.

### `--fix` (gelaagde auto-heal)
- **Auto-fixen + herhalen tot groen** voor triviale, laag-risico zaken: lint/format, ontbrekende imports, duidelijke bugs, ontbrekende null-checks, ontbrekende input-validatie.
- **Stop en vraag akkoord** bij riskante zaken: logica-/gedragswijziging, tests verwijderen of versoepelen, security-gevoelige code, data/migraties, publieke API/contract-wijzigingen.
- Rapporteer **elke** aanpassing die je deed, met waarom.

### Anti-cheat regels (niet-onderhandelbaar)
1. **Nooit een test versoepelen, skippen, of assertions verwijderen om groen te forceren.** Als een test faalt, fix de code — niet de test. Moet een test echt aangepast (was hij fout), zeg dat expliciet en vraag akkoord.
2. **Nooit een probleem verzwijgen** omdat het lastig is. Onopgelost hoort in het rapport.
3. **Elk "opgelost" is bewezen met een hertest.** Geen hertest = niet opgelost.

---

## Output Formaat

```
## 🔎 /stresstest — [Wat gekeurd wordt, max 6 woorden]

**Gedetecteerd:** test=`...` · lint=`...` · build=`...`   (of: geen — fallback gebruikt)

### 1. VERIFY ✅ — doet het wat beloofd is?
[Wat draaide, uitkomst. Happy path tegen de belofte.]
> VERIFY-uitkomst: 🟢 / 🔴 ...

### 2. STRESS TEST 🧪 — duw tot het breekt
**Randgevallen & foute input:** [bevindingen]
**Foutafhandeling & herstel:** [bevindingen]
**Security:** [bevindingen]
**Load / performance:** [bevindingen]

### 3. SELF-HEAL 🔧 — [modus: diagnose / --fix]
[Per probleem: diagnose → fix-voorstel of toegepaste fix → hertest-resultaat]

---

## SCOREBORD
| Categorie | Bevinding | Status |
|---|---|---|
| VERIFY (belofte) | [kernwoord] | 🟢 / 🟡 / 🔴 |
| Randgevallen & input | [kernwoord] | 🟢 / 🟡 / 🔴 |
| Foutafhandeling | [kernwoord] | 🟢 / 🟡 / 🔴 |
| Security | [kernwoord] | 🟢 / 🟡 / 🔴 |
| Load / performance | [kernwoord] | 🟢 / 🟡 / 🔴 |

## GEVONDEN & HERSTELD
| # | Probleem | Categorie | Status | Bewijs (hertest) |
|---|---|---|---|---|
| 1 | ... | ... | ✅ hersteld / ⏳ wacht op akkoord / ❌ open | ... |

## OORDEEL: [KLAAR VOOR OPLEVERING / NIET KLAAR]
[2-3 zinnen. Bij NIET KLAAR: exact wat er nog moet gebeuren. Bij KLAAR: wat is gedekt en wat bewust buiten scope bleef.]

## VOLGENDE STAP
[Één concrete actie. Bij open problemen: welke fix akkoord nodig heeft. Bij KLAAR: opleveren.]
```

🟢 houdt stand · 🟡 zwak punt, geen blokker · 🔴 breekt / onveilig

---

## KILL CRITERIA (harde regels voor het oordeel)

Deze overrulen elke neiging om "klaar" te zeggen:

1. **VERIFY faalt → altijd NIET KLAAR.** Iets dat de basis niet haalt lever je niet op.
2. **Security 🔴 → altijd NIET KLAAR.** Een injectie, een lekkende secret of een onveilige default is een showstopper, hoe klein de tool ook is.
3. **Een niet-herstelde crash op realistische input → NIET KLAAR.** Randgevallen die de klant redelijkerwijs raakt, tellen als realistisch.
4. **Groen bereikt door tests te versoepelen/skippen → NIET KLAAR.** Ongeacht de kleur van de balk.
5. **Open 🔴 dat op akkoord wacht → NIET KLAAR** tot het akkoord er is en de hertest groen is.

Alleen als geen enkel kill-criterium geraakt is en alle 🔴 dicht zijn, mag het oordeel **KLAAR VOOR OPLEVERING** zijn. Bij twijfel tussen KLAAR en NIET KLAAR: NIET KLAAR. Daarvoor bestaat deze skill.

---

## Skill vs hook (waarom beide bestaan)

- Deze **skill** is de redenering hierboven — krachtig, maar draait alléén als je `/stresstest` aanroept.
- De **hook** (`.claude/hooks/stresstest-gate.sh`, geregistreerd in `settings.json`) dwingt af dat je het niet vergeet: hij draait automatisch bij het afronden van een turn met code-wijzigingen, checkt snel de gedetecteerde tests en herinnert je aan `/stresstest` vóór oplevering. Een hook draait een shell-commando, geen redenering — hij kan dus signaleren en blokkeren, maar de eigenlijke keuring doe je met deze skill.
