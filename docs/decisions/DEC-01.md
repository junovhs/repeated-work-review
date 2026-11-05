+++
date = "2026-11-05"
evidence = ["ISS-02", "base:d939d5f106c10ea1bc1b830b73242d75a76581b3"]
id = "DEC-01"
revised_at = "2026-11-05T19:41:15.7949973Z"
scope = ["skills/", "README.md", ".claude-plugin/"]
status = "accepted"
superseded_by = []
supersedes = []
title = "Ship as a skill, not a tool, MCP server or webpage"

[author]
agent = "shell"
person = "junovhs"
+++

# DEC-01: Ship as a skill, not a tool, MCP server or webpage

## Context

A dynamic probe proved the idea, but its build-time instrumentation broke across bundler versions and code styles, and fixed thresholds cut real findings. Options were a standalone tool, an MCP server on mcp-product-infra that guides the agent, a SKILL.md, or a documented webpage.

## Decision

Deliver a Claude Code skill: SKILL.md holds the checklist, references/ and scripts/ hold detail and drop-in measurement, opened on demand.

## Why

The person wanted a binder the agent opens and works through with judgement. A skill is exactly that, is plain files in git, needs no running process, and converges on maintenance; the agent absorbs stack edge cases that a tool would have to code for.

## Alternatives rejected

Standalone tool (rejected: endless plumbing, rigid rules). MCP server (deferred: only worth it to enforce step order if agents skip measuring in practice). Webpage (later, generated from the same files, for publishing).

## Consequences

Quality depends on the agent following the steps, so it is judged by evals, not by reading. Measurement code ships as small optional scripts.
