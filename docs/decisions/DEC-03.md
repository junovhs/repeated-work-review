+++
date = "2026-11-05"
evidence = ["ISS-02", "base:d939d5f106c10ea1bc1b830b73242d75a76581b3"]
id = "DEC-03"
revised_at = "2026-11-05T19:41:16.6131286Z"
scope = ["skills/review-repeated-work/scripts/", "skills/review-repeated-work/references/browser.md"]
status = "accepted"
superseded_by = []
supersedes = []
title = "Browser measurement through a standalone page script and Chrome traces, no build-time instrumentation"

[author]
agent = "shell"
person = "junovhs"
+++

# DEC-03: Browser measurement through a standalone page script and Chrome traces, no build-time instrumentation

## Context

The prototype wrapped every function at build time through the app's Vite server. It worked but coupled the probe to Vite versions, TypeScript syntax and code style. Chrome already measures style and layout cost well.

## Decision

Ship dom-probe.js, injected before the app runs, which hooks DOM APIs and attributes events by stack trace. Use Chrome traces (DevTools or chrome-devtools-mcp) for browser cost.

## Why

DOM APIs are stable, so the probe keeps working without upkeep, and stack traces map back to source under a dev server. Rebuilding Chrome's cost model would be worse and endless.

## Alternatives rejected

Build-time function wrapping (dropped: maintenance). Our own cost model from CDP counters (rejected: Chrome's insights are better).

## Consequences

No same-arguments-per-call rule in the browser script; the checklist covers that with temporary counters. Checked on mashu: it reports the PERF-02 rebuild before the fix and not after.
