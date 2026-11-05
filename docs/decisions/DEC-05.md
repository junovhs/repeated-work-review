+++
date = "2026-11-05"
evidence = ["ISS-02", "base:d939d5f106c10ea1bc1b830b73242d75a76581b3"]
id = "DEC-05"
revised_at = "2026-11-05T19:41:17.385246Z"
scope = ["evals/", ".gitignore"]
status = "accepted"
superseded_by = []
supersedes = []
title = "Private repositories stay out of this public repo; work lands through Ishoo"

[author]
agent = "shell"
person = "junovhs"
+++

# DEC-05: Private repositories stay out of this public repo; work lands through Ishoo

## Context

The repo is public. Eval cases come partly from private repositories, and the first change went through a GitHub pull request because Ishoo was not connected.

## Decision

Cases from private repositories live in evals/local/, which is git-ignored; public docs name private projects but do not describe their code. Changes land locally through Ishoo (claim, land), not through pull requests by default.

## Why

Publishing private code by accident is not reversible. The person works through Ishoo; a pull request was a sign of being on the wrong tools.

## Alternatives rejected

Publishing private cases redacted (rejected: easy to leak). Pull requests for every change (rejected: the person's workflow is Ishoo).

## Consequences

Private eval results can be summarised publicly only as scores. A session started outside a repository must connect Ishoo, or use ishoo call, before landing.
