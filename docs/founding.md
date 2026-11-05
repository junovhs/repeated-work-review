# repeated-work-review: founding

## What it is

A Claude Code skill: a checklist of twenty steps that an agent follows when
asked to find and remove repeated work. Each step says what to do and why, its
common traps, and points at short examples of the same move in several
languages. Measuring comes first and last; every finding is reported with a
place in the code, a number, and an evidence level (observed, likely safe,
proven).

## Who it is for

The person, first: someone who ships code with agents across Rust, TypeScript
and other languages, and who already asks agents to "look for repeated work"
because it reliably pays. If it proves itself on the evals, it may be published
for free.

## What it does

- Turns "look for repeated work" from reading and guessing into a measured
  procedure: pick a unit of work, profile it, count expensive operations per
  unit, check whether repeats had the same inputs and outputs, find every
  caller, fix one thing at a time, re-measure, report.
- Teaches each idea through the same move in Rust, Python, TypeScript and Go,
  so the agent can apply it in any language without per-language rules.
- Ships one drop-in script, `dom-probe.js`, for the browser measurements that
  no free tool covers: rebuilds that produce identical DOM, writes that change
  nothing, and forced reflows, per action, with call sites.

## What it won't do

- Be a profiler, an instrumenting build plugin, an MCP server or a hosted
  service.
- Re-implement what free tools already measure well: Chrome traces and their
  insights for browser cost, each language's native profiler for CPU.
- Guarantee that removing a repeat is safe. It reports evidence levels and the
  risks that were not checked.

## What proving the core showed

- **The idea works when it measures.** A throwaway dynamic probe, walked
  through mashu's eleven performance commits, caught every in-scope fix and a
  live regression nobody had noticed. Four of its signatures were revised after
  a first run, so that result is optimistic.
- **Precision held on an app it was not tuned for.** On a private app, with the
  expected findings written down first and the rules frozen, six of eight
  distinct findings pointed at code a later fix changed.
- **Recall depends on judging cost correctly.** Three expected items were in the
  data but filtered out because cost was judged by JavaScript time. In a
  browser, a cheap call can trigger expensive layout. A fixed threshold is the
  wrong tool; judgement plus the browser's own measurements is the right one.
  That is a large part of why this became a checklist for an agent rather than
  a rule engine.
- **Static rules alone are noisy.** An earlier static scanner's repeated-work
  rules, measured on 27 repositories, were cut for low signal-to-noise. Static
  analysis finds suspects; measurement decides.
- **The plumbing is where maintenance hides.** Build-time function wrapping
  broke across bundler versions and code styles. The shipped probe needs no
  build step.

## How it is checked

`evals/` holds repositories with a known answer: a start commit before their
performance work and the fixes that later landed. A fresh agent with the skill
is asked to review for repeated work, and its findings are scored against the
answer key, and against the same agent without the skill.
