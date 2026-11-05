# Snippets, by step

Each step shows one move in several languages. The point is the idea, stated
on the **Idea** line; the languages are there so the idea is obvious, not so
the code is pasted. Write the version that fits the codebase in front of you.
Everything here is temporary instrumentation: add it on a scratch branch, take
it out before fixing.

## Step 1 — a repeatable unit of work

**Idea:** the unit starts at a trigger and ends when everything it caused has
finished, and it can be run again identically.

TypeScript (browser, Playwright):
```ts
await page.evaluate(() => performance.mark("unit:start"));
await page.click('[data-action="done"]');
await page.waitForTimeout(800); // debounced, async and worker work lands here
await page.evaluate(() => performance.mark("unit:end"));
```

Python (one request):
```python
def unit(client):
    t0 = time.perf_counter()
    r = client.post("/tasks/42/complete")
    r.raise_for_status()
    return time.perf_counter() - t0
```

Shell (one CLI run, repeated):
```bash
hyperfine --warmup 2 --runs 10 './target/release/tool generate ./fixture'
```

## Step 2 — measure first

**Idea:** use the stack's own profiler on the unit, several runs, and keep the
baseline numbers.

| Stack | Profile | Notes |
|---|---|---|
| Rust | `cargo flamegraph -- <args>` or `samply record <bin> <args>` | Build with `debug = true` in the release profile for symbols |
| Go | `go test -cpuprofile cpu.out -bench .` then `go tool pprof cpu.out` | `net/http/pprof` for running servers |
| Python | `py-spy record -o prof.svg -- python app.py` | `python -m cProfile -s cumtime` for call counts |
| Node | `node --cpu-prof app.js`, open the `.cpuprofile` in DevTools | |
| Browser | Performance trace (DevTools, or chrome-devtools-mcp) | Read style/layout time, not only script time; see browser.md |
| Java | `java -XX:+FlightRecorder`, or async-profiler | |
| C++ | `perf record -g` then `perf report` | |

## Step 4 — count per unit

**Idea:** a counter per operation, reset at the start of the unit, read at the
end.

Rust:
```rust
use std::sync::atomic::{AtomicUsize, Ordering::Relaxed};
static PARSES: AtomicUsize = AtomicUsize::new(0);

fn parse(src: &str) -> Ast {
    PARSES.fetch_add(1, Relaxed);
    // ...
}
// end of unit:
eprintln!("parse calls: {}", PARSES.swap(0, Relaxed));
```

Python:
```python
from collections import Counter
import functools

CALLS = Counter()

def counted(fn):
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        CALLS[fn.__qualname__] += 1
        return fn(*args, **kwargs)
    return wrapper

# @counted on the suspects; end of unit:
print(CALLS.most_common()); CALLS.clear()
```

TypeScript:
```ts
const calls = new Map<string, number>();
function counted<A extends unknown[], R>(name: string, fn: (...a: A) => R) {
  return function (this: unknown, ...a: A): R {
    calls.set(name, (calls.get(name) ?? 0) + 1);
    return fn.apply(this, a);
  };
}
// refreshAll = counted("refreshAll", refreshAll);
// end of unit:
console.table([...calls]); calls.clear();
```

Go:
```go
var parses atomic.Int64 // sync/atomic

func parse(src []byte) *Ast {
    parses.Add(1)
    // ...
}
// end of unit:
fmt.Fprintln(os.Stderr, "parse calls:", parses.Swap(0))
```

## Step 5 — same input?

**Idea:** key each call by a cheap fingerprint of everything it reads; a key
seen twice in one unit is a repeat.

Rust:
```rust
use std::collections::HashMap;
use std::hash::{DefaultHasher, Hash, Hasher};
use std::sync::Mutex;

static SEEN: Mutex<Option<HashMap<u64, u32>>> = Mutex::new(None);

fn note_input(key: impl Hash) {
    let mut h = DefaultHasher::new();
    key.hash(&mut h);
    *SEEN.lock().unwrap().get_or_insert_with(HashMap::new).entry(h.finish()).or_default() += 1;
}
// at the top of the suspect: note_input((path, content.as_str()));
// end of unit: print entries with a count above 1, then clear
```

