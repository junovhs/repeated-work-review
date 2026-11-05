+++
date = "2026-11-05"
evidence = ["ISS-02", "base:d939d5f106c10ea1bc1b830b73242d75a76581b3"]
id = "DEC-02"
revised_at = "2026-11-05T19:41:16.2035728Z"
scope = ["skills/review-repeated-work/SKILL.md"]
status = "accepted"
superseded_by = []
supersedes = []
title = "Measure before claiming; every finding carries a number and an evidence level"

[author]
agent = "shell"
person = "junovhs"
+++

# DEC-02: Measure before claiming; every finding carries a number and an evidence level

## Context

Agents asked to look for repeated work read code and guess. Static repeated-work rules were cut for noise; the probe showed measurement finds what reading misses.

## Decision

The checklist measures first (profile, count per unit, compare inputs and outputs) and last (re-measure, keep only fixes that moved the number). Reports give each finding a place, a number and an evidence level: observed, likely safe, or proven.

## Why

Measurement is what separates this from asking the agent to guess, and evidence levels keep observed repetition from being presented as safe to remove.

## Alternatives rejected

A read-the-code review with heuristics (rejected: what already happens, with no evidence). Automatic proof of safety (rejected: not achievable for general code).

## Consequences

Reviews take longer and need a runnable unit of work. Findings without a measurement do not belong in the report.
