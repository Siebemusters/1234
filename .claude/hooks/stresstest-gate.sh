#!/usr/bin/env bash
# stresstest-gate.sh — lichte Stop-gate voor de /stresstest skill.
#
# Draait automatisch bij het afronden van een turn (Stop-hook). Doel: je nooit
# ongeverifieerde code laten opleveren zonder het door te hebben. De ZWARE keuring
# (randgevallen, security, load, self-heal) doe je met de /stresstest skill zelf —
# deze gate is alleen een snelle vangrail + herinnering.
#
# Gedrag:
#   - Geen code-wijzigingen in de working tree -> stil exit 0 (geen ruis op Q&A-turns).
#   - Wel wijzigingen: detecteer het snelste testcommando en draai het.
#       * tests rood       -> exit 2 (blokkeert stop; stderr gaat terug naar Claude)
#       * geen testcommando -> exit 0 met herinnering
#       * tests groen      -> exit 0 met herinnering
#
# Exit code 2 is de conventie waarmee een hook Claude tegenhoudt en de reden meegeeft.
#
# Uitzetten? Verwijder de Stop-hook uit .claude/settings.json.

set -uo pipefail

# --- Alleen ingrijpen als er daadwerkelijk iets gewijzigd is -------------------
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if git diff --quiet && git diff --cached --quiet; then
    exit 0   # niets gewijzigd -> niets te keuren
  fi
else
  # Geen git-repo: we kunnen wijzigingen niet detecteren. Alleen herinneren.
  echo "stresstest-gate: geen git-repo — draai /stresstest handmatig vóór oplevering." >&2
  exit 0
fi

# --- Detecteer het snelste testcommando (taalonafhankelijk) -------------------
TEST_CMD=""
have() { command -v "$1" >/dev/null 2>&1; }

if [ -f package.json ] && grep -q '"test"' package.json 2>/dev/null; then
  if have npm; then TEST_CMD="npm test --silent"; fi
elif [ -f pyproject.toml ] || [ -f pytest.ini ] || [ -f tox.ini ] || [ -f setup.cfg ]; then
  if have pytest; then TEST_CMD="pytest -q"; fi
elif [ -f go.mod ]; then
  if have go; then TEST_CMD="go test ./..."; fi
elif [ -f Cargo.toml ]; then
  if have cargo; then TEST_CMD="cargo test --quiet"; fi
elif [ -f composer.json ] && have phpunit; then
  TEST_CMD="phpunit"
elif [ -f Gemfile ] && have rspec; then
  TEST_CMD="rspec"
elif [ -f Makefile ] && grep -qE '^test:' Makefile 2>/dev/null; then
  TEST_CMD="make test"
fi

REMIND="Draai /stresstest (verify + stresstest + self-heal) vóór je dit oplevert."

if [ -z "$TEST_CMD" ]; then
  echo "stresstest-gate: code gewijzigd, geen testcommando gedetecteerd. $REMIND" >&2
  exit 0
fi

echo "stresstest-gate: code gewijzigd — snelle check via: $TEST_CMD" >&2
if eval "$TEST_CMD" >/tmp/stresstest-gate.log 2>&1; then
  echo "stresstest-gate: snelle tests groen. $REMIND" >&2
  exit 0
else
  echo "stresstest-gate: TESTS ROOD. Niet opleveren. Draai /stresstest en herstel eerst." >&2
  echo "----- laatste regels testoutput -----" >&2
  tail -n 20 /tmp/stresstest-gate.log >&2
  exit 2
fi
