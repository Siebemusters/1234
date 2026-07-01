# Session Handoff

> Een herbruikbare end-of-session samenvatting zodat je `/clear` kunt doen en met een verse agent verder kunt zonder continuïteit te verliezen. De volgende agent moet het werk kunnen oppakken door alleen deze samenvatting te lezen.

Dit is een **context-handoff artifact**, geen statusrapport. De doelgroep is een toekomstige instantie van jezelf, niet een stakeholder.

## Wanneer gebruiken

Bij: "session handoff", "wrap up session", "hand off", "handoff summary", "let's wrap up", "summarize before I clear", of iets vergelijkbaars. Gebruik het ook proactief als je op het punt staat te `/clear`en zonder eerst een handoff te maken.

## Hoe de samenvatting maken

1. **Bekijk het volledige gesprek**, niet alleen de laatste paar beurten. Handoffs missen dingen als ze alleen recente context samenvatten.
2. **Haal state uit deze bronnen (in volgorde):**
   - Plan-bestanden die deze sessie zijn gebruikt.
   - TodoWrite state — taken die in-progress of pending zijn.
   - Achtergrondprocessen gestart met `run_in_background` — shell IDs zijn cruciaal voor de volgende agent.
   - Bestanden die deze sessie zijn aangemaakt of gewijzigd — je weet wat je hebt aangeraakt; grep niet om het opnieuw te ontdekken.
   - Memory-bestanden die zijn geschreven of bijgewerkt.
   - Onopgeloste vragen — dingen die je de gebruiker vroeg zonder duidelijk antwoord, of dingen die de gebruiker vroeg die zijn ontweken.
3. **Doe GEEN filesystem-audit.** Dit is synthese van wat er in DEZE sessie gebeurde. Geen `git log`, geen brede `Glob`-sweeps. Als je het deze sessie niet hebt aangeraakt, hoort het hier niet.
4. **Produceer de output in chat.** Schrijf geen bestand. Update geen memory. Alleen chat.

## Output-template — gebruik exact deze structuur, elke keer

```
# Session Handoff — <one-line title of what this session was about>

## Where it started
<2-3 sentences: what the user asked for, key framing or constraints that emerged>

## Decisions locked + what shipped
- <decision or change> — <why, and where it lives (absolute path if a file)>
- ...

## Key files for next session
- `<absolute path>` — <why the next agent should read this first>
- Plan file: `<path>` (if a plan drove the session)
- Memory files touched: `<paths>` (if any)

## Running state
- Background processes: <shell IDs + what they are + how to kill> — or "none"
- Dev servers / ports: <url + port> — or "none"
- Open worktrees / branches: <paths> — or "none"

## Verification — how to confirm things still work
- `<command>` — <expected outcome>
- ...

## Deferred + open questions
- Deferred: <item> — <why pushed to later>
- Open: <question needing the user's input> — <context>

## Pick up here
<1-2 sentences: the single most likely next action for a fresh agent>
```

## Harde regels

1. **Alleen chat-output.** Schrijf de handoff nooit naar een bestand. Update nooit memory vanuit deze skill.
2. **Verzin nooit state.** Als een sectie niets te melden heeft, schrijf "none" — laat de sectie niet weg. Structuurstabiliteit is het hele punt.
3. **Altijd absolute paden.** De volgende agent kan een andere working directory hebben.
4. **Als een plan-bestand de sessie stuurde, noem het als eerste** in "Key files" zodat de volgende agent het als eerste leest.
5. **Geen emoji's, geen hype, geen "great job"-samenvattingen.** Beknopt en concreet — paden, commando's, shell IDs, beslissingen. Toon van een ervaren engineer die aan het einde van de dienst overdraagt.
6. **Achtergrondproces-IDs zijn cruciaal.** Als je `run_in_background`-shells hebt gestart, moeten hun IDs in "Running state" staan met het kill-commando — de volgende agent kan ze anders niet vinden.

## Anti-patterns — doe deze niet

- De laatste 3 beurten samenvatten en dat een handoff noemen.
- Bestanden met relatieve paden opsommen.
- De "Running state"-sectie overslaan omdat "er niks draait" — schrijf in plaats daarvan "none".
- De samenvatting naar een bestand schrijven. Dit is per definitie alleen chat.
- Een "what went well / what went poorly" retrospective toevoegen. Dit is geen retro.
- Volgende stappen aanbevelen buiten de ene "Pick up here"-regel. De volgende agent beslist; jij draagt alleen over.
