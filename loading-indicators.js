// loading-indicators.js (with detailed logs)
(function () {
  "use strict";

  // -- Logging helpers --------------------------------------------------------
  const LOG_NS = "[SelectLoading]";
  const LOG_STYLE = "color:#0f62fe;font-weight:600";
  const DBG = {
    log: (...a) => console.log(`%c${LOG_NS}`, LOG_STYLE, ...a),
    info: (...a) => console.info(`%c${LOG_NS}`, LOG_STYLE, ...a),
    warn: (...a) => console.warn(`%c${LOG_NS}`, LOG_STYLE, ...a),
    error: (...a) => console.error(`%c${LOG_NS}`, LOG_STYLE, ...a),
    time: (label) => console.time(`${LOG_NS} ${label}`),
    timeEnd: (label) => console.timeEnd(`${LOG_NS} ${label}`),
  };

  // -- Small CSS helper (JS-injected) ----------------------------------------
  const STYLE_ID = "inline-select-loading-styles";
  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) {
      DBG.log("Styles already present:", STYLE_ID);
      return;
    }
    DBG.time("inject styles");
    const css = `
    .sel-wrap { position: relative; display: grid; gap: 4px; }
    .sel-wrap .sel-row { display:flex; align-items:center; gap:8px; }
    .sel-wrap .sel-status { font-size:.85rem; color: var(--muted, #6b7280); }
    .sel-wrap .sel-spinner {
      width: 16px; height:16px; border:2px solid #ddd; border-top-color: var(--brand, #0f62fe);
      border-radius:50%; animation: selspin 0.8s linear infinite; display:none;
    }
    .sel-wrap[data-state="loading"] .sel-spinner { display:inline-block; }
    .sel-wrap[data-state="done"]    .sel-status::before { content:"✓ "; color:#15803d; }
    .sel-wrap[data-state="error"]   .sel-status::before { content:"⚠ "; color:#b91c1c; }
    @keyframes selspin { to { transform: rotate(360deg); } }

    /* Cart sync pill */
    #cartSyncStatus {
      display:inline-flex; align-items:center; gap:6px;
      border:1px solid var(--border, #e5e7eb);
      background:#fff; border-radius:999px; padding:4px 8px;
      font-size:.85rem; color:#111827;
    }
    #cartSyncDot {
      width:8px; height:8px; border-radius:50%; background:#9ca3af;
      box-shadow: 0 0 0 rgba(15,98,254,0.0);
      transition: background .2s ease;
    }
    .pulse {
      animation: cartpulse 900ms ease-out 1;
    }
    @keyframes cartpulse {
      0%   { box-shadow: 0 0 0 0 rgba(15,98,254, 0.45); }
      100% { box-shadow: 0 0 0 16px rgba(15,98,254, 0.0); }
    }`;
    const el = document.createElement("style");
    el.id = STYLE_ID; el.textContent = css;
    document.head.appendChild(el);
    DBG.timeEnd("inject styles");
  }

  // -- DOM helpers ------------------------------------------------------------
  function $(id) { return document.getElementById(id); }

  // Wrap a <select> (or any element) with a spinner + status line.
  function wrapSelectWithLoading(selectEl, labelText) {
    try {
      if (!selectEl) {
        DBG.warn("wrapSelectWithLoading called with null element");
        return;
      }
      if (selectEl.closest(".sel-wrap")) {
        DBG.log("Already wrapped, skip:", selectEl.id || selectEl.name || selectEl.tagName);
        return selectEl.closest(".sel-wrap");
      }

      const idLog = selectEl.id || selectEl.name || selectEl.tagName;
      DBG.time(`wrap ${idLog}`);

      // Find the field container (label+select) or create one
      const field = selectEl.closest(".field") || selectEl.parentElement;
      if (!field) {
        DBG.warn("Could not find field container for:", idLog);
        DBG.timeEnd(`wrap ${idLog}`);
        return;
      }

      // Make a wrapper and move the label+select into it
      const wrap = document.createElement("div");
      wrap.className = "sel-wrap";
      wrap.setAttribute("data-state", "idle");

      // Row = label + (spinner)
      const row = document.createElement("div");
      row.className = "sel-row";

      // Try to find existing label
      let label =
        field.querySelector("label[for='" + selectEl.id + "']") ||
        field.querySelector(".field-label");

      if (!label) {
        label = document.createElement("label");
        label.className = "field-label";
        label.textContent = labelText || (selectEl.id || "Select");
        if (selectEl.id) label.setAttribute("for", selectEl.id);
        field.prepend(label);
        DBG.log("Created missing label for:", idLog);
      }
      const spin = document.createElement("div");
      spin.className = "sel-spinner";
      spin.setAttribute("aria-hidden", "true");

      row.appendChild(label.cloneNode(true));
      row.appendChild(spin);

      // Status line under the select
      const status = document.createElement("div");
      status.className = "sel-status";
      status.textContent = "Idle";

      // Clear field & rebuild layout: row, select, status
      const next = document.createDocumentFragment();
      next.appendChild(row);
      next.appendChild(selectEl);
      next.appendChild(status);
      wrap.appendChild(next);

      // Replace previous field content with wrapper
      field.innerHTML = "";
      field.appendChild(wrap);

      // Store refs for quick updates
      wrap.__statusEl = status;
      wrap.__spinEl = spin;

      DBG.log("Wrapped select:", { id: idLog, state: "idle" });
      DBG.timeEnd(`wrap ${idLog}`);
      return wrap;
    } catch (err) {
      DBG.error("wrapSelectWithLoading error:", err);
    }
  }

  function setSelectState(selectId, state, msg) {
    try {
      const sel = $(selectId);
      if (!sel) {
        DBG.warn("setSelectState: element not found:", selectId, "->", state, msg);
        return;
      }
      const wrap = sel.closest(".sel-wrap") || wrapSelectWithLoading(sel);
      if (!wrap) {
        DBG.warn("setSelectState: wrapper not found for:", selectId);
        return;
      }
      const prev = wrap.getAttribute("data-state") || "idle";
      wrap.setAttribute("data-state", state || "idle");
      if (wrap.__statusEl) {
        wrap.__statusEl.textContent =
          state === "loading" ? (msg || "Loading…") :
          state === "done"    ? (msg || "Ready")   :
          state === "error"   ? (msg || "Load failed") :
                                (msg || "Idle");
      }
      DBG.info("State change:", { id: selectId, from: prev, to: state || "idle", msg: msg || "" });
    } catch (err) {
      DBG.error("setSelectState error:", err);
    }
  }

  // Public API
  window.SelectLoading = {
    show(id, msg){ DBG.log("show/loading:", id, msg || ""); setSelectState(id, "loading", msg); },
    done(id, msg){ DBG.log("done:", id, msg || ""); setSelectState(id, "done",    msg); },
    fail(id, msg){ DBG.log("fail:", id, msg || ""); setSelectState(id, "error",   msg); },
    idle(id, msg){ DBG.log("idle:", id, msg || ""); setSelectState(id, "idle",    msg); }
  };

  // Bootstrap on DOMContentLoaded
  document.addEventListener("DOMContentLoaded", () => {
    DBG.log("DOMContentLoaded – bootstrap start");
    ensureStyles();

    // Known selects in your pages:
    const knownIds = [
      "branchSelect",            // index.html / cart.html
      "customerSelect",          // index.html / cart.html
      "fieldManagerSelect",      // index.html / cart.html
      "subcontractorCompanySelect", // VPO only
      "neededBySelect",          // Fill-In only
      "reasonSelect"             // Fill-In only
    ];

    const wrapped = [];
    knownIds.forEach(id => {
      const el = $(id);
      if (el) {
        wrapSelectWithLoading(el);
        wrapped.push(id);
      }
    });
    DBG.log("Initial wrapped selects:", wrapped);

    // ——— Monkey-patch initDropdowns to show progress automatically ———
    const orig = window.initDropdowns;
    if (typeof orig === "function") {
      DBG.log("Patching initDropdowns() to auto-show select loading states");
window.initDropdowns = async function(...args){
   try {
   window.LoadingBar?.show("Loading dropdowns…");
  } catch {}        DBG.time("initDropdowns (patched)");
        try {
          DBG.log("initDropdowns: show loading states");
          SelectLoading.show("branchSelect", "Loading branches…");
          SelectLoading.show("fieldManagerSelect", "Loading managers…");
          SelectLoading.show("customerSelect", "Loading customers…");
          if (document.getElementById("subcontractorCompanySelect")) {
            SelectLoading.show("subcontractorCompanySelect", "Waiting for branch…");
          }

          const result = await orig.apply(this, args);

          DBG.log("initDropdowns: data loaded, marking done");
          SelectLoading.done("branchSelect", "Branches ready");
          SelectLoading.done("fieldManagerSelect", "Managers ready");
          SelectLoading.done("customerSelect", "Customers ready");
          if (document.getElementById("subcontractorCompanySelect")) {
            SelectLoading.idle("subcontractorCompanySelect", "Select a branch to load subs");
          }
 window.LoadingBar?.progress(90, "Finishing…");
          DBG.timeEnd("initDropdowns (patched)");
          return result;
        } catch (e) {
          DBG.error("[initDropdowns wrapper] failed:", e);
          SelectLoading.fail("branchSelect");
          SelectLoading.fail("fieldManagerSelect");
          SelectLoading.fail("customerSelect");
          SelectLoading.fail("subcontractorCompanySelect");
          DBG.timeEnd("initDropdowns (patched)");
          throw e;
          } finally {
     window.LoadingBar?.hide();
    }
     
      };
    } else {
      DBG.warn("initDropdowns not found – skip patch");
    }

    // ——— Cart sync status (piggybacks on your BroadcastChannel broadcast) ———
    const origBroadcast = window.broadcastCart;
    if (typeof origBroadcast === "function") {
      DBG.log("Patching broadcastCart() to show cart sync pill");

      // Ensure a spot for the pill near controls or header
      function ensureCartPill() {
        let pill = document.getElementById("cartSyncStatus");
        if (pill) {
          return pill;
        }
        DBG.log("Creating cart sync pill");
        pill = document.createElement("span");
        pill.id = "cartSyncStatus";
        pill.innerHTML = `<span id="cartSyncDot"></span><span>Cart Sync</span>`;
        // Try to append beside existing controls/status rows
        const host =
          document.querySelector(".cart-actions") || // cart.html header
          document.getElementById("dataStatusRow") || // index.html status row
          document.querySelector("header") ||
          document.body;
        host.appendChild(pill);
        return pill;
      }

      window.broadcastCart = function(state){
        try {
          const pill = ensureCartPill();
          const dot  = document.getElementById("cartSyncDot");
          if (dot) {
            dot.classList.remove("pulse");
            // brief color flash
            dot.style.background = "#0f62fe";
            void dot.offsetWidth; // reflow to restart animation
            dot.classList.add("pulse");
            // revert after a beat
            setTimeout(() => { dot.style.background = "#9ca3af"; }, 900);
          }
          // Log a compact snapshot of state (avoid huge objects)
          let summary = state;
          try {
            if (state && typeof state === "object") {
              const keys = Object.keys(state);
              summary = `{${keys.slice(0, 6).join(",")}${keys.length > 6 ? ",…": ""}}`;
            }
          } catch {}
          DBG.info("broadcastCart called with state:", summary);
        } catch (err) {
          DBG.error("broadcastCart wrapper error:", err);
        }
        return origBroadcast.apply(this, arguments);
      };
    } else {
      DBG.warn("broadcastCart not found – skip patch");
    }

    DBG.log("Bootstrap complete");
  });
})();
// === deferred-patches.js (append to loading-indicators.js) ===================
(function () {
  "use strict";

const LOG = (...a) => console.log("%c[SelectLoading]", "color:#0f62fe;font-weight:600", ...a);
  // --- 0) Tiny loading BAR controller (uses elements already in index.html) ---
  // Exposes window.LoadingBar.show/progress/hide
  (function installLoadingBar(){
    function qs(id){ return document.getElementById(id); }
    const overlay = () => qs("loadingBarOverlay");
    const fill    = () => qs("loadingBar");
    const label   = () => qs("loadingBarLabel");
    const meta    = () => qs("loadingBarMeta");

    function clamp(n){ n = Number(n||0); return Math.max(0, Math.min(100, n)); }
    function show(msg){
      const o = overlay(); if (!o) return;
      o.style.display = "block";
      progress(5, msg || "Starting…");
    }
    function progress(pct, msg){
      const f = fill(); const l = label(); const m = meta();
      if (f) f.style.width = clamp(pct) + "%";
      if (l && msg) l.textContent = String(msg);
      if (m) m.textContent = (new Date()).toLocaleTimeString();
    }
    function hide(){
      const o = overlay(); if (!o) return;
      progress(100, "Done");
      setTimeout(()=>{ o.style.display = "none"; }, 250);
    }
    window.LoadingBar = { show, progress, hide };
  })();

  // --- 1) Helper: patch when a function finally appears on window -------------
  function patchWhenAvailable(name, patchFn, {timeout=15000, interval=150} = {}){
    if (typeof window[name] === "function") {
      try { patchFn(window[name]); LOG("Patched", name, "(immediate)"); } catch(e){ console.warn(e); }
      return;
    }
    const t0 = Date.now();
    const h = setInterval(() => {
      if (typeof window[name] === "function") {
        clearInterval(h);
        try { patchFn(window[name]); LOG("Patched", name, "(deferred)"); } catch(e){ console.warn(e); }
      } else if (Date.now() - t0 > timeout) {
        clearInterval(h);
        LOG("Gave up waiting for", name);
      }
    }, interval);
  }

  // --- 2) Patch initDropdowns AFTER it exists so select spinners actually show
  patchWhenAvailable("initDropdowns", (orig) => {
    window.initDropdowns = async function(...args){
      try {
        SelectLoading.show("branchSelect", "Loading branches…");
        SelectLoading.show("fieldManagerSelect", "Loading managers…");
        SelectLoading.show("customerSelect", "Loading customers…");
        if (document.getElementById("subcontractorCompanySelect")) {
          SelectLoading.show("subcontractorCompanySelect", "Waiting for branch…");
        }
      } catch {}

      const res = await orig.apply(this, args);

      try {
        SelectLoading.done("branchSelect", "Branches ready");
        SelectLoading.done("fieldManagerSelect", "Managers ready");
        SelectLoading.done("customerSelect", "Customers ready");
        if (document.getElementById("subcontractorCompanySelect")) {
          SelectLoading.idle("subcontractorCompanySelect", "Select a branch to load subs");
        }
      } catch {}

      return res;
    };
  });

  // --- 3) Patch broadcastCart so the “Cart Sync” pill animates when available --
  patchWhenAvailable("broadcastCart", (orig) => {
    window.broadcastCart = function(state){
      // poke the pill (the rest of the behavior comes from your earlier code)
      try {
        const dot = document.getElementById("cartSyncDot");
        if (dot) {
          dot.classList.remove("pulse");
          dot.style.background = "#0f62fe";
          void dot.offsetWidth;
          dot.classList.add("pulse");
          setTimeout(() => { dot.style.background = "#9ca3af"; }, 900);
        }
      } catch {}
      return orig.apply(this, arguments);
    };
  });

  // --- 4) Instrument AirtableService fetches -> show a REAL loading BAR -------
  // This drives the overlay bar during network work (index.html already has it).
  // It also toggles select spinners if we can infer what is being fetched.
  patchWhenAvailable("AirtableService", (Ctor) => {
    // Active request counter (show overlay while > 0)
    let inFlight = 0;

    function begin(task, hint){
      inFlight++;
      if (inFlight === 1) window.LoadingBar?.show(task || "Loading…");
      const pct = Math.min(90, 10 + inFlight * 10);
      window.LoadingBar?.progress(pct, task || "Loading…");
      // Optional: hint which select to show as loading
      if (hint === "branches") SelectLoading.show("branchSelect", "Loading branches…");
      if (hint === "customers") SelectLoading.show("customerSelect", "Loading customers…");
      if (hint === "managers") SelectLoading.show("fieldManagerSelect", "Loading managers…");
    }

    function end(hint){
      inFlight = Math.max(0, inFlight - 1);
      if (inFlight === 0) window.LoadingBar?.hide();
      if (hint === "branches") SelectLoading.done("branchSelect", "Branches ready");
      if (hint === "customers") SelectLoading.done("customerSelect", "Customers ready");
      if (hint === "managers") SelectLoading.done("fieldManagerSelect", "Managers ready");
    }

    const proto = Ctor.prototype;
    const _fetchAllFromSource = proto.fetchAllFromSource;
    const _fetchOptionsFromSource = proto.fetchOptionsFromSource;

    if (typeof _fetchAllFromSource === "function") {
      proto.fetchAllFromSource = async function(tableId, viewId){
        const hint =
          /branch/i.test(String(tableId))   ? "branches"  :
          /customer|builder/i.test(String(tableId)) ? "customers" :
          /manager|field\s*manager/i.test(String(tableId)) ? "managers" : null;

        begin("Fetching data…", hint);
        try {
          const res = await _fetchAllFromSource.apply(this, arguments);
          return res;
        } finally {
          end(hint);
        }
      };
    }

    if (typeof _fetchOptionsFromSource === "function") {
      proto.fetchOptionsFromSource = async function(tableId, viewId){
        const hint =
          /branch/i.test(String(tableId))   ? "branches"  :
          /customer|builder/i.test(String(tableId)) ? "customers" :
          /manager|field\s*manager/i.test(String(tableId)) ? "managers" : null;

        begin("Loading options…", hint);
        try {
          const res = await _fetchOptionsFromSource.apply(this, arguments);
          return res;
        } finally {
          end(hint);
        }
      };
    }

    LOG("AirtableService instrumented for loading bar & select spinners");
  });

})();
// === force-loadingbar-and-initDropdowns.js (append to loading-indicators.js) ==
(function () {
  "use strict";

  // 0) Ensure we can log consistently
  const LOG = (...a) => console.log("%c[SelectLoading]", "color:#0f62fe;font-weight:600", ...a);

  // 1) Ensure/Inject a loading bar overlay on any page (index.html & cart.html)
  function ensureOverlay() {
    if (document.getElementById("loadingBarOverlay")) return;

    // Minimal inline styles in case loading.css isn't present
    const style = document.createElement("style");
    style.textContent = `
      #loadingBarOverlay{position:fixed;inset:0;display:none;z-index:2147483000;
        background:rgba(255,255,255,.7);backdrop-filter:saturate(1.2) blur(2px)}
      #loadingBarOverlay .loading-panel{position:absolute;left:50%;top:14%;
        transform:translateX(-50%);min-width:280px;max-width:80vw;background:#fff;
        border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.08);
        padding:12px}
      .loading-label{font-weight:600;margin-bottom:6px}
      .loading-track{height:8px;background:#f3f4f6;border-radius:999px;overflow:hidden}
      .loading-fill{height:100%;width:5%;background:#0f62fe;border-radius:999px;transition:width .25s ease}
      .loading-meta{margin-top:6px;font-size:.85rem;color:#6b7280}
    `;
    document.head.appendChild(style);

    const overlay = document.createElement("div");
    overlay.id = "loadingBarOverlay";
    overlay.setAttribute("role", "status");
    overlay.setAttribute("aria-live", "polite");
    overlay.innerHTML = `
      <div class="loading-panel" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
        <div id="loadingBarLabel" class="loading-label">Starting…</div>
        <div class="loading-track"><div id="loadingBar" class="loading-fill" style="width:5%"></div></div>
        <div id="loadingBarMeta" class="loading-meta"></div>
      </div>`;
    document.body.appendChild(overlay);
    LOG("Injected loadingBarOverlay into page");
  }

  // 2) A simple controller that always exists
  (function installLoadingBar(){
    ensureOverlay();
    function qs(id){ return document.getElementById(id); }
    const overlay = () => qs("loadingBarOverlay");
    const fill    = () => qs("loadingBar");
    const label   = () => qs("loadingBarLabel");
    const meta    = () => qs("loadingBarMeta");
    const clamp   = (n) => Math.max(0, Math.min(100, Number(n||0)));

    function show(msg){
      const o = overlay(); if (!o) return;
      o.style.display = "block";
      progress(10, msg || "Loading…");
    }
    function progress(pct, msg){
      const f = fill(); const l = label(); const m = meta();
      if (f) f.style.width = clamp(pct) + "%";
      if (l && msg) l.textContent = String(msg);
      if (m) m.textContent = new Date().toLocaleTimeString();
    }
    function hide(){
      const o = overlay(); if (!o) return;
      progress(100, "Done");
      setTimeout(() => { o.style.display = "none"; }, 250);
    }
    window.LoadingBar = { show, progress, hide };
  })();

  // 3) Patch when a function finally exists
  function patchWhenAvailable(name, patchFn, {timeout=15000, interval=120} = {}){
    if (typeof window[name] === "function") return void patchFn(window[name]);
    const t0 = Date.now();
    const h = setInterval(() => {
      if (typeof window[name] === "function") {
        clearInterval(h); try { patchFn(window[name]); LOG("Patched", name); } catch (e) { console.warn(e); }
      } else if (Date.now() - t0 > timeout) {
        clearInterval(h); LOG("Gave up waiting for", name);
      }
    }, interval);
  }

  // 4) Always show a bar around initDropdowns (cache OR network)
  //    (Your AirtableService instrumentation will still drive "real" progress.)
  patchWhenAvailable("initDropdowns", (orig) => {
    window.initDropdowns = async function(...args){
      try {
        window.LoadingBar?.show("Loading dropdowns…");
        // quick staged progress while cache/requests resolve
        window.LoadingBar?.progress(25, "Branches…");
        SelectLoading?.show?.("branchSelect", "Loading branches…");
        window.LoadingBar?.progress(50, "Managers & Customers…");
        SelectLoading?.show?.("fieldManagerSelect", "Loading managers…");
        SelectLoading?.show?.("customerSelect", "Loading customers…");
        if (document.getElementById("subcontractorCompanySelect")) {
          SelectLoading?.show?.("subcontractorCompanySelect", "Waiting for branch…");
        }

        const res = await orig.apply(this, args);

        SelectLoading?.done?.("branchSelect", "Branches ready");
        SelectLoading?.done?.("fieldManagerSelect", "Managers ready");
        SelectLoading?.done?.("customerSelect", "Customers ready");
        if (document.getElementById("subcontractorCompanySelect")) {
          SelectLoading?.idle?.("subcontractorCompanySelect", "Select a branch to load subs");
        }
        window.LoadingBar?.progress(90, "Finishing…");
        return res;
      } finally {
        window.LoadingBar?.hide();
      }
    };
  });

  // 5) If AirtableService is present, keep using it to reflect real network work
  patchWhenAvailable("AirtableService", (Ctor) => {
    let inFlight = 0;
    const proto = Ctor.prototype;
    function begin(msg){ if (++inFlight === 1) window.LoadingBar?.show(msg || "Fetching…"); }
    function end(){ if (inFlight > 0 && --inFlight === 0) window.LoadingBar?.hide(); }

    // Wrap the internal list fetchers so the bar moves on real network requests
    ["fetchAllFromSource", "fetchOptionsFromSource"].forEach((fn) => {
      if (typeof proto[fn] !== "function") return;
      const orig = proto[fn];
      proto[fn] = async function(){
        begin("Fetching Airtable…");
        try { return await orig.apply(this, arguments); }
        finally { end(); }
      };
    });
  });

})();
// --- make sure the overlay actually looks like an overlay, even without loading.css
(function ensureOverlayStylesAlways(){
  try {
    const HEAD_ID = "loadingbar-inline-styles";
    if (document.getElementById(HEAD_ID)) return;
    // If overlay exists but has no fixed positioning, inject minimal styles.
    const ov = document.getElementById("loadingBarOverlay");
    const need = !ov || getComputedStyle(ov).position === "static";

    if (need) {
      const css = `
        #loadingBarOverlay{position:fixed;inset:0;display:none;z-index:2147483000;
          background:rgba(255,255,255,.7);backdrop-filter:saturate(1.2) blur(2px)}
        #loadingBarOverlay .loading-panel{position:absolute;left:50%;top:14%;
          transform:translateX(-50%);min-width:280px;max-width:80vw;background:#fff;
          border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.08);
          padding:12px}
        .loading-label{font-weight:600;margin-bottom:6px}
        .loading-track{height:8px;background:#f3f4f6;border-radius:999px;overflow:hidden}
        .loading-fill{height:100%;width:5%;background:#0f62fe;border-radius:999px;transition:width .25s ease}
        .loading-meta{margin-top:6px;font-size:.85rem;color:#6b7280}
      `;
      const el = document.createElement("style");
      el.id = HEAD_ID; el.textContent = css;
      document.head.appendChild(el);
      console.log("[SelectLoading] injected fallback CSS for loadingBarOverlay");
    }
  } catch(e) { console.warn("[SelectLoading] fallback CSS failed", e); }
})();
