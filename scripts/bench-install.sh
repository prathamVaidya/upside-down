#!/usr/bin/env bash
#
# Measure how long `bun install` takes from a clean tree, across the four cache
# states that actually occur in practice.
#
# The everyday number and the fresh-machine number differ by about two orders of
# magnitude, and almost all of that gap is one dependency's postinstall rather
# than the packages, so a single figure is not worth much. This reports all four:
#
#   warm          node_modules deleted, both caches present — what you feel daily
#   cold-packages bun's package cache cleared, Cypress binary kept
#   cold-cypress  Cypress binary cleared, bun's package cache kept
#   fully-cold    both cleared — a machine that has never seen this project
#
# CAUTION: this deletes node_modules and *temporarily moves your global caches
# aside*. They are restored on exit, including on Ctrl-C or failure. Stop any
# dev server first — it will be reading node_modules while this deletes it.
#
#   scripts/bench-install.sh                       all scenarios, 3 warm runs
#   scripts/bench-install.sh --runs 5              more samples for the warm case
#   scripts/bench-install.sh --scenario warm       just the everyday number
#   scripts/bench-install.sh --frozen              refuse to update the lockfile
#   scripts/bench-install.sh --json out.json       machine-readable, for diffing
#
# Cold scenarios need network. Each is measured once — they are dominated by
# download time, so repeating them mostly measures your connection twice.

set -euo pipefail

RUNS=3
SCENARIO=all
JSON_OUT=""
INSTALL_FLAGS=""

while [ $# -gt 0 ]; do
  case "$1" in
    --runs) RUNS="${2:?--runs needs a number}"; shift 2 ;;
    --scenario) SCENARIO="${2:?--scenario needs a name}"; shift 2 ;;
    --json) JSON_OUT="${2:?--json needs a path}"; shift 2 ;;
    --frozen) INSTALL_FLAGS="--frozen-lockfile"; shift ;;
    # Prints the header block: everything from line 2 up to the first line that
    # is not a comment. Beats a hard-coded line range, which silently drifts.
    -h|--help) awk 'NR > 1 { if (!/^#/) exit; sub(/^# ?/, ""); print }' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

case "$SCENARIO" in
  all|warm|cold-packages|cold-cypress|fully-cold) ;;
  *) echo "unknown scenario: $SCENARIO" >&2; exit 2 ;;
esac

cd "$(dirname "$0")/.."
ROOT="$PWD"

command -v bun >/dev/null || { echo "bun is not on PATH" >&2; exit 1; }

LOG="$(mktemp)"

# ---------------------------------------------------------------- cache paths

BUN_CACHE="$(bun pm cache)"

# Resolved from the environment rather than by asking Cypress, because by the
# time a cold scenario runs there is no node_modules to ask.
if [ -n "${CYPRESS_CACHE_FOLDER:-}" ]; then
  CYPRESS_CACHE="$CYPRESS_CACHE_FOLDER"
elif [ "$(uname -s)" = "Darwin" ]; then
  CYPRESS_CACHE="$HOME/Library/Caches/Cypress"
else
  CYPRESS_CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/Cypress"
fi

# ------------------------------------------------------- move aside / restore
#
# Cold runs refill the cache they cleared, so restoring means discarding what
# the run built and putting the original back — not just moving it home.

MOVED=()

move_aside() {
  local dir="$1"
  if [ -e "$dir" ]; then
    rm -rf "$dir.bench-bak"
    mv "$dir" "$dir.bench-bak"
    MOVED+=("$dir")
  fi
}

restore_caches() {
  local dir
  for dir in ${MOVED[@]+"${MOVED[@]}"}; do
    rm -rf "$dir"
    if [ -e "$dir.bench-bak" ]; then mv "$dir.bench-bak" "$dir"; fi
  done
  MOVED=()
}

on_exit() {
  local rc=$?
  restore_caches
  rm -f "$LOG"
  if [ $rc -ne 0 ]; then
    echo
    echo "interrupted — caches restored. node_modules may be incomplete; run: bun install"
  fi
}
trap on_exit EXIT INT TERM

# -------------------------------------------------------------------- helpers

