+++
date = "2026-11-05"
evidence = ["ISS-02", "base:d939d5f106c10ea1bc1b830b73242d75a76581b3"]
id = "DEC-04"
revised_at = "2026-11-05T19:41:16.9802354Z"
scope = ["skills/review-repeated-work/references/snippets.md"]
status = "accepted"
superseded_by = []
supersedes = []
title = "Snippets demonstrate each idea in three or more languages instead of covering every language"

[author]
agent = "shell"
person = "junovhs"
+++

# DEC-04: Snippets demonstrate each idea in three or more languages instead of covering every language

## Context

The person works in Ishoo's six languages. Snippets for all six at every step would bury the checklist.

## Decision

Each step shows the same move in Rust, Python and TypeScript (Go where useful), with one line naming the idea that stays the same.

## Why

The person's aim is that the reasoning is inferred, not that every language is covered. Seeing one idea in very different languages makes the invariant obvious.

## Alternatives rejected

One card per language (rejected: coverage instead of understanding). One language only (rejected: the agent copies syntax instead of learning the move).

## Consequences

Java and C++ users rely on the agent to translate; the profiler table in step 2 still names their tools.
