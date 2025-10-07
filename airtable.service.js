(function (global) {
  "use strict";

  // === RUNTIME CONFIG HOOK (from app-config.js) ==============================
  const RUNTIME = (global.APP && global.APP.airtable) ? global.APP.airtable : null;
const _startedTimers = new Set();

  // === LIVE CONFIG OBJECT (mutable via setAirtableRuntimeConfig) =============
  let AIRTABLE_CONFIG = RUNTIME || {
    // NOTE: Do NOT commit a real PAT in source. Prefer localStorage or env-injection.
    API_KEY: "patTGK9HVgF4n1zqK.cbc0a103ecf709818f4cd9a37e18ff5f68c7c17f893085497663b12f2c600054",
    BASE_ID: "appQDdkj6ydqUaUkE",
    TABLE_ID: "tblO72Aw6qplOEAhR",
    VIEW_ID: "viwf55KoUHJZfdEY6",
    // If you don’t have correct Fill-In SOURCES yet, leave them empty here;
    // your app-config.js should provide the right ones per mode.
   SOURCES: {
      FIELD_MANAGER: { TABLE_ID: "tblj6Fp0rvN7QyjRv", VIEW_ID: "viwgHExXtj0VSlmbU",
        LABEL_CANDIDATES: ["Full Name","Name","Field Manager","Field Manager Name","Title"] },
      BRANCH: { TABLE_ID: "tblD2gLfkTtJYIhmK", VIEW_ID: "viw8tjumtr3Er8SuR",
        LABEL_CANDIDATES: ["Vanir Office","Branch","Name","Division","Office"] },
      CUSTOMER: { TABLE_ID: "tblQ7yvLoLKZlZ9yU", VIEW_ID: "Grid view",
        LABEL_CANDIDATES: ["Client Name","Client","Name"] },
      SUBCONTRACTOR: { TABLE_ID: "tblgsUP8po27WX7Hb", VIEW_ID: "Grid view",
        LABEL_CANDIDATES: ["Subcontractor Company Name","Company","Company Name","Name","Vendor","Vendor Name"] },
    }
  };

  // Setter to update config LIVE when the user toggles modes
  global.setAirtableRuntimeConfig = function(next){
    if (!next || typeof next !== "object") return;
    AIRTABLE_CONFIG = {
      API_KEY: String(next.API_KEY || AIRTABLE_CONFIG.API_KEY || ""),
      BASE_ID: String(next.BASE_ID || AIRTABLE_CONFIG.BASE_ID || ""),
      TABLE_ID: String(next.TABLE_ID || AIRTABLE_CONFIG.TABLE_ID || ""),
      VIEW_ID: String(next.VIEW_ID || AIRTABLE_CONFIG.VIEW_ID || ""),
      SOURCES: { ...(AIRTABLE_CONFIG.SOURCES || {}), ...(next.SOURCES || {}) }
    };
    global.AIRTABLE_CONFIG = AIRTABLE_CONFIG; // expose so others see the update
    try { console.debug("[AT] config updated:", { base: AIRTABLE_CONFIG.BASE_ID, table: AIRTABLE_CONFIG.TABLE_ID }); } catch {}
  };

  // ---------- Small shared formatter (MUST be top-level) ---------------------
  function _fmtSrc(where, baseId, tableId, viewId){
    return `[${where}] base=${baseId} table=${tableId} view=${viewId}`;
  }

  // ---------- Logging Utility ------------------------------------------------
  const AIRTABLE_LOGGER = (() => {
    const LEVELS = { silent: 0, error: 1, warn: 2, info: 3, debug: 4, trace: 5 };

    const QS = new URLSearchParams((typeof location !== "undefined" && location.search) || "");
    const qsLevel = (QS.get("atlog") || "").toLowerCase();
    const stored = (typeof localStorage !== "undefined" && localStorage.getItem("AIRTABLE_LOG_LEVEL")) || "";
    let _level = (qsLevel in LEVELS) ? qsLevel : (stored in LEVELS) ? stored : "info";

    function setLevel(lvl) {
      if (lvl in LEVELS) {
        _level = lvl;
        try { localStorage.setItem("AIRTABLE_LOG_LEVEL", _level); } catch {}
      }
    }
    function getLevel() { return _level; }
    function _enabled(min) { return LEVELS[_level] >= LEVELS[min]; }
    function _ts() {
      try {
        const d = new Date();
        return d.toTimeString().split(" ")[0] + "." + String(d.getMilliseconds()).padStart(3,"0");
      } catch { return ""; }
    }

    const baseStyle = "padding:2px 6px;border-radius:6px;font-weight:600;";
    const tagStyle  = "background:#111;color:#fff;";
    const dbgStyle  = "background:#6b7280;color:#fff;";
    const infStyle  = "background:#2563eb;color:#fff;";
    const wrnStyle  = "background:#b45309;color:#fff;";
    const errStyle  = "background:#b91c1c;color:#fff;";

    function _log(kind, tag, ...args) {
      if (!_enabled(kind)) return;
      const map = { trace: dbgStyle, debug: dbgStyle, info: infStyle, warn: wrnStyle, error: errStyle };
      const style  = baseStyle + (map[kind] || dbgStyle);
      const tstyle = baseStyle + tagStyle;
      const prefix = [`%cAT%c${tag ? " " + tag : ""}%c ${_ts()}`, tstyle, style, ""];
      const fn = console[kind] || console.log;
      try { fn.apply(console, prefix.concat(args)); } catch {}
    }

    function _canGroup()   { return _enabled("info"); }  // groups at >= info
    function _canTime()    { return _enabled("debug"); } // timers at >= debug
    function _canTimeEnd() { return _enabled("debug"); }

    function maskToken(tok) {
      if (!tok || typeof tok !== "string") return tok;
      const raw = tok.replace(/^Bearer\s+/i,"");
      if (raw.length <= 8) return "••"+raw.length;
      return raw.slice(0,4)+"…"+raw.slice(-4);
    }
    function redactHeaders(h) {
      try {
        const out = { ...(h||{}) };
        if (out.Authorization) {
          const raw = String(out.Authorization).replace(/^Bearer\s+/i,"");
          out.Authorization = `Bearer ${maskToken(raw)}`;
        }
        return out;
      } catch { return h; }
    }

    const api = {
      setLevel, getLevel, LEVELS,
      trace: (...a)          => _log("trace","",...a),
      debug: (tag,...a)      => _log("debug",tag,...a),
      info:  (tag,...a)      => _log("info", tag,...a),
      warn:  (tag,...a)      => _log("warn", tag,...a),
      error: (tag,...a)      => _log("error",tag,...a),
      group(tag, label) { if (_canGroup()) try { console.group(`%cAT %c${tag} ${label||""}`, baseStyle+tagStyle, baseStyle+dbgStyle); } catch {} },
      groupEnd()       { if (_canGroup()) try { console.groupEnd(); } catch {} },
     time(label) {
  // only log timers at >= debug if that’s how your LEVELS gate them
  try {
    if (_startedTimers.has(label)) return; // avoid duplicate "already exists"
    console.time(label);
    _startedTimers.add(label);
  } catch {}
},

timeEnd(label) {
  try {
    if (!_startedTimers.has(label)) return; // avoid "does not exist"
    console.timeEnd(label);
    _startedTimers.delete(label);
  } catch {}
},
      maskToken, redactHeaders
    };
    return api;
  })();

  // === Feature flags (schema requires proper PAT scopes) =====================
  const FEATURES = Object.freeze({
    USE_METADATA_SCHEMA: false, // turn on only if PAT has schema access
    USE_CURATED_SOURCES: false, // turn on only if those tables actually exist
  });

  // ==========================================================================
  //                             AirtableService
  // ==========================================================================
  class AirtableService {
    constructor(cfg = AIRTABLE_CONFIG) {
      const c = cfg || {};
      this.apiKey = String(c.API_KEY || "").replace(/^Bearer\s+/i, "");
      this.baseId = c.BASE_ID;
      this.tableId = c.TABLE_ID;
      this.viewId  = c.VIEW_ID;
      this.sources = c.SOURCES || {};

      AIRTABLE_LOGGER.info("init","AirtableService ready",{
        baseId:this.baseId, tableId:this.tableId, viewId:this.viewId,
        apiKey:`Bearer ${AIRTABLE_LOGGER.maskToken(this.apiKey||"")}`
      });
    }

    headers() {
      if (!this.apiKey) {
        AIRTABLE_LOGGER.error("headers","Missing Airtable API key.");
        throw new Error("Missing Airtable API key.");
      }
      const h = {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      };
      AIRTABLE_LOGGER.debug("headers", AIRTABLE_LOGGER.redactHeaders(h));
      return h;
    }

    // ---- URLs for main table ----
    listUrl(offset) {
  const base =
    `https://api.airtable.com/v0/${this.baseId}/${this.tableId}` +
    `?view=${encodeURIComponent(this.viewId)}` +
    `&cellFormat=string&timeZone=America/New_York&userLocale=en-us`;
  return offset ? `${base}&offset=${encodeURIComponent(offset)}` : base;
}
    tableUrl(id) {
      const base = `https://api.airtable.com/v0/${this.baseId}/${this.tableId}`;
      const url = id ? `${base}/${id}` : base;
      AIRTABLE_LOGGER.debug("tableUrl", url); return url;
    }

    // ---- URLs for arbitrary source tables ----
  otherListUrl(tableId, viewId, offset) {
  const base =
    `https://api.airtable.com/v0/${this.baseId}/${tableId}` +
    `?view=${encodeURIComponent(viewId)}` +
    `&cellFormat=string&timeZone=America/New_York&userLocale=en-us`;
  return offset ? `${base}&offset=${encodeURIComponent(offset)}` : base;
}
    otherTableUrl(tableId, id) {
      const base = `https://api.airtable.com/v0/${this.baseId}/${tableId}`;
      return id ? `${base}/${id}` : base;
    }

    // ---- internal fetch w/ logging ----
    async _fetch(url, options = {}, tag = "fetch") {
      AIRTABLE_LOGGER.group(tag, `${options.method||"GET"} ${url}`);
      const t0 = performance.now ? performance.now() : Date.now();
      try {
        const res = await fetch(url, options);
        const ms = (performance.now?performance.now():Date.now()) - t0;
        AIRTABLE_LOGGER.info(tag, "response", { ok:res.ok, status:res.status, durationMs:Math.round(ms) });
        return res;
      } catch (err) {
        const ms = (performance.now?performance.now():Date.now()) - t0;
        AIRTABLE_LOGGER.error(tag, "network error", { error:err, durationMs:Math.round(ms) });
        throw err;
      } finally { AIRTABLE_LOGGER.groupEnd(); }
    }

async fetchDropdowns({
  branchField   = "Branch",
  fieldMgrField = "Field Manager",
  neededByField = "Needed By",
  reasonField   = "Reason For Fill In",
} = {}) {
  // Page through the CURRENT table/view
  const setB = new Set(), setFM = new Set(), setN = new Set(), setR = new Set();
  let url = this.listUrl();
  for (;;) {
    const res = await this._fetch(url, { headers: this.headers() }, "list");
    if (!res.ok) throw new Error(`fetchDropdowns failed: ${res.status} ${await res.text?.()}`);
    const j = await res.json();
    for (const r of (j.records || [])) {
      const f = r.fields || {};
      if (typeof f[branchField]   === "string") setB.add(f[branchField]);
      if (typeof f[fieldMgrField] === "string") setFM.add(f[fieldMgrField]);
      if (f[neededByField] != null) setN.add(String(f[neededByField]));
      if (f[reasonField]   != null) setR.add(String(f[reasonField]));
    }
    if (!j.offset) break;
    url = this.listUrl(j.offset);
  }
  return {
    branch:       Array.from(setB).sort(),
    fieldManager: Array.from(setFM).sort(),
    neededBy:     Array.from(setN).sort(),
    reason:       Array.from(setR).sort(),
  };
}


    // ---- source table ops (for linked fields) ----
    async fetchAllFromSource(tableId, viewId, signal) {
      if (!tableId || !viewId) {
        throw new Error(`Missing tableId/viewId for source. ${_fmtSrc("fetchAllFromSource", this.baseId, tableId, viewId)}`);
      }
      let url = this.otherListUrl(tableId, viewId);
      const out = [];
      while (url) {
        const res = await this._fetch(url, { headers: this.headers(), signal }, "list-src");
        if (!res.ok) {
          const body = await (async () => { try { return await res.text(); } catch { return ""; } })();
          throw new Error(`List (src) failed: ${res.status} ${body || ""} ${_fmtSrc("fetchAllFromSource", this.baseId, tableId, viewId)}`);
        }
        const j = await res.json();
        out.push(...(j.records || []));
        url = j.offset ? this.otherListUrl(tableId, viewId, j.offset) : null;
      }
      return out;
    }

    async _probeSource(tableId, viewId, signal) {
      const base = `https://api.airtable.com/v0/${this.baseId}/${tableId}?view=${encodeURIComponent(viewId)}`;
      const url  = `${base}&maxRecords=1`;
      const res  = await this._fetch(url, { headers: this.headers(), signal }, "probe-src");
      if (!res.ok) {
        const txt = await (async () => { try { return await res.text(); } catch { return ""; } })();
        const hint = (txt && txt.includes("INVALID_PERMISSIONS_OR_MODEL_NOT_FOUND"))
          ? "This table id likely doesn't exist in this base (or your PAT lacks access)."
          : "";
        throw new Error(`Probe failed: ${res.status} ${txt || ""} ${_fmtSrc("probe", this.baseId, tableId, viewId)} ${hint}`);
      }
      return true;
    }

  /** Returns { options:[{id,label}], idToLabel:Map, labelToId:Map } */
async fetchOptionsFromSource({ tableId, viewId, labelCandidates = [] } = {}) {
  if (!tableId || !viewId) {
    throw new Error(`fetchOptionsFromSource: missing tableId/viewId.`);
  }

  // Fail fast if the table/view is bad
  await this._probeSource(tableId, viewId);

  const rawOptions = [];
  const idToLabel  = new Map();
  const labelToId  = new Map();
  const normalize = (s) => String(s || "").replace(/\s+/g, " ").trim();

  // ✅ Actually fetch all records from the source view
  const records = await this.fetchAllFromSource(tableId, viewId);
  for (const r of records) {
    const id    = r.id;
    const label = normalize(AirtableService._pickLabel(r.fields || {}, labelCandidates));
    if (!id || !label) continue;
    rawOptions.push({ id, label });
    idToLabel.set(id, label);
    const key = label.toLocaleLowerCase();
    if (!labelToId.has(key)) labelToId.set(key, id);
  }

  rawOptions.sort((a,b) => a.label.localeCompare(b.label, undefined, { numeric:true, sensitivity:"base" }));

  const seen = new Set();
  const options = [];
  for (const o of rawOptions) {
    const key = o.label.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    options.push(o);
  }

  AIRTABLE_LOGGER.info("src", `Fetched ${options.length} options [base=${this.baseId} table=${tableId} view=${viewId}]`);
  return { options, idToLabel, labelToId };
}


    static _pickLabel(fields, candidates) {
      for (const key of candidates) {
        const val = fields?.[key];
        if (val != null) {
          if (Array.isArray(val) && val.length) return String(val[0]);
          if (typeof val === "string" && val.trim()) return val.trim();
          if (typeof val === "number") return String(val);
        }
      }
      for (const [k,v] of Object.entries(fields||{})) {
        if (v == null) continue;
        if (Array.isArray(v) && v.length && typeof v[0] !== "object") return String(v[0]);
        if (typeof v === "string" && v.trim()) return v.trim();
        if (typeof v === "number") return String(v);
      }
      return "";
    }

    async fetchFieldManagerOptions() {
      const src = this.sources.FIELD_MANAGER || {};
      if (!src.TABLE_ID || !src.VIEW_ID) {
        throw new Error(`FIELD_MANAGER source missing table/view. ${_fmtSrc("FIELD_MANAGER", this.baseId, src.TABLE_ID, src.VIEW_ID)}`);
      }
      return this.fetchOptionsFromSource({
        tableId: src.TABLE_ID,
        viewId:  src.VIEW_ID,
        labelCandidates: src.LABEL_CANDIDATES || ["Full Name","Name","Field Manager","Field Manager Name","Title"]
      });
    }

    async fetchBranchOptions() {
      const src = this.sources.BRANCH || {};
      if (!src.TABLE_ID || !src.VIEW_ID) {
        throw new Error(`BRANCH source missing table/view. ${_fmtSrc("BRANCH", this.baseId, src.TABLE_ID, src.VIEW_ID)}`);
      }
      return this.fetchOptionsFromSource({
        tableId: src.TABLE_ID,
        viewId:  src.VIEW_ID,
        labelCandidates: src.LABEL_CANDIDATES || ["Vanir Office","Branch","Name","Division","Office"]
      });
    }

    async fetchCustomerOptions() {
      const src = this.sources.CUSTOMER || {};
      if (!src.TABLE_ID || !src.VIEW_ID) {
        throw new Error(`CUSTOMER source missing table/view. ${_fmtSrc("CUSTOMER", this.baseId, src.TABLE_ID, src.VIEW_ID)}`);
      }
      return this.fetchOptionsFromSource({
        tableId: src.TABLE_ID,
        viewId:  src.VIEW_ID,
        labelCandidates: src.LABEL_CANDIDATES || ["Client Name","Client","Name"]
      });
    }

    async fetchSubcontractorOptionsFilteredByBranch(branchLabel) {
      const src = this.sources.SUBCONTRACTOR || {};
      const { options } = await this.fetchOptionsFromSource({
        tableId: src.TABLE_ID,
        viewId:  src.VIEW_ID,
        labelCandidates: src.LABEL_CANDIDATES || ["Subcontractor Company Name","Company","Company Name","Name"]
      });

      const records = await this.fetchAllFromSource(src.TABLE_ID, src.VIEW_ID);
      const byId = new Map(records.map(r => [r.id, r]));

      const normalize = (s) => String(s || "").trim().toLocaleLowerCase();

      const filtered = options.filter(opt => {
        const rec = byId.get(opt.id);
        const f   = (rec && rec.fields) || {};
        let sb = "";
        const v = f["Vanir Branch"];
        if (Array.isArray(v) && v.length) {
          sb = typeof v[0] === "string" ? v[0] : (v[0]?.name || v[0]?.label || "");
        } else if (typeof v === "string") {
          sb = v;
        }
        return normalize(sb) === normalize(branchLabel);
      });

      return filtered; // [{id,label}]
    }

    // === Metadata (Option A) =================================================
    async fetchTablesSchema(signal){
      if (this._schemaCache) return this._schemaCache;
      const url = `https://api.airtable.com/v0/meta/bases/${this.baseId}/tables`;
      const res = await this._fetch(url, { headers: this.headers(), signal }, "meta-tables");
      if (!res.ok) throw new Error(`Metadata tables failed: ${res.status} ${await res.text()}`);
      const j = await res.json();
      this._schemaCache = j?.tables || [];
      return this._schemaCache;
    }

    async fetchSelectOptionsFromSchema({ tableId, fieldName, signal }){
      const tables = await this.fetchTablesSchema(signal);
      const table = tables.find(t => t.id === tableId || t.name === tableId);
      if (!table) throw new Error(`Table not found in schema: ${tableId}`);

      const field = (table.fields || []).find(f => f.name === fieldName || f.id === fieldName);
      if (!field) throw new Error(`Field not found in schema: ${fieldName} (table ${tableId})`);

      const choices = field?.options?.choices || [];
      const labels = choices
        .map(c => (c?.name ?? "").trim())
        .filter(Boolean)
        .sort((a,b)=>a.localeCompare(b, undefined, {numeric:true, sensitivity:"base"}));

      AIRTABLE_LOGGER.info("meta", `${fieldName} type=${field.type} choices=${labels.length}`);
      return { type: field.type, options: labels, raw: field };
    }

    // === static helpers ======================================================
    static config() {
      return {
        API_KEY: `Bearer ${AIRTABLE_LOGGER.maskToken(AIRTABLE_CONFIG.API_KEY)}`,
        BASE_ID: AIRTABLE_CONFIG.BASE_ID,
        TABLE_ID: AIRTABLE_CONFIG.TABLE_ID,
        VIEW_ID: AIRTABLE_CONFIG.VIEW_ID,
        SOURCES: AIRTABLE_CONFIG.SOURCES,
      };
    }
    static setLogLevel(level) { AIRTABLE_LOGGER.setLevel(level); }
    static getLogLevel() { return AIRTABLE_LOGGER.getLevel(); }

    // ---- CRUD main table ----
    async createRecord(fields) {
      const res = await this._fetch(this.tableUrl(), {
        method: "POST", headers: this.headers(), body: JSON.stringify({ records: [{ fields }] }),
      }, "create");
      if (!res.ok) throw new Error((await safeText(res)) || `Create failed: ${res.status}`);
      const j = await res.json(); return j?.records?.[0] || null;
      async function safeText(resp){ try { return await resp.text(); } catch { return ""; } }
    }
    async patchRecord(id, fields) {
      const res = await this._fetch(this.tableUrl(id), {
        method: "PATCH", headers: this.headers(), body: JSON.stringify({ fields }),
      }, "patch");
      if (!res.ok) throw new Error((await safeText(res)) || `Patch failed: ${res.status}`);
      return await res.json();
      async function safeText(resp){ try { return await resp.text(); } catch { return ""; } }
    }
    async readRecord(id) {
      const res = await this._fetch(this.tableUrl(id), { headers: this.headers() }, "read");
      if (!res.ok) throw new Error((await safeText(res)) || `Read failed: ${res.status}`);
      return await res.json();
      async function safeText(resp){ try { return await resp.text(); } catch { return ""; } }
    }
  }

  // ====== Simple DOM helper ==================================================
  function populateSelect(sel, labels){
    if (!sel) return;
    sel.innerHTML = "";
    for (const lbl of labels){
      const opt = document.createElement("option");
      opt.value = lbl;
      opt.textContent = lbl;
      sel.appendChild(opt);
    }
  }
  global.populateSelect = populateSelect; // expose for any external callers

  // ====== Bootstrap after DOM is ready ======================================
  document.addEventListener("DOMContentLoaded", async () => {
    try { AIRTABLE_LOGGER.setLevel("silent"); } catch {}

    // Ensure runtime overrides are applied even if scripts raced
    try {
      if (global.APP && global.APP.airtable && typeof global.setAirtableRuntimeConfig === "function") {
        global.setAirtableRuntimeConfig(global.APP.airtable);
      }
    } catch {}

    const at = new AirtableService();

    const MAIN_TABLE_ID = (typeof AIRTABLE_CONFIG !== "undefined" ? AIRTABLE_CONFIG.TABLE_ID : "");
    const BASE_ID       = (typeof AIRTABLE_CONFIG !== "undefined" ? AIRTABLE_CONFIG.BASE_ID  : "");

    function labelsFromPairs(pairs) {
      try { return (pairs || []).map(p => p.label).filter(Boolean); } catch { return []; }
    }

    async function trySchemaFill(fieldName, sel) {
      if (!FEATURES || !FEATURES.USE_METADATA_SCHEMA) return false;
      try {
        const r = await at.fetchSelectOptionsFromSchema({ tableId: MAIN_TABLE_ID, fieldName });
        const options = Array.isArray(r?.options) ? r.options : [];
        if (options.length) { populateSelect(sel, options); AIRTABLE_LOGGER.info("schema", `${fieldName}: ${options.length} options`); return true; }
      } catch (e) {
        AIRTABLE_LOGGER.warn("schema", `Failed for ${fieldName}`, e);
      }
      return false;
    }

    async function tryCuratedSource(sourceKey, sel) {
      if (!FEATURES || !FEATURES.USE_CURATED_SOURCES) return false;
      try {
        const src = AIRTABLE_CONFIG?.SOURCES?.[sourceKey];
        if (!src) return false;
        const { options } = await at.fetchOptionsFromSource({
          tableId: src.TABLE_ID, viewId: src.VIEW_ID, labelCandidates: src.LABEL_CANDIDATES || []
        });
        const labels = labelsFromPairs(options);
        if (labels.length) { populateSelect(sel, labels); AIRTABLE_LOGGER.info("curated", `${sourceKey}: ${labels.length} options`); return true; }
      } catch (e) {
        AIRTABLE_LOGGER.warn("curated", `Source ${sourceKey} failed`, e);
      }
      return false;
    }

    async function tryLegacyScrape(fieldName, sel) {
      try {
        const dd = await at.fetchDropdowns({ neededByField: "Needed By", reasonField: "Reason For Fill In" });
        const map = {
          "Needed By": dd?.neededBy || [],
          "Reason For Fill In": dd?.reason || []
        };
        const arr = map[fieldName] || [];
        if (arr.length) { populateSelect(sel, arr); AIRTABLE_LOGGER.info("legacy", `Filled ${fieldName} from view (${arr.length})`); return true; }
      } catch (e) {
        AIRTABLE_LOGGER.warn("legacy", `Scrape failed for ${fieldName}`, e);
      }
      return false;
    }

    const neededBySel = document.getElementById("neededBySelect");
    const reasonSel   = document.getElementById("reasonSelect");

    try {
      const cached = (global.ATOPTS && typeof ATOPTS.load === "function") ? ATOPTS.load(BASE_ID) : null;
      if (cached) {
        if (neededBySel && Array.isArray(cached.neededBy)) populateSelect(neededBySel, cached.neededBy);
        if (reasonSel   && Array.isArray(cached.reason))   populateSelect(reasonSel,   cached.reason);

        document.querySelectorAll('select[data-airtable-field]').forEach(sel => {
          const f = (sel.getAttribute('data-airtable-field') || "").toLowerCase();
          if (f.includes("needed") && f.includes("by") && Array.isArray(cached.neededBy)) populateSelect(sel, cached.neededBy);
          if (f.includes("reason") && Array.isArray(cached.reason)) populateSelect(sel, cached.reason);
        });
      }
    } catch (e) {
      AIRTABLE_LOGGER.warn("cache", "hydrate failed", e);
    }

    if (neededBySel) {
      let ok = await trySchemaFill("Needed By", neededBySel);
      if (!ok) ok = await tryCuratedSource("NEEDED_BY", neededBySel);
      if (!ok) ok = await tryLegacyScrape("Needed By", neededBySel);
      if (!ok) AIRTABLE_LOGGER.warn("ui", "Needed By: no options found.");
    }

    if (reasonSel) {
      let ok = await trySchemaFill("Reason For Fill In", reasonSel);
      if (!ok) ok = await tryCuratedSource("REASON", reasonSel);
      if (!ok) ok = await tryLegacyScrape("Reason For Fill In", reasonSel);
      if (!ok) AIRTABLE_LOGGER.warn("ui", "Reason For Fill In: no options found.");
    }

    const autoSelects = Array.from(document.querySelectorAll('select[data-airtable-field]'));
    for (const sel of autoSelects) {
      const fieldName = sel.getAttribute('data-airtable-field') || "";
      let ok = await trySchemaFill(fieldName, sel);
      if (!ok) {
        const fl = fieldName.toLowerCase();
        if (fl.includes("needed") && fl.includes("by")) ok = await tryCuratedSource("NEEDED_BY", sel);
        if (!ok && fl.includes("reason")) ok = await tryCuratedSource("REASON", sel);
      }
      if (!ok) ok = await tryLegacyScrape(fieldName, sel);
      if (!ok) AIRTABLE_LOGGER.warn("ui", `${fieldName}: no options found.`);
    }
  });

  // Expose to window
  global.AirtableService = AirtableService;
  global.AIRTABLE_CONFIG = AIRTABLE_CONFIG;
  global.AIRTABLE_LOGGER = AIRTABLE_LOGGER;

})(window);

