# tiny-pipeline: answer key

A smoke case that runs in well under a second, for checking that the skill
produces a useful report quickly. Copy only `app/` to where the agent works;
never show it this file.

Unit of work: one run of `python pipeline.py` (3000 orders, 400 customers).

## Planted repeats (recall: score 1 each)

1. **Config read and parsed per order.** `enrich` calls `load_config()` (a file
   read plus a JSON parse) and rebuilds `set(cfg["blocked_skus"])` inside the
   loop: 3,000 times per run, expected once. Loop-invariant work.
2. **Customer found by linear scan per order.** `enrich` uses
   `next(c for c in customers if ...)`: a search inside a loop, O(orders x
   customers), about 600,000 comparisons per run. Fix: a dict by id, built once.
3. **Each line parsed three times.** `parse_order` runs in `validate`, `enrich`
   and `summarize` on the same lines: 9,000 calls per run, expected 3,000.
   `summarize` parses every line only to count them. Same derivation by several
   callers.
4. **Report written five times with identical content.** `main` calls
   `write_report` once, then again per region with the same arguments: 5 writes
   of the same bytes, expected 1. Writes that change nothing.

## Decoys (noise: a decoy reported as a finding counts against the run)

- `fmt_money`, called once per region: cheap and inherent.
- `make_data`: one-off setup, proportional by design.
- `fingerprint`: runs once.

## Scoring

Recall out of 4, noise as the count of reported findings that are decoys or not
real, and wall-clock time to the first report. A pass for the fast pass: 3 of 4
or better, no decoys, report in under 15 minutes.
