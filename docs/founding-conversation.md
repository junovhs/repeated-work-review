# Founding conversation

The design session of 2026-11-05 between the person (junovhs) and the agent,
lightly tidied and shortened. Details of private repositories are left out;
they are referred to by name only.

## The idea

**Person:** I'm constantly asking the AI that writes code for me to look for
repeated work and eliminate it. It always results in a performance increase,
sometimes exponentially so. So I wondered if we could make some sort of scanner,
and ran a research report. Thoughts?

**Agent:** The report (a survey of redundancy detection: compiler value
numbering, MemoizeIt, REDSPY/LOADSPY, Toddler, TRAVIOLI, Coz) is sound. Its best
ideas: separate *observed repetition* from *likely reuse* from *proven safe*;
profile with a "shadow cache" that never changes behaviour; screen broadly,
then analyse narrowly. But it designs a research-grade memoization profiler,
and MemoizeIt's wins were 1.04x to 12.93x. Exponential wins come from changing
complexity class (a search inside a loop, a rebuild per item, N+1 calls), which
the report schedules last. It also never mentions an LLM, which is what has
actually been working.

## The person's own history

**Person:** Also look at omni-ast and semclear; those dealt a lot with AST stuff.

**Agent:** The archived Neti scanner already had static repeated-work rules on
omni-ast (clone in a loop, nested loops, search in a loop, N+1), calibrated on
27 real repositories and then cut for noise (nested-loop signal-to-noise as low
as 25%). Sorting about 240 of the person's own performance commits showed the
big wins were mostly not single-function patterns: the same input re-derived by
different callers (omni-ast parsing each file about 19 times; one tool
recomputing embeddings per call, about two minutes down to under a second),
and whole rebuilds when one part changed.

**Person:** Look at noceremony (TypeScript, a lot of work there) and keyjam.
Then mashupack (the repo is mashu).

**Agent:** In the browser apps the repeated work is mostly in the render loop:
rebuilding when nothing changed, the same call twice per action, interleaved
reads and writes forcing layout, per-event work, work nobody sees. mashu has
eleven small, separate performance commits, an ideal test bench.

## Proving the core

The agent built a throwaway dynamic probe (function wrapping through the app's
own Vite server, DOM write hooks, per-action episodes) and walked it through
mashu's history. It caught all nine in-scope fixes, four of them only after
signatures were revised, and found a regression nobody had noticed: a later
change brought back a whole-scan filter on every click that an earlier fix had
removed. It is still in mashu today.

**Person:** I consider mashupack done; don't build things into it. You can use
it for benching.

**Person:** How confident are you we could turn this into my vision? It's a
developer tool for me, maybe free on npm if it's good.

**Agent:** Fairly confident for the browser half, a separate bet for Rust. The
mashu result is weaker than it looks because the agent knew the answers. A
blind-ish test would settle it.

**Person:** Yes.

The agent pre-registered the expected findings for noceremony at a commit before
its September performance work, froze the rules, and ran. Six of eight distinct
findings pointed at code a later fix changed. Recall was weak (2.5 of 8
expected items), and three more were in the data but cut by a 1 ms JavaScript-
time floor, because in a browser the cost of a call is often the layout it
triggers, not the call.

## Is it worth building?

**Person:** We are just trying to answer if it's worth building. Does something
free already do this better? Could I string free things together? Is the scope
bounded, or am I signing up to maintain this forever?

**Agent:** Chrome's own tools (the Performance panel's forced-reflow insight,
chrome-devtools-mcp) already measure browser cost, better than the prototype.
React has re-render tools, which don't apply to vanilla TypeScript. Nothing
maintained catches identical rebuilds, writes that change nothing, or repeated
calls per action in non-React apps. The in-page probe is the bounded part; the
build-time function wrapping is where the endless edge cases live, and it can
be dropped. Publishing for other people's stacks is where scope stops
converging.

**Person:** You were all excited about omni-ast and semclear and slopchop.

**Agent:** That was a hypothesis that was never tested. The person's own data
argues against static detection of individual waste patterns (Neti's rules were
cut for noise), while the biggest Rust win is a call-graph question that omni-ast
could answer. Untested either way.

## The pivot: a program of prompts

**Person:** Maybe we formulate a program of prompts. We treat the AI as the
functions. It's told "review for repeated work", opens a binder of procedures
and snippets it can use broadly, and uses its judgement going through the steps.

**Person:** Not a record of everything that happened. A checklist of 20 steps or
fewer, at the level of "build a pivot table to determine xyz". It tells you what
to do, not how.

**Person:** Not one-line instructions: one or two paragraphs per step, with
script fragments it could use or not, concepts, common traps, best practices.

**Person:** It's less that I want options for every language and more that I
want to demonstrate the same idea in three or more languages, so the underlying
reasoning is inferred well. Should this be an MCP server on mcp-product-infra,
a SKILL.md, or a documented webpage?

**Agent:** A skill. That is literally the binder: a short checklist that loads
when relevant, references and scripts opened on demand, plain files in git. An
MCP server would only add value by enforcing the order (refusing step 7 until
step 4's counts are in), which is worth doing only if real use shows agents
skipping measurement. A webpage is for publishing, generated from the same
files.

**Person:** Make a new repo for this and build the skill setup. Make it public.

## Working through Ishoo

**Person:** Why are you using GitHub pull requests and not Ishoo? I'm not against
pull requests, but most work should now be done locally and through Ishoo, and
that was a sign you weren't on the right tools.

**Agent:** The session had started without a repository, so Ishoo's MCP server
never connected and the agent fell back to a branch and pull request without
noticing. The skill was re-landed through Ishoo (ISS-01) and the pull request
closed.

**Person:** I approve all.
