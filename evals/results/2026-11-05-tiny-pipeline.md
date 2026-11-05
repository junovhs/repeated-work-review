# tiny-pipeline, 2026-11-05 (FIX-01 skill)

One fresh general-purpose agent per arm, same prompt apart from the skill.

| | With skill (fast pass) | Without skill |
|---|---|---|
| Wall clock | 23 s (agent total 42 s) | 32 s (agent total 48 s) |
| Planted repeats found | 4 of 4 | 4 of 4 |
| Decoys reported | 0 (all three listed as dropped) | 0 |
| Numbers | per finding, with evidence levels | per finding; also built and timed a fixed copy (420 ms to 6 ms) |
| Errors | search count given as ~6,000 generator steps (real: ~600,000 comparisons) | none seen |

Verdict: the fast pass now returns a correct report in under a minute, so the
skill no longer costs hours. The case does not separate the arms: both found
everything. It is a speed and regression check, not evidence that the skill
beats asking without it. A case where the repeats only show up when measured is
needed for that.