clean_modules() {
  rm -rf "$ROOT/node_modules" \
         "$ROOT"/apps/*/node_modules \
         "$ROOT"/packages/*/node_modules \
         "$ROOT"/tools/*/node_modules
}

# Times one `bun install` and echoes the seconds. Uses bash's own `time` so
# nothing is spawned around the measurement; `date +%s%N` is not portable to
# macOS and shelling out to a runtime would add tens of milliseconds to a
# number that is barely over one second.
# Result goes in LAST_SECONDS rather than stdout. Echoing it and capturing with
# $(...) would put the failure branch inside a subshell, where `exit` only kills
# the subshell — the caller then sees an empty string and a bare `set -e` abort
# with bun's actual error message discarded.
LAST_SECONDS=""

timed_install() {
  local secs rc
  set +e
  secs=$( { TIMEFORMAT='%3R'; time bun install $INSTALL_FLAGS >"$LOG" 2>&1; } 2>&1 )
  rc=$?
  set -e
  if [ $rc -ne 0 ]; then
    echo "bun install failed (exit $rc):" >&2
    tail -20 "$LOG" >&2
    return 1
  fi
  LAST_SECONDS="$secs"
}

# median of the values on stdin, one per line
median() {
  sort -n | awk '{ v[NR] = $1 } END {
    if (NR == 0) { print "n/a"; exit }
    printf "%.3f", (NR % 2) ? v[(NR + 1) / 2] : (v[NR / 2] + v[NR / 2 + 1]) / 2
  }'
}

human_size() { du -sh "$1" 2>/dev/null | cut -f1 || echo "-"; }

RESULTS=()
record() { RESULTS+=("$1|$2|$3"); }

# ------------------------------------------------------------------- scenarios

want() { [ "$SCENARIO" = all ] || [ "$SCENARIO" = "$1" ]; }

echo "benchmarking bun install in $ROOT"
echo "  bun cache      $BUN_CACHE"
echo "  cypress cache  $CYPRESS_CACHE"
echo

# Prime, so "warm" genuinely means warm and the first timed run is not paying
# for everything the others get for free.
echo "priming caches (untimed)…"
bun install >"$LOG" 2>&1 || { echo "priming install failed" >&2; tail -20 "$LOG" >&2; exit 1; }

if want warm; then
  echo
  echo "warm — $RUNS runs"
  samples=""
  for i in $(seq 1 "$RUNS"); do
    clean_modules
    timed_install || exit 1
    t="$LAST_SECONDS"
    echo "  run $i: ${t}s"
    samples="$samples$t"$'\n'
  done
  med="$(printf '%s' "$samples" | median)"
  echo "  median: ${med}s"
  record warm "$med" "$RUNS"
fi

cold_scenario() {
  local scen="${1:?cold_scenario needs a scenario name}"; shift
  echo
  echo "$scen — 1 run"
  local dir
  for dir in "$@"; do move_aside "$dir"; done
  clean_modules
  local t rc=0
  timed_install || rc=$?
  # Put the caches back before reacting to a failure, so a failed cold run does
  # not leave the machine without its caches.
  restore_caches
  [ $rc -eq 0 ] || exit 1
  t="$LAST_SECONDS"
  echo "  ${t}s"
  record "$scen" "$t" 1
}

if want cold-packages; then cold_scenario cold-packages "$BUN_CACHE"; fi
if want cold-cypress;  then cold_scenario cold-cypress  "$CYPRESS_CACHE"; fi
if want fully-cold;    then cold_scenario fully-cold    "$BUN_CACHE" "$CYPRESS_CACHE"; fi

# Leave the tree in a state somebody can work in.
echo
echo "restoring a working install…"
clean_modules
bun install >"$LOG" 2>&1 || true

# Counted here rather than from the priming run: priming installs into a tree
# that already has node_modules, so bun reports what it *checked*, not what it
# installed. This one follows a clean_modules, so it reports the real figure.
PACKAGES="$(grep -oE '[0-9]+ packages installed' "$LOG" | grep -oE '^[0-9]+' | head -1 || true)"
[ -n "$PACKAGES" ] || PACKAGES="?"

# --------------------------------------------------------------------- report

BUN_VERSION="$(bun --version)"
OS="$(uname -s) $(uname -m)"
CORES="$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo '?')"
LOCK_HASH="$( { shasum bun.lock 2>/dev/null || sha1sum bun.lock 2>/dev/null; } | cut -c1-12 )"
NPM_MS="$(curl -s -o /dev/null -m 8 -w '%{time_total}' https://registry.npmjs.org/zod 2>/dev/null || echo '-')"

echo
echo "=============================================================="
printf '%-16s %10s %8s\n' "scenario" "seconds" "runs"
echo "--------------------------------------------------------------"
for row in ${RESULTS[@]+"${RESULTS[@]}"}; do
  printf '%-16s %10s %8s\n' "${row%%|*}" "$(echo "$row" | cut -d'|' -f2)" "${row##*|}"
done
echo "=============================================================="
echo "bun $BUN_VERSION · $OS · ${CORES} cores"
echo "packages: $PACKAGES · lockfile: $LOCK_HASH · npm RTT: ${NPM_MS}s"
echo "node_modules: $(human_size "$ROOT/node_modules") · bun cache: $(human_size "$BUN_CACHE") · cypress cache: $(human_size "$CYPRESS_CACHE")"

if [ -n "$JSON_OUT" ]; then
  {
    echo '{'
    echo "  \"bun\": \"$BUN_VERSION\","
    echo "  \"os\": \"$OS\","
    echo "  \"cores\": \"$CORES\","
    echo "  \"packages\": \"$PACKAGES\","
    echo "  \"lockfile\": \"$LOCK_HASH\","
    echo "  \"npmRttSeconds\": \"$NPM_MS\","
    echo "  \"frozen\": $( [ -n "$INSTALL_FLAGS" ] && echo true || echo false ),"
    echo '  "results": ['
    n=${#RESULTS[@]}
    for i in $(seq 0 $((n - 1))); do
      row="${RESULTS[$i]}"
      sep=","; [ $i -eq $((n - 1)) ] && sep=""
      printf '    { "scenario": "%s", "seconds": %s, "runs": %s }%s\n' \
        "${row%%|*}" "$(echo "$row" | cut -d'|' -f2)" "${row##*|}" "$sep"
    done
    echo '  ]'
    echo '}'
  } > "$JSON_OUT"
  echo
  echo "wrote $JSON_OUT"
fi
