# Browser apps

In a browser, much of the cost of repeated work is not JavaScript. It is the
style recalculation, layout and paint that JavaScript causes. A call that takes
0.02 ms can trigger 80 ms of layout, and a rebuild that produces identical DOM
still pays the browser to parse, style and lay it out again. So in browser apps,
judge cost by what the browser did during the unit, not only by script time.

## What to measure per unit

- **Browser time:** script, style recalculation, layout, paint. Record a
  performance trace around the unit (DevTools, or chrome-devtools-mcp from an
  agent) and read its insights; the forced-reflow insight names the code that
  read layout after a write. Without a trace, Chrome's counters via CDP give the
  totals:

  ```js
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  const metrics = async () => Object.fromEntries(
    (await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
  const a = await metrics();
  // ... perform the unit, wait until quiet ...
  const b = await metrics();
  for (const k of ["ScriptDuration", "RecalcStyleDuration", "LayoutDuration", "LayoutCount", "RecalcStyleCount"])
    console.log(k, b[k] - a[k]);
  ```

- **Waste counters:** `scripts/dom-probe.js` counts, per unit, rebuilds that
  produced byte-identical DOM, writes that changed nothing, and forced reflows,
  each with its top call sites.

  ```js
  await context.addInitScript({ path: "<skill>/scripts/dom-probe.js" });
  await page.goto(url);
  await page.evaluate(() => __domProbe.begin("check one box"));
  await page.click(".tree-row .selector");
  await page.waitForTimeout(800);
  console.log(await page.evaluate(() => __domProbe.end()));
  ```

  Run it against the dev server so call sites show source file names.

## The browser's usual repeated work

- **Identical rebuilds.** A container's `innerHTML` replaced, or its children
  torn down and rebuilt, on every change, when most of the result is the same
  as before. Fix with a keyed patch (update only changed rows) or a signature
  check (skip when the rendered markup is unchanged).
- **Rebuilding hidden things.** A render function that also redraws a closed
  panel, an inactive tab or an off-screen list. Render on open instead.
- **Writes that change nothing.** Setting `textContent`, a class or a style to
  the value it already has, often from a timer or a "sync everything" pass.
  Each write can invalidate style. Write only on change.
- **Forced reflows.** Reading geometry (`offsetWidth`, `getBoundingClientRect`,
  `getComputedStyle`) after a write in the same task forces layout immediately.
  In a loop over rows, that is one layout per row. Do all reads, then all
  writes.
- **Per-event work.** Pointer, scroll and resize handlers that do full work per
  event. Store the latest value and do the work once per animation frame, or
  once after the events settle.
- **Work while idle.** Timers, animation loops and infinite CSS animations
  that keep running when nothing changes, or after the element they served is
  gone. Measure an idle unit.
- **Text measurement libraries** that measure each element (canvas
  `measureText`, reading widths) on every render. Cheap once, expensive per row.

## Traps specific to browsers

- **Count only what joins the page.** Building a detached subtree is
  construction; the DOM it produces is judged once, when attached. Counting
  every `appendChild` into a detached node buries the one insertion that
  matters.
- **Compare a node as it was built,** not after a library or an animation
  rewrote it, or identical rebuilds look different.
- **Debounce hides double work.** A debounce in front of a function that is
  triggered twice per action makes the double call invisible. It does not
  remove the second trigger. Look for both.
- **Instrumentation changes what the JIT does.** Treat absolute timings from an
  instrumented run as rough; trust counts more than milliseconds, and take
  before/after timings from uninstrumented runs.