Python:
```python
SEEN = Counter()

def fingerprint(value):
    if isinstance(value, (str, bytes)):
        return (len(value), hash(value))
    if isinstance(value, (int, float, bool, type(None))):
        return value
    return ("id", id(value))  # identity: cheap, but misses equal copies

def keyed(fn):
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        SEEN[(fn.__qualname__, tuple(map(fingerprint, args)))] += 1
        return fn(*args, **kwargs)
    return wrapper

# end of unit: [k for k, n in SEEN.items() if n > 1]
```

TypeScript:
```ts
const ids = new WeakMap<object, number>();
let nextId = 0;
const fp = (v: unknown): string =>
  typeof v === "string" ? `s${v.length}:${v.slice(0, 32)}`
  : v !== null && typeof v === "object"
    ? `#${ids.get(v) ?? (ids.set(v, ++nextId), nextId)}`
    : String(v);

const seen = new Map<string, number>();
function keyed<A extends unknown[], R>(name: string, fn: (...a: A) => R) {
  return function (this: unknown, ...a: A): R {
    const k = `${name}|${a.map(fp).join(",")}`;
    seen.set(k, (seen.get(k) ?? 0) + 1);
    return fn.apply(this, a);
  };
}
```

## Step 6 — same output?

**Idea:** store the output fingerprint under the input key; the same key with
the same output is a confirmed repeat, and the same key with a different output
means a hidden input.

Python:
```python
OUT = {}

def check_output(key, result):
    fp = fingerprint(result)
    if key in OUT and OUT[key] != fp:
        print("same input, different output (hidden input?):", key)
    OUT[key] = fp
```

TypeScript (DOM: did the rebuild produce what it replaced?):
```ts
const before = host.innerHTML;
renderList(host, data);
if (host.innerHTML === before) console.warn("renderList rebuilt identical DOM");
```

Rust (file written with the same bytes):
```rust
let new_bytes = render(&model);
if std::fs::read(&path).ok().as_deref() == Some(new_bytes.as_slice()) {
    eprintln!("rewrote {} with identical bytes", path.display());
}
std::fs::write(&path, new_bytes)?;
```

## Step 7 — every caller

**Idea:** list the call sites, then confirm with counts which of them fire in
this unit.

```bash
rg -n "extract_functions\(|Facts::extract\(" --type rust
rg -n "refreshAllUI\(|dispatchEvent\(new CustomEvent\(\"app:selection" src
```

Also use the language server's "find references" or "call hierarchy", and
search for event names, message types and channel names: callers reached
through events do not show up as direct calls.

To see which callers fire, record the caller with each count.

Python:
```python
import inspect
caller = inspect.stack()[1]
CALLS[(fn.__qualname__, caller.filename, caller.lineno)] += 1
```

TypeScript:
```ts
const site = new Error().stack?.split("\n")[2]?.trim() ?? "?";
calls.set(`${name} <- ${site}`, (calls.get(`${name} <- ${site}`) ?? 0) + 1);
```

## Step 8 — whole rebuild for a small change

**Idea:** compare how much changed with how much was redone, then skip or patch.

TypeScript (skip when the rendered signature is unchanged):
```ts
let lastSig = "";
function renderRows(host: HTMLElement, rows: Row[]) {
  const html = rows.map(rowHtml).join("");
  if (html === lastSig) return; // nothing changed: no rebuild, no measuring
  lastSig = html;
  host.innerHTML = html;
}
```

Rust (save only what changed):
```rust
for (id, record) in &store.records {
    if store.dirty.contains(id) {
        write_record(dir, id, record)?;
    }
}
store.dirty.clear(); // instead of rewriting every record on each edit
```

Python (recount from an index instead of re-filtering everything):
```python
# before: total = sum(f.size for f in all_files if f.path in selected)
total = sum(index[path].size for path in selected)  # cost tracks the selection
```

## Step 9 — loop-invariant work

**Idea:** anything whose inputs don't change across iterations moves out of
the loop; a search inside a loop becomes a lookup.

Python:
```python
# before
for item in items:
    pattern = re.compile(config["pattern"])
    if any(o.id == item.owner for o in owners): ...
