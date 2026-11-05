---
name: review-repeated-work
description: Find and remove repeated or wasted work in code — duplicate computation, the same input parsed or derived more than once, identical DOM rebuilds, writes that change nothing, forced reflows, N+1 calls, loop-invariant work, full recomputes when one part changed. Use when asked to look for repeated work, redundant or wasted computation, unnecessary re-renders or re-parsing, or to make code faster by not doing the same job twice. Starts with a fast pass that reports ranked suspects in about 15 minutes; deeper measurement only when asked.
---

# Review for repeated work

Repeated work is the same job done more than once for one unit of work: the
same input, producing the same output, again. Removing it is often the largest
speedup available, sometimes by orders of magnitude, because the waste tends
to multiply (per item, per stage, per frame).

## Start with the fast pass. Always.

The person asked a question and is waiting for an answer. Your first report
is due in **about 15 minutes**, and it must be at least as fast and as useful as
an ordinary "look for repeated work" without this skill. Thoroughness that
costs the person their afternoon is a failure, not rigour.

1. **Find the hot path.** Read the entry point for the work the person named
   (or the obvious main operation) and follow it to where the time plausibly
   goes. Use the lenses in steps 7–13 below as a quick mental checklist, not as
   separate investigations.
2. **Measure only with what is already at hand**, and only if it takes a few
   minutes: an existing build or binary, the project's own bench or test
   command, a timer or counter around one call, stats the program already
   prints. One run is fine; say it was one run.
3. **Report.** List the suspects ranked by likely cost, each with the place in
   the code, what repeats per unit, the number if you have one, and an honest
   evidence level (*suspect* if you only read it). Then name the one or two
   measurements that would confirm the top suspects, and how long each would
   take.

During the fast pass, **do not**, without asking first:

- start a build that takes more than a few minutes, or install or repair a
  toolchain;
- push a branch, open a pull request, dispatch CI, or run jobs on another
  machine;
- plan repeated runs, medians, or more than one data size;
- change code.

If something can't be measured quickly (the build is broken here, the unit
needs a GPU you don't have), don't work around it. Report the suspects as
suspects and say what measuring would take.

If you are going to exceed about 15 minutes for any reason, stop and give
the person what you have, then ask.

## The deep pass: only when the person asks for it

After the fast-pass report, the person may ask to confirm findings, to fix
them, or for a full review. Then work through the checklist below. Tell them
up front roughly how long it will take and what it will run, and report each
finding as soon as it is confirmed rather than at the end.

The checklist says **what** to do at each step and why. It does not
dictate how: use judgement and the tools of the stack in front of you. Short
examples of the same move in several languages are in
[references/snippets.md](references/snippets.md), indexed by step number. They
are there to show the idea, not to be pasted. For browser apps, also read
[references/browser.md](references/browser.md).

Three rules hold throughout:

- **Measure before you claim.** Reading code finds suspects; only a count or a
  timing makes one a finding. Label anything unmeasured as a suspect, never
  as a finding.
- **Judge per unit of work.** "Ran twice" means nothing until you say twice per
  *what*.
- **Separate what you saw from what is safe.** Observing a repeat is not proof
  that removing it is correct.

## The checklist

### 1. Pick the unit of work you're judging

Repeated work only means something relative to a unit: "this ran twice" is
waste for one click and normal for two clicks. Name the unit precisely. In a UI
it is one user action plus everything it causes until the page goes quiet. In
a server it is one request. In a CLI or pipeline it is one run, or one item
flowing through every stage. Choose units people actually wait on, and pick 3–6
that cover different paths (a small edit, a bulk action, a scroll, a load):
different redundancies hide in different paths.

Make each unit repeatable — a script, a test, a command — because every later
step compares against it.

Traps: a unit so big that one action's repeats blur into the next action's
legitimate work. Ending the unit when the handler returns instead of when
debounced, async and worker work has landed. Testing only tiny data (keep a
large fixture ready for step 12). Mixing load and warm-up into the action being
judged.

### 2. Measure where the time goes before reading code

Profile the unit before forming opinions. Code that looks wasteful is often
cheap, and the real cost often sits somewhere boring. The profile gives you the
short list worth reading and the baseline number step 19 compares against.

Use the stack's own profiler and capture both time and counts. In browser apps
the cost is frequently not JavaScript at all but the style, layout and paint
that JavaScript triggered, so use a trace that shows browser work, not only a
JS CPU profile.

Traps: trusting one run (use the median of 3–5; JIT warm-up lies in both
directions). Confusing self time (who does the work) with total time (who
triggers it). A 0.02 ms call that triggers 80 ms of layout looks free in a JS
profile. Profiling a debug build when the release build behaves differently.

### 3. List the expensive operations in the unit

From the profile, plus a quick read of what it points at, list the operations
that are inherently costly: parsing, querying, hashing, serializing, file and
network I/O, building or replacing DOM, geometry reads, large copies and
allocations, model or embedding calls, process spawns. Aim for 5–15 items:
things that would hurt if they happened twice. Include operations that are cheap
now but scale with data.