// ============================================================================
// persistSelect helper (unchanged semantics, safe placement after service file)
// ============================================================================
(function(){
  "use strict";

  function persistSelect(elOrSelector, key){
    const sel = (typeof elOrSelector === "string")
      ? document.querySelector(elOrSelector)
      : elOrSelector;
    if (!sel || sel.tagName !== "SELECT" || !key) return;

    const LS_KEY = "persist_select__" + key;

    sel.addEventListener("change", () => {
      try { localStorage.setItem(LS_KEY, sel.value ?? ""); } catch {}
    });

    tryRestore();

    const obs = new MutationObserver(() => tryRestore(true));
    obs.observe(sel, { childList: true });

    function tryRestore(fromObserver = false){
      const saved = (function(){ try { return localStorage.getItem(LS_KEY) || ""; } catch { return ""; } })();
      if (!saved) return;
      const has = Array.from(sel.options).some(o => o.value === saved);
      if (has){
        sel.value = saved;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
        if (fromObserver) obs.disconnect();
      }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    // Place in whichever file currently starts your app (cart.js or patch.js).
// Call this from DOMContentLoaded (and remove other duplicate starters).
window.__AT_BOOT_PROMISE ||= (async () => {
  if (window.APP?.airtable && typeof setAirtableRuntimeConfig === "function") {
    setAirtableRuntimeConfig(window.APP.airtable);
  }
  // Only ONE of these should run here:
  if (typeof initDropdowns === "function") {
    await initDropdowns();
  } else if (typeof startAirtable === "function") {
    await startAirtable();
  }
  return true;
})();

    document.querySelectorAll("select[data-persist-key]").forEach(sel => {
      const key = sel.getAttribute("data-persist-key");
      persistSelect(sel, key);
    });
  });

  window.persistSelect = persistSelect;
})();
// Place in whichever file currently starts your app (cart.js or patch.js).
// Call this from DOMContentLoaded (and remove other duplicate starters).
window.__AT_BOOT_PROMISE ||= (async () => {
  if (window.APP?.airtable && typeof setAirtableRuntimeConfig === "function") {
    setAirtableRuntimeConfig(window.APP.airtable);
  }
  // Only ONE of these should run here:
  if (typeof initDropdowns === "function") {
    await initDropdowns();
  } else if (typeof startAirtable === "function") {
    await startAirtable();
  }
  return true;
})();
