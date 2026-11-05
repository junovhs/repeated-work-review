# Evals

A skill is judged by what it finds, so this directory holds cases with a known
answer: real repositories at a commit before their performance fixes, with the
fixes that later landed as the answer key.

How to run a case:

1. Start a fresh agent session with the skill installed, in a checkout of the
   repository at the case's start commit.
2. Prompt: *"Review this app for repeated work."* Give it no hints from the
   answer key.
3. Compare its findings with the answer key. Score each expected item as
   found / found but dismissed / missed, and each extra finding as real or
   noise (read the code to decide).

Record results in `results/` with the skill commit you tested, so changes to
the skill can be compared.

Cases that involve private repositories live in `local/` (git-ignored).

## Case: tiny-pipeline (smoke test, run this first)

A 90-line Python script with four planted repeats and three decoys, in
`cases/tiny-pipeline/`. It runs in under half a second, so a whole review should
take minutes. Copy only `app/` somewhere the agent can't see the answer key,
then ask it to review that folder with the unit of work `python pipeline.py`.
Score against `cases/tiny-pipeline/answer-key.md`. Run it after every change to
the skill, before the slow cases.

## Case: mashu (MashuPack)

Browser TypeScript with a Rust/WASM core. Public:
[junovhs/mashu](https://github.com/junovhs/mashu).

- **Start commit:** `b44ad4a^` (2026-05-21, before PERF-01)
- **Setup:** `npm install`, `wasm-pack build rust-core --target web --out-dir pkg`
  (on Windows with a long path, set a short `CARGO_TARGET_DIR`), `npm run dev`.
  Load a folder of a few thousand files.
- **Answer key** (in-scope repeated work, fixed in later commits):

| Fix | Repeated work |
|---|---|
| PERF-01 (introduced) | one checkbox click refreshes the whole UI twice: the optimistic update and the worker reply both notify |
| PERF-02 | a checkbox click rebuilds every visible tree row |
| PERF-03 | a burst of clicks runs the full refresh once per click |
| PERF-04 | scrolling rebuilds rows that stay on screen |
| PERF-05 | a text-layout library forces a reflow per tree row |
| PERF-06 | switching back to the report tab rebuilds an unchanged report |
| PERF-07 | the stats panel rebuilds identically on each click |
| PERF-08 | each click re-filters the entire scan to recount the selection; cost grows with project size |
| PERF-09 | the text-layout library re-renders every bound element during a sidebar drag |
| regression in PERF-09 | `refreshSelectionUI` brings back the whole-scan filter PERF-08 removed; still present at HEAD |

PERF-10 (CSS containment for the sidebar drag) is layout cost, not repeated
work, and is out of scope.

Reference result: a dynamic probe built while designing this skill found all
nine in-scope items and the regression, with four of its signatures revised
after a first run (see the design notes in the repository history).