Traps: skipping costs because they are inside a library (`JSON.parse`, a
regex compile, a tree-sitter parse and `innerHTML` are expensive whoever calls
them). Missing hidden costs: a getter that reads layout, a clone of a large
value, a lazy-loading ORM attribute. A 60-item list means step 2 was not used.

### 4. Count how many times each one runs per unit

For each listed operation, count how often it actually runs in one unit. This
is the cheapest, highest-yield measurement in the checklist: most real
redundancy first shows up here, as a number bigger than it should be — a
refresh twice per click, a file parsed in three stages, a layout read per row.
Write the count you expected next to the count you got.

Traps: counters that are not reset per unit. Missing work that runs later in
promises, timers, workers or animation frames. Counting calls when the cost is
per item inside one call (count iterations or bytes too). Leaving the counters
in: they are temporary.

### 5. For each repeat, check whether its inputs changed

A repeat is waste only if it did the same job. Fingerprint the inputs of each
over-counted operation on every call and see how many calls in one unit shared
a fingerprint. Same input more than once is the core signal. Different inputs
each time means the calls did different jobs, and the question moves to step 8
(did it need to redo all of it?).

Inputs are everything the result depends on, not only arguments: module state
it reads, files it opens, DOM it measures, the clock. Start with arguments,
then ask what else it reads.

Traps: fingerprints that cost more than the work (use primitives as-is, length
plus a fast hash for strings, object identity before deep structure). Mixing up
identity and equality: the same reference can hold different contents after a
mutation. Functions with no arguments always fingerprint the same; look at what
they read first. Unordered collections need a stable order before hashing.

### 6. Check whether its output changed

Fingerprint the result of each repeated call too. Same input and same output is
a confirmed repeat. Same input and different output means a hidden input
exists, and you must find it before caching anything (step 17). For code that
produces DOM, files or database rows instead of return values, the output is
what it wrote: compare what was there before with what is there after.

The strongest form of this signal is a rebuild that produces exactly what it
replaced: rows torn down and re-created byte-identical, a file rewritten with
the same bytes, a value written that was already there.

Traps: comparing after post-processing (another step rewrites the node or
file, so it never looks identical; compare the producer's output at the moment
it was produced). Treating "output differs" as "not waste" when only a small
part differs (that is step 8).

### 7. Find every caller

For each confirmed repeat, find who asks for it. The largest wins usually come
from different places independently deriving the same thing: three pipeline
stages each parsing the file, two event paths each refreshing the UI, a render
and a helper each scoring the same list. One call site looks innocent on its
own; the waste is only visible across them.

Use the call graph (language server references, a static analysis tool, or a
search), then confirm with the counts from step 4 which callers actually fire
in this unit.

Traps: fixing one caller with a local cache while the others keep deriving.
Missing callers reached through events, callbacks or dynamic dispatch, which a
static search does not show. Search for the event or message name too.

### 8. Look for whole rebuilds where only part changed

Compare the size of what changed with the size of what was redone. Checking one
box and rebuilding every visible row, editing one field and rewriting the whole
store, completing one task and redrawing a calendar that is not even open: the
input changed a little and the work redone was everything.

The fix is usually incremental (patch only what changed, keep an index from key
to element or record) or a skip (compare a cheap signature of the new result
with the old one and do nothing when they match).

Traps: assuming a framework already diffs (many do not, and hand-rolled
renderers rarely do). Building the incremental path but leaving a full rebuild
on another trigger. A signature that costs as much as the rebuild.

### 9. Look for work in loops that doesn't depend on the loop

Anything computed inside a loop body whose inputs don't change across
iterations is computed N times for one result: resolving a path, compiling a
regex, building a lookup set, reading configuration, querying the same row.
Also check loops that scan a collection for each item of another collection: a
search inside a loop is a hidden nested loop, O(n·m), usually fixable with a
map built once.

Traps: hoisting something that does change (the loop body mutates its input,
or it reads time or a counter). A loop that exits on the first hit is not
O(n·m) even though it contains a search.

### 10. Look for per-event work that should be batched

High-frequency events — pointer moves, scroll, resize, keystrokes, file-watch
notifications, streaming messages — can each trigger full work when only the
last result matters. Look for work per event that could run once per frame,
once after the events settle, or once per batch. Look also for many independent
timers or loops that could share one clock.

Traps: coalescing work whose intermediate results are visible or needed
(typing echo, progress). Debouncing user feedback that must feel immediate:
update the cheap visible part now and defer the expensive part.

### 11. Look for work whose result nobody sees

Some work produces nothing observable: values overwritten before being read,
writes of a value that is already there, drawing off-screen, animating hidden
elements, timers and loops that keep running while idle or after the thing they
served is gone, canvases far larger than what is visible. Measure an idle unit
(nobody touching anything) as well as active ones: anything that runs then is a
candidate.