# after
pattern = re.compile(config["pattern"])
owner_ids = {o.id for o in owners}
for item in items:
    if item.owner in owner_ids: ...
```

Rust:
```rust
// before: let root = repo_root()?; inside the loop
let root = repo_root()?;
for job in &jobs {
    run(&root, job)?;
}
```

TypeScript:
```ts
// before: rows.forEach(r => r.owner = users.find(u => u.id === r.ownerId))
const byId = new Map(users.map(u => [u.id, u]));
rows.forEach(r => (r.owner = byId.get(r.ownerId)));
```

## Step 10 — coalesce per-event work

**Idea:** many events, one piece of work: once per frame, once after things
settle, or once per batch.

TypeScript (once per frame):
```ts
let queued = false;
container.addEventListener("scroll", () => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; renderVisibleWindow(); });
}, { passive: true });
```

Python (once after events settle):
```python
import threading

class Debounce:
    def __init__(self, delay, fn):
        self.delay, self.fn, self.timer = delay, fn, None
    def __call__(self, *args):
        if self.timer: self.timer.cancel()
        self.timer = threading.Timer(self.delay, self.fn, args)
        self.timer.start()
```

Go (per batch):
```go
for {
    batch := []Event{<-events}
    for len(batch) < 100 {
        select {
        case e := <-events:
            batch = append(batch, e)
            continue
        default:
        }
        break
    }
    handle(batch)
}
```

## Step 11 — work nobody sees

**Idea:** count work during an idle unit, and count writes that left the value
unchanged.

TypeScript (writes that change nothing):
```ts
let noop = 0, total = 0;
const d = Object.getOwnPropertyDescriptor(Node.prototype, "textContent")!;
Object.defineProperty(Node.prototype, "textContent", {
  ...d,
  set(v) { total++; if (d.get!.call(this) === String(v)) noop++; d.set!.call(this, v); },
});
// after an idle unit: console.log({ noop, total })
```

Rust (a periodic task that does nothing useful):
```rust
let mut changed = 0u32;
let mut ticks = 0u32;
// inside the tick: ticks += 1; if new_state != old_state { changed += 1; }
// after a quiet minute: ticks far above changed means poll less, or watch instead
```

For browser apps, `scripts/dom-probe.js` does both of these and more per unit;
see browser.md.

## Step 12 — cost against data size

**Idea:** same unit, two sizes; per-action cost should not grow with the data
when the action changes the same amount.

```bash
for n in 1000 4000; do
  ./gen-fixture --files "$n" > "fx-$n"
  hyperfine --runs 5 --export-json "t-$n.json" "./tool select-one fx-$n"
done
```

A function whose time grows close to 4x between the two runs, on an action that
touches one item, is redoing work across the whole dataset.

## Step 13 — history

**Idea:** earlier fixes show this codebase's habits, and sometimes a regression.

```bash
git log --oneline -i -E --grep 'perf|cache|memo|debounce|once|redundant|duplicate|re-?render|re-?parse|incremental'
git log -S 'filterScanData(' --oneline -- src   # when did a call appear or disappear?
```

## Step 19 — re-measure

**Idea:** the same unit, the same way, several runs, compare medians; keep only
what moved.

```bash
git stash && hyperfine --runs 10 --export-json before.json './tool run ./fixture'
git stash pop && hyperfine --runs 10 --export-json after.json './tool run ./fixture'
```

Python:
```python
import statistics, timeit
before = statistics.median(timeit.repeat(unit_before, number=1, repeat=10))
after = statistics.median(timeit.repeat(unit_after, number=1, repeat=10))
print(f"{before*1e3:.1f} ms -> {after*1e3:.1f} ms")
```
