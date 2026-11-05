# repeated-work-review

A Claude Code skill that walks an agent through finding and removing repeated
work: the same job done more than once for one unit of work.

Asking an agent to "look for repeated work" usually means it reads code and
guesses. This skill turns that into a procedure: pick a unit of work, measure
where the time goes, count how often each expensive operation runs, check
whether repeats had the same inputs and outputs, fix one thing at a time, and
re-measure. Every finding comes back with a number and an evidence level.

## Install

```
/plugin install repeated-work-review --marketplace junovhs/repeated-work-review
```

Or copy `skills/review-repeated-work/` into `~/.claude/skills/`.

Then ask: *"Review this for repeated work."*

## What's inside

```
skills/review-repeated-work/
  SKILL.md                 the 20-step checklist: what to do at each step, why, and its traps
  references/snippets.md   the same move shown in Rust, Python, TypeScript and Go, by step
  references/browser.md    browser apps: style/layout cost, identical rebuilds, forced reflows
  scripts/dom-probe.js     drop-in page script that counts DOM waste per unit of work
evals/                     cases with a known answer, for testing changes to the skill
```

The checklist says what to do, not how. The snippets show each idea in several
languages so the pattern is clear, not so they get pasted.

## dom-probe.js

A standalone script for browser apps. Inject it before the app runs and it
counts, per unit of work, the DOM that was rebuilt byte-identical, the writes
that changed nothing, and the forced reflows, each with the call sites
responsible. It changes nothing the app does.

```js
await context.addInitScript({ path: "skills/review-repeated-work/scripts/dom-probe.js" });
await page.goto(url);
await page.evaluate(() => __domProbe.begin("check one box"));
await page.click(".row .checkbox");
await page.waitForTimeout(800);
console.log(await page.evaluate(() => __domProbe.end()));
```

## Contact

hello@strangesystems.dev

## License

MIT
