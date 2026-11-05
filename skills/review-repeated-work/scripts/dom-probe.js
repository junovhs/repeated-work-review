// dom-probe.js — per-unit DOM waste counters for browser apps.
//
// Inject before the app runs (Playwright: context.addInitScript({ path })), or
// paste into the console for a quick look. It changes nothing the app does; it
// only watches and counts, per unit of work:
//
//   identicalRebuilds  elements attached that are byte-identical to elements
//                      removed earlier in the same unit (rebuilt, same result)
//   noopWrites         DOM writes that left the value as it was
//   forcedReflows      geometry/style reads made while layout was dirty
//
// Each counter keeps the top call sites (from a stack trace taken only when an
// event is counted), so findings point at code.
//
//   __domProbe.begin("check one box")   // start a unit
//   ... perform the action, wait until quiet ...
//   __domProbe.end()                    // -> report object
(() => {
  if (globalThis.__domProbe) return;

  let unit = null;
  let quiet = 0; // > 0 while the probe itself reads the DOM
  let layoutDirty = false;

  // A node's markup at the moment it was attached, so later post-processing
  // (a library rewriting text, an animation class) doesn't hide a rebuild.
  const attachedAs = new WeakMap();

  const hash = (s) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36) + ":" + s.length;
  };
  const peek = (fn) => { quiet++; try { return fn(); } finally { quiet--; } };
  const weight = (el) => 1 + el.getElementsByTagName("*").length;

  function site() {
    const lines = (new Error().stack || "").split("\n").slice(1);
    const frame = lines.find((l) => !l.includes("dom-probe")) || "";
    return frame.trim().replace(/^at /, "").replace(/\?[^:)]*/, "");
  }
  function bump(kind, n = 1) {
    if (!unit) return;
    unit[kind] += n;
    const s = site();
    const sites = unit.sites[kind];
    sites.set(s, (sites.get(s) || 0) + n);
  }

  // ---- writes ------------------------------------------------------------
  function wrote(noop) {
    if (quiet) return;
    layoutDirty = true;
    if (!unit) return;
    unit.writes++;
    if (noop) bump("noopWrites");
  }
  function removed(el) {
    if (quiet || !unit || !(el instanceof Element) || !el.isConnected) return;
    const h = attachedAs.get(el) || peek(() => hash(el.outerHTML));
    unit.removed.set(h, (unit.removed.get(h) || 0) + 1);
  }
  function removedChildren(parent) {
    if (parent && parent.children) for (const c of parent.children) removed(c);
  }
  function attached(node, parent) {
    // Assembling a detached subtree is construction; judge it once, when the
    // whole subtree joins the live document.
    if (quiet || !parent || !parent.isConnected) return;
    const els = node instanceof DocumentFragment ? [...node.children] : node instanceof Element ? [node] : [];
    for (const el of els) {
      if (el.isConnected) continue; // a move, not a build
      const h = peek(() => hash(el.outerHTML));
      attachedAs.set(el, h);
      if (!unit) continue;
      const w = peek(() => weight(el));
      unit.attached += w;
      const c = unit.removed.get(h) || 0;
      if (c > 0) { unit.removed.set(h, c - 1); bump("identicalRebuilds", w); }
    }
  }

  function hookSetter(proto, prop, { clearsChildren = false } = {}) {
    const d = Object.getOwnPropertyDescriptor(proto, prop);
    if (!d || !d.set || !d.get) return;
    Object.defineProperty(proto, prop, {
      ...d,
      set(v) {
        if (quiet) return d.set.call(this, v);
        const before = peek(() => d.get.call(this));
        if (clearsChildren) removedChildren(this);
        d.set.call(this, v);
        const after = peek(() => d.get.call(this));
        wrote(before === after);
        if (clearsChildren && this.isConnected && this.children) {
          for (const k of peek(() => [...this.children])) {
            const h = peek(() => hash(k.outerHTML));
            attachedAs.set(k, h);
            if (!unit) continue;
            const w = peek(() => weight(k));
            unit.attached += w;
            const c = unit.removed.get(h) || 0;
            if (c > 0) { unit.removed.set(h, c - 1); bump("identicalRebuilds", w); }
          }
        }
      },
    });
  }
  hookSetter(Element.prototype, "innerHTML", { clearsChildren: true });
  hookSetter(Node.prototype, "textContent", { clearsChildren: true });
  hookSetter(Element.prototype, "className");
  hookSetter(HTMLInputElement.prototype, "checked");
  hookSetter(HTMLInputElement.prototype, "value");
  for (const p of ["display", "height", "width", "transform", "opacity", "left", "top"]) {
    hookSetter(CSSStyleDeclaration.prototype, p);
  }

  const setAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name, value) {
    if (quiet) return setAttribute.call(this, name, value);
    const before = this.getAttribute(name);
    setAttribute.call(this, name, value);
    wrote(before === this.getAttribute(name));
  };
  for (const m of ["add", "remove", "toggle"]) {
    const orig = DOMTokenList.prototype[m];
    DOMTokenList.prototype[m] = function (...a) {
      if (quiet) return orig.apply(this, a);
      const before = this.value;
      const r = orig.apply(this, a);
      wrote(before === this.value);
      return r;
    };
  }

  function hookInsert(proto, name, nodesOf, onRemove) {
    const orig = proto[name];
    proto[name] = function (...a) {
      if (!quiet) {
        if (onRemove) onRemove(this, a);
        const parent = name === "replaceWith" ? this.parentNode : this;
        for (const n of nodesOf(a)) attached(n, parent);
        wrote(false);
      }
      return orig.apply(this, a);
    };
  }
  const nodes = (a) => a.filter((x) => x instanceof Node);
  hookInsert(Node.prototype, "appendChild", (a) => [a[0]]);
  hookInsert(Node.prototype, "insertBefore", (a) => [a[0]]);
  hookInsert(Node.prototype, "replaceChild", (a) => [a[0]], (_t, a) => removed(a[1]));
  hookInsert(Element.prototype, "append", nodes);
  hookInsert(Element.prototype, "prepend", nodes);
  hookInsert(Element.prototype, "replaceChildren", nodes, (t) => removedChildren(t));
  hookInsert(Element.prototype, "replaceWith", nodes, (t) => removed(t));
  const remove = Element.prototype.remove;
  Element.prototype.remove = function () {
    if (!quiet && this.isConnected) { removed(this); wrote(false); }
    return remove.call(this);
  };
  const removeChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function (c) {
    if (!quiet) { removed(c); wrote(false); }
    return removeChild.call(this, c);
  };

  // ---- forced reflows --------------------------------------------------------
  function read() {
    if (quiet || !layoutDirty) return;
    layoutDirty = false; // this read forced layout; clean until the next write
    bump("forcedReflows");
  }
  function hookGetter(proto, prop) {
    const d = Object.getOwnPropertyDescriptor(proto, prop);
    if (!d || !d.get) return;
    Object.defineProperty(proto, prop, { ...d, get() { read(); return d.get.call(this); } });
  }
  for (const p of ["offsetWidth", "offsetHeight", "offsetTop", "offsetLeft"]) hookGetter(HTMLElement.prototype, p);
  for (const p of ["clientWidth", "clientHeight", "scrollWidth", "scrollHeight", "scrollTop"]) hookGetter(Element.prototype, p);
  for (const m of ["getBoundingClientRect", "getClientRects"]) {
    const orig = Element.prototype[m];
    Element.prototype[m] = function (...a) { read(); return orig.apply(this, a); };
  }
  const getComputedStyle = window.getComputedStyle;
  window.getComputedStyle = function (...a) { read(); return getComputedStyle.apply(this, a); };
  // After a rendered frame, layout is clean again.
  const channel = new MessageChannel();
  channel.port1.onmessage = () => { layoutDirty = false; };
  (function frame() { requestAnimationFrame(() => { channel.port2.postMessage(0); frame(); }); })();

  // ---- units -----------------------------------------------------------------
  const top = (m, n = 5) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([s, c]) => ({ count: c, at: s }));

  globalThis.__domProbe = {
    begin(label = "unit") {
      unit = {
        label, t0: performance.now(), writes: 0, attached: 0,
        noopWrites: 0, identicalRebuilds: 0, forcedReflows: 0,
        removed: new Map(),
        sites: { noopWrites: new Map(), identicalRebuilds: new Map(), forcedReflows: new Map() },
      };
    },
    end() {
      if (!unit) return null;
      const u = unit;
      unit = null;
      return {
        label: u.label,
        ms: Math.round(performance.now() - u.t0),
        writes: u.writes,
        noopWrites: u.noopWrites,
        elementsAttached: u.attached,
        identicalRebuilds: u.identicalRebuilds,
        forcedReflows: u.forcedReflows,
        top: {
          noopWrites: top(u.sites.noopWrites),
          identicalRebuilds: top(u.sites.identicalRebuilds),
          forcedReflows: top(u.sites.forcedReflows),
        },
      };
    },
  };
})();
//# sourceURL=dom-probe.js