Traps: removing work that looks idle but drives something real (a countdown, a
sync, a health check). Check what consumes it first.

### 12. Check whether cost grows with data when the change doesn't

Run the same unit at two data sizes, for example 1x and 4x. An action that
changes one thing should cost about the same at both. If a function's cost grows
with the data size, it is probably redoing work over the whole dataset that
only needed to touch the changed part. This is how quadratic and full-scan
behaviour shows itself before it hurts.

Traps: judging from one noisy measurement (require the growth across several
units). Flagging work that is legitimately proportional to the data (loading,
a full export, scoring every item by design).

### 13. Check this repo's history for past fixes of the same kind

Search the history for earlier performance fixes: commit messages mentioning
cache, debounce, once, re-render, duplicate, redundant, incremental. Codebases
repeat their mistakes. A past fix shows where this team's waste tends to come
from, which patterns are already in use for removing it, and occasionally a
regression: a later change that quietly reintroduced what an earlier fix
removed.

Traps: assuming a past fix still holds. Re-check the counts on the code paths
it touched.

### 14. Drop candidates that are cheap or inherent

Cut anything that doesn't matter: small helpers called many times at
negligible cost (escaping, clamping, formatting), work that is proportional to
the problem by design, and one-off costs that are not repeats (first-use
initialization, which may still deserve moving off the critical path, but is a
different finding). Keep a short list.

Traps: judging cost by the call alone. A cheap call that triggers expensive
work elsewhere (a layout, a full invalidation, a network request) is not cheap.
Charge it with what it causes.

### 15. Rank by measured cost on the path people wait on

Order the remaining findings by how much time they put on the path the user,
request or run actually waits on. Local CPU saved is not the same as wall-clock
saved: work that runs in parallel with something slower, or after the response
is sent, may not matter at all, while a few milliseconds in a keystroke handler
can. Report CPU time, browser time and latency separately rather than folding
them into one score.

Traps: ranking by repeat count instead of cost. Ignoring work that runs off the
critical path but contends for the same thread.

### 16. Choose the kind of fix

Match each finding to its fix:

| Finding | Usual fix |
|---|---|
| Same derivation from several callers | Compute once, pass it down or keep it in one shared place keyed by input |
| Same input, same output, repeated over time | Cache keyed by the real inputs, with explicit invalidation |
| Whole rebuild for a small change | Patch in place, or skip when a cheap signature is unchanged |
| Loop-invariant work | Hoist out of the loop |
| Search inside a loop | Build a map or index once |
| Per-event work | Coalesce: once per frame, after settling, or per batch |
| Writes that change nothing | Write only when the value differs |
| Reading layout between writes | Do all reads, then all writes |
| Work nobody sees | Delete it, stop it when idle, or bound it to what is visible |

Prefer removing the repeat over caching it. A cache is a second copy of the
truth that must be kept correct; computing once and passing the result along is
not.

### 17. Note what could make reuse unsafe

Before reusing a result, list what could make the old result wrong: inputs not
in the key (time, randomness, environment, global or module state, the
filesystem, the network); mutation of an input after it was used; side effects
that callers rely on (logging, metrics, a write, acquiring a lock, advancing an
iterator); identity, where callers expect a fresh object; ordering and
concurrency, where two identical calls also synchronize something; errors,
where a cached result would hide a retry. Say which of these you checked and how.

Traps: concluding "pure" because a function has no writes. Reading mutable
state makes it depend on that state.

### 18. Apply fixes one at a time

Make one change, verify it, then make the next. Each change should be
reviewable and revertible on its own, and its effect measurable on its own. A
batch of fixes that improves the number tells you nothing about which ones
mattered, and a batch that breaks something is hard to bisect.

Traps: fixing the same problem twice through two mechanisms (a debounce plus a
cache plus a signature check), which hides which one worked and leaves dead
machinery behind.

### 19. Re-measure the same unit and keep only what moved the number

Run exactly the units from step 1, the same way as the baseline, several times,
and compare medians. Keep fixes that measurably improved the unit or removed the
repeat count you found. Revert fixes that didn't: they add complexity for
nothing. Re-check the counts from step 4 too, because a fix can move a cost
rather than remove it.

Traps: comparing against a baseline measured differently. Accepting a gain
smaller than the run-to-run noise. Forgetting the other units, where a fix can
make a different path slower.

### 20. Report each finding with numbers and remaining risk

For every finding, report:

- **Where:** file and function, and the unit of work it was seen in.
- **What repeated:** the operation, the count per unit, and whether inputs and
  outputs matched.
- **Evidence level:** *observed* (seen in these runs), *likely safe* (repeated
  with identical inputs and outputs, no effects observed, hidden inputs
  checked), or *proven* (the code path makes reuse correct regardless of
  workload).
- **Fix and result:** what changed, and the before/after numbers.
- **Remaining risk:** what wasn't checked, and what would make the fix wrong.

Also list the candidates you dropped and why, so the next review does not
rediscover them.
