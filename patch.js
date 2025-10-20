  const CUSTOMER_NAME_IS_PLAINTEXT = false; // true ONLY if "Customer Name" is plain text in Airtable

  // --- Utilities ---
  const REC_ID_RE = /^rec[a-zA-Z0-9]{14}$/;
// Natural, case-insensitive A→Z sort for labels
function byAlpha(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

  function fmtMoney(n){
    const num = Number(n || 0);
    try { return num.toLocaleString(undefined, { style: "currency", currency: "USD" }); }
    catch { return "$" + (Math.round(num*100)/100).toFixed(2); }
  }
  function nonEmpty(s){ return typeof s === "string" && s.trim() !== ""; }
  function unmoney(s){
    if (!nonEmpty(s)) return null;
    return Number(String(s).replace(/[^0-9.-]/g,"")) || null;
  }

  // Read saved cart (labor intentionally ignored for Materials Needed)
  function readSavedState(){
    try {
      const raw = localStorage.getItem("vanir_cart_v1");
      const obj = raw ? JSON.parse(raw) : {};
      if (!Array.isArray(obj.cart)) obj.cart = [];
      return obj;
    } catch {
      return { cart: [] };
    }
  }
// patch.js — replace your populateDropdownsFromLinkedTables with this
async function populateDropdownsFromLinkedTables() {
  const svc = new AirtableService();

  const branchSel   = document.getElementById("branchSelect");
  const fmSel       = document.getElementById("fieldManagerSelect");
  const customerSel = document.getElementById("customerSelect");

  // fetch id+label pairs from curated sources (SOURCES config in airtable.service.js)
  const [br, fm, cu] = await Promise.all([
    svc.fetchBranchOptions(),          // -> {options:[{id,label}], idToLabel, labelToId}
    svc.fetchFieldManagerOptions(),
    svc.fetchCustomerOptions(),
  ]);

  // helper to paint with value=ID, text=label
  function populateSelectWithPairs(sel, pairs){
    if (!sel) return;
    sel.innerHTML = "";
    sel.appendChild(new Option("—", ""));
    (pairs||[]).forEach(({id,label}) => {
      const o = document.createElement("option");
      o.value = id;               // IMPORTANT: rec… id
      o.textContent = label;
      o.setAttribute("data-recid", id);
      sel.appendChild(o);
    });
  }

  populateSelectWithPairs(branchSel,   (br.options||[]));
  populateSelectWithPairs(fmSel,       (fm.options||[]));
  populateSelectWithPairs(customerSel, (cu.options||[]));

  // keep maps around for any label→id fallbacks in save
  window.maps = window.maps || { branch:{}, fieldMgr:{}, customer:{} };
  window.maps.branch   = { idToLabel: br.idToLabel,   labelToId: br.labelToId };
  window.maps.fieldMgr = { idToLabel: fm.idToLabel,   labelToId: fm.labelToId };
  window.maps.customer = { idToLabel: cu.idToLabel,   labelToId: cu.labelToId };

  console.info("[dropdowns] populated from linked tables (ID-valued)", {
    branches: br.options?.length || 0,
    managers: fm.options?.length || 0,
    customers: cu.options?.length || 0
  });

  function pickLabel(fields, candidates){
    for (const key of (candidates || [])) {
      const v = fields?.[key];
      if (v == null) continue;
      if (typeof v === "string" && v.trim()) return v.trim();
      if (typeof v === "number") return String(v);
      if (Array.isArray(v) && v.length) {
        const x = v[0];
        if (typeof x === "string") return x.trim();
        if (x && typeof x === "object") {
          const s = String(x.name || x.label || x.value || x.id || "").trim();
          if (s) return s;
        }
      }
      if (typeof v === "object") {
        const s = String(v.name || v.label || v.value || v.id || "").trim();
        if (s) return s;
      }
    }
    // fallback: first string-ish field
    for (const [k,v] of Object.entries(fields || {})) {
      if (typeof v === "string" && v.trim()) return v.trim();
      if (typeof v === "number") return String(v);
      if (Array.isArray(v) && v.length) {
        const x = v[0];
        if (typeof x === "string") return x.trim();
        if (x && typeof x === "object") {
          const s = String(x.name || x.label || x.value || x.id || "").trim();
          if (s) return s;
        }
      }
    }
    return "";
  }

  // read sources from runtime config
  const SRC = (window.AIRTABLE_CONFIG && window.AIRTABLE_CONFIG.SOURCES) || {};
  const NEED = ["BRANCH","FIELD_MANAGER","CUSTOMER"];
  for (const k of NEED) {
    if (!SRC[k] || !SRC[k].TABLE_ID || !SRC[k].VIEW_ID) {
      console.warn(`[dropdowns] Missing source for ${k}. Check app-config.js.`);
      return;
    }
  }

  // generic fetch for one source table → array of labels
  async function fetchLabelsFromSource(key) {
    const src = SRC[key];
    const labels = [];
    let url = svc.otherListUrl(src.TABLE_ID, src.VIEW_ID);
    for (;;) {
      const res = await fetch(url, { headers: svc.headers() });
      if (!res.ok) throw new Error(`[${key}] ${src.TABLE_ID} failed: ${res.status} ${await res.text()}`);
      const j = await res.json();
      for (const r of (j.records || [])) {
        const label = pickLabel(r.fields || {}, src.LABEL_CANDIDATES || []);
        if (label) labels.push(label);
      }
      if (!j.offset) break;
      url = svc.otherListUrl(src.TABLE_ID, src.VIEW_ID, j.offset);
    }
    // unique + sort
    return Array.from(new Set(labels)).sort(byAlpha);
  }

  // fetch three lists in parallel (tiny payloads, very fast)
  const [branches, managers, customers] = await Promise.all([
    fetchLabelsFromSource("BRANCH"),
    fetchLabelsFromSource("FIELD_MANAGER"),
    fetchLabelsFromSource("CUSTOMER"),
  ]);

  // push into your selects (adjust IDs if needed)
  fill(document.getElementById("branchSelect"),       branches);
  fill(document.getElementById("fieldManagerSelect"), managers);
  fill(document.getElementById("customerSelect"),     customers);

  console.info("[dropdowns] populated from linked tables", {
    branches: branches.length, managers: managers.length, customers: customers.length
  });
}

// ========= Call it once after runtime is applied =========
document.addEventListener("DOMContentLoaded", () => {
  if (window.APP?.airtable && typeof setAirtableRuntimeConfig === "function") {
    setAirtableRuntimeConfig(window.APP.airtable); // make sure Fill-In is active
  }
  window.__AT_CORE_DROPDOWNS__ ||= populateDropdownsFromLinkedTables();
});

  // Scrape visible cart table in case localStorage cart items don't have vendor/fields
  function scrapeCartFromDOM(){
    const rows = Array.from(document.querySelectorAll("#cart-table tbody tr"));
    const out = [];
    for (const tr of rows) {
      const tds = tr.querySelectorAll("td");
      if (!tds || tds.length < 6) continue;
      const vendor = tds[0]?.textContent?.trim() || "";
      const sku    = tds[1]?.textContent?.trim() || "";
      const desc   = tds[2]?.textContent?.trim() || "";
      // Qty cell could contain an <input>; prefer its value
      let qty = tds[3]?.querySelector("input,select")?.value ?? tds[3]?.textContent?.trim() ?? "";
      qty = String(qty).trim();
      const lineStr = tds[5]?.textContent?.trim() || "";
      const lineTotal = unmoney(lineStr);

      out.push({ vendor, sku, desc, qty, lineTotal });
    }
    return out;
  }

  // Robust vendor extractor: handles many possible key names
  function getVendor(it){
    return (
      it.vendor ??
      it.Vendor ??
      it.vendorName ??
      it.VendorName ??
      it.vendor_name ??
      it.brand ??
      it.Brand ??
      it.manufacturer ??
      it.Manufacturer ??
      it.mfg ??
      it.MFG ??
      ""
    );
  }

  // Prefer saved cart, but if it lacks vendors, merge in DOM info; if cart empty, use DOM
  function getEffectiveMaterials(){
    const { cart } = readSavedState();
    const domRows = scrapeCartFromDOM();

    if (!cart.length && domRows.length) return domRows;

    // Merge: for each saved item, fill vendor/SKU/desc/qty/line if missing using DOM row at same index
    const merged = cart.map((it, i) => {
      const dom = domRows[i] || {};
      const vendor = nonEmpty(getVendor(it)) ? getVendor(it) : (dom.vendor || "");
      const sku    = nonEmpty(it.sku) ? it.sku : nonEmpty(it.SKU) ? it.SKU : (dom.sku || (it.key?.split?.("|")?.[0]) || "");
      const desc   = nonEmpty(it.desc) ? it.desc : nonEmpty(it.description) ? it.description : nonEmpty(it.Description) ? it.Description : (dom.desc || "");
      const qty    = it.qty != null ? it.qty : (it.quantity != null ? it.quantity : (nonEmpty(dom.qty) ? dom.qty : it.Qty));
      const line   = it.lineTotal != null ? it.lineTotal : (it.ext != null ? it.ext : (it.priceExt != null ? it.priceExt : (dom.lineTotal ?? null)));
      return { vendor, sku, desc, qty, lineTotal: line };
    });

    return merged;
  }

  // Build "Materials Needed" (materials ONLY; includes per-line Vendor + VENDORS section)
  function buildMaterialsNeededText(){
    const items = getEffectiveMaterials();
    const lines = [];

    // Collect vendors for summary section
    const vendorSet = new Set();
    for (const it of items) {
      const v = String(getVendor(it) || it.vendor || "").trim();
      if (v) vendorSet.add(v);
    }

    
    if (items.length) {
      items.forEach((it, idx) => {
        const vendor = (getVendor(it) || it.vendor || "").trim();
        const sku    = (it.sku || it.SKU || "").trim();
        const desc   = (it.desc || it.description || it.Description || "").trim();
        const qty    = (it.qty != null ? it.qty : (it.quantity != null ? it.quantity : it.Qty));
        const qtyStr = (qty == null || qty === "") ? "1" : String(qty);

        const parts = [
          `${idx+1}.`,
          `Vendor: ${nonEmpty(vendor) ? vendor : "—"}`,
          nonEmpty(sku)  ? `SKU: ${sku}`   : ``,
          `Desc: ${nonEmpty(desc) ? desc : "—"}`,
          `Qty: ${qtyStr}`
        ].filter(Boolean);

        // If we have a numeric line total, append it
        const line = (it.lineTotal != null) ? it.lineTotal : null;
        if (line != null && !Number.isNaN(Number(line))) parts.push(``);

        lines.push(parts.join(" | "));
      });
      lines.push("");
    } else {
      lines.push("(none)");
      lines.push("");
    }

    const productTotal = document.getElementById("productTotal")?.textContent?.trim();
    if (productTotal) {
      
    }

    return lines.join("\n");
  }

// FULL replacement for loadSubcontractorsForSelectedBranch (VPO path; value=recID)
async function loadSubcontractorsForSelectedBranch(ev) {
  try {
    const svc  = new AirtableService();
    const app  = (window.APP_MODE || (window.APP && window.APP.key) || "vpo").toLowerCase();
    const bSel = document.getElementById("branchSelect");
    const sSel = document.getElementById("subcontractorCompanySelect");
    if (!bSel || !sSel) return;

    // Clear first
    while (sSel.firstChild) sSel.removeChild(sSel.firstChild);
    sSel.appendChild(new Option("—", ""));

    const branchId = (bSel.value || "").trim();
    if (!branchId) return;

    // Convert Branch recId -> human label
    const label = (window.maps && window.maps.branch && window.maps.branch.idToLabel)
      ? (window.maps.branch.idToLabel.get(branchId) || "")
      : "";

    // VPO mode: use curated SOURCE (value must be recID)
    if (app === "vpo") {
      const pairs = await svc.fetchSubcontractorOptionsFilteredByBranch(label);
      for (const p of (pairs || [])) {
        const o = document.createElement("option");
        o.value = p.id;           // IMPORTANT: rec… id for linked field
        o.textContent = p.label;  // human readable name
        sSel.appendChild(o);
      }
      // bubble change so any dependent logic runs
      sSel.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    // Fill-In mode: intentionally left empty (implement when needed)
  } catch (e) {
    console.warn("[subcontractor] load failed:", e);
    const sSel = document.getElementById("subcontractorCompanySelect");
    if (sSel) { sSel.innerHTML = ""; sSel.appendChild(new Option("—", "")); }
  }
}

window.REC_ID_RE = window.REC_ID_RE || /^rec[a-zA-Z0-9]{14}$/; // rec + 14 chars

function nonEmpty(s){ return !!(s && String(s).trim()); }

function getSelectedLabel(sel){
  if (!sel) return "";
  const opt = sel.selectedOptions && sel.selectedOptions[0];
  return (opt ? opt.textContent : sel.value || "").trim();
}
function clearSelectKeepPlaceholder(sel) {
  if (!sel) return;
  const placeholder = sel.querySelector('option[value=""]')?.cloneNode(true) || new Option("—", "");
  while (sel.firstChild) sel.removeChild(sel.firstChild);
  sel.appendChild(placeholder);
}
function getSelectedRecordId(sel){
  if (!sel) return "";
  // 1) Preferred: value IS a rec id
  const val = (sel.value || "").trim();
  if (window.REC_ID_RE.test(val)) return val;

  // 2) Selected option might carry data-recid
  const opt = sel.selectedOptions && sel.selectedOptions[0];
  const recFromData = opt && (opt.getAttribute("data-recid") || "").trim();
  if (recFromData && window.REC_ID_RE.test(recFromData)) return recFromData;

  // 3) Scan all options for one whose label equals current label and has data-recid
  if (opt) {
    const label = (opt.textContent || "").trim();
    for (const o of sel.options) {
      const lbl = (o.textContent || "").trim();
      const rid = (o.getAttribute("data-recid") || "").trim();
      if (lbl === label && window.REC_ID_RE.test(rid)) return rid;
    }
  }
  return "";
}

/** Coerce a recordId into a single-item array exactly as Airtable expects. */
function recIdArr(recId){ return window.REC_ID_RE.test(recId) ? [recId] : []; }

/** For currency parsing if you need it. */
function unmoney(s){
  if (!s) return null;
  const n = Number(String(s).replace(/[^0-9.-]/g,""));
  return Number.isFinite(n) ? n : null;
}
function populateSelectPairs(sel, pairs) {
  clearSelectKeepPlaceholder(sel);
  (pairs || []).forEach(({ value, label }) => {
    const o = document.createElement("option");
    o.value = value; o.textContent = label;
    sel.appendChild(o);
  });
}
  function canonicalizeVendorLabel(raw) {
    let s = String(raw || "").trim();
    s = s.replace(/\s*[–—]\s*/g, " - ");
    s = s.replace(/\s*\([^)]*\)\s*$/, "");         // drop "(...)" at end
    const beforeDash = s.split(" - ")[0]?.trim();  // keep part before " - "
    return beforeDash || s;
  }
   window.resolvePreferredVendorForFillIn = async function(fields) {
    try {
      const svc = new AirtableService();
      // 1) Prefer a recId from a select if you ever add one for Fill-In
      const vendorSel = document.getElementById("subcontractorCompanySelect");
      const val = (vendorSel && vendorSel.value || "").trim();
      if (REC_ID_RE.test(val)) {
        fields["Preferred Vendor"] = [val];
        return;
      }

      // 2) Otherwise derive from Materials Needed (first vendor)
      const items = (typeof getEffectiveMaterials === "function") ? getEffectiveMaterials() : [];
      const firstVendorRaw = (items.find(x => (x && (x.vendor || x.Vendor)))?.vendor) ||
                             (items[0]?.vendor) || "";
      const labelRaw = selectedOptionText(vendorSel) || firstVendorRaw || "";
      if (!labelRaw) return;

      const label = canonicalizeVendorLabel(labelRaw); // e.g., "ABC Supply - Charlotte" -> "ABC Supply"
      let rec = await svc.findVendorByName(label);
      if (!rec && label !== labelRaw) {
        // last try: use the raw label (in case the exact record name really includes the city)
        rec = await svc.findVendorByName(labelRaw);
      }

      if (rec?.id) {
        fields["Preferred Vendor"] = [rec.id];  // linked record expects array
      } else {
        console.warn("[Preferred Vendor] No match in linked table for label:", labelRaw);
      }
    } catch (e) {
      console.warn("[Preferred Vendor] resolve failed:", e);
    }
  };

  function selectedOptionText(sel) { return sel?.selectedOptions?.[0]?.textContent?.trim() || ""; }

  (function wireSave(){
    const btn = document.getElementById("saveAirtable");
    const status = document.getElementById("airtableStatus");
    if (!btn) return;

    function setStatus(s, tone){
      if (!status) return;
      status.textContent = s;
      status.style.background = tone === "bad" ? "#fee2e2" :
                                tone === "ok"  ? "#dcfce7" : "rgba(0,0,0,.06)";
      status.style.color = tone === "bad" ? "#991b1b" :
                           tone === "ok"  ? "#065f46" : "inherit";
    }

// ===== handleSave.js =====
window.REC_ID_RE = window.REC_ID_RE || /^rec[a-zA-Z0-9]{14}$/;

function nonEmpty(s){ return !!(s && String(s).trim()); }

function getSelectedLabel(sel){
  if (!sel) return "";
  const opt = sel.selectedOptions && sel.selectedOptions[0];
  return (opt ? opt.textContent : sel.value || "").trim();
}
const branchRec = getSelectedRecordIdWithMap(document.getElementById("branchSelect"),   window.maps?.branch);
const fmRec     = getSelectedRecordIdWithMap(document.getElementById("fieldManagerSelect"), window.maps?.fieldMgr);
const custRec   = getSelectedRecordIdWithMap(document.getElementById("customerSelect"), window.maps?.customer);
/** Uses value OR data-recid OR MAP(label) to resolve to a record id */
function getSelectedRecordIdWithMap(sel, map){
  
  if (!sel) return "";
  const val = (sel.value || "").trim();
  if (window.REC_ID_RE.test(val)) return val;
  const opt = sel.selectedOptions && sel.selectedOptions[0];
  const dataId = (opt && opt.getAttribute("data-recid")) || "";
  if (window.REC_ID_RE.test(dataId)) return dataId;
  const label = (opt ? opt.textContent : val).trim().toLowerCase();
  if (label && map && map.labelToId && map.labelToId.get) {
    const found = map.labelToId.get(label);
    if (window.REC_ID_RE.test(found)) return found;
  }
  return "";
}

function recIdArr(recId){ return window.REC_ID_RE.test(recId) ? [recId] : []; }

// Where we persist the current record id once created/fetched
const LS_REC_KEY = "vanir_current_record_id";

// Resolve the current record id from multiple places (URL, hidden input, localStorage, window)
function getTargetRecordId(){
  // a) explicit global
  if (typeof window.CURRENT_RECORD_ID === "string" && REC_ID_RE.test(window.CURRENT_RECORD_ID)) {
    return window.CURRENT_RECORD_ID;
  }
  // b) ?recordId=recXXXXXXXXXXXXXX | ?id=... | ?rid=...
  try {
    const u = new URL(location.href);
    for (const k of ["recordId","id","rid"]) {
      const v = (u.searchParams.get(k) || "").trim();
      if (REC_ID_RE.test(v)) return v;
    }
  } catch {}
  // c) hidden input or data attribute
  const hid = document.getElementById("currentRecordId");
  if (hid && REC_ID_RE.test(hid.value || "")) return hid.value.trim();
  const bodyRid = document.body?.getAttribute?.("data-current-record-id") || "";
  if (REC_ID_RE.test(bodyRid)) return bodyRid.trim();
  // d) localStorage
  const ls = (localStorage.getItem(LS_REC_KEY) || "").trim();
  if (REC_ID_RE.test(ls)) return ls;
  return null;
}

// Save the id so subsequent saves can reference it
function setCurrentRecordId(id){
  if (REC_ID_RE.test(id)) {
    localStorage.setItem(LS_REC_KEY, id);
    window.CURRENT_RECORD_ID = id;
    // if you have a hidden input, mirror it:
    const hid = document.getElementById("currentRecordId");
    if (hid) hid.value = id;
    // also mirror on body for debugging convenience
    document.body?.setAttribute?.("data-current-record-id", id);
  }
}
// Normalizer for fuzzy label matching
function norm(s){ return String(s||"").trim().toLowerCase().replace(/\s+/g," "); }

// Pick the most frequent string in an array
function mostCommon(arr){
  const m = new Map();
  for (const x of arr) m.set(x, (m.get(x)||0)+1);
  let best=null, cnt=0;
  for (const [k,v] of m) if (v>cnt){ best=k; cnt=v; }
  return best;
}

// Force lookup in the exact table that the "Preferred Vendor" field links to
async function resolveVendorRecordId(label, svc) {
  if (!label) return null;
  const service = svc || new AirtableService();
  const tableId = (window.APP?.airtable?.PREFERRED_VENDOR_TABLE_ID) || "tblp77wpnsiIjJLGh";
  const rec = await service.findVendorByName(label, { tableId });
  return rec?.id || null;
}

// Verify an id actually belongs to the given table (returns true/false)
async function ensureIdInTable(service, tableId, recId) {
  try {
    const url = service.otherTableUrl(tableId, recId);
    const res = await fetch(url, { headers: service.headers() });
    return res.ok; // 200 means the id exists in that table; 404 means wrong table
  } catch {
    return false;
  }
}

window.collectVendorLabels = collectVendorLabels;
window.mostCommon          = mostCommon;
window.resolveVendorRecordId = resolveVendorRecordId;
// Collect vendor labels from UI/cart (DOM-first; state fallback)
function collectVendorLabels(){
  const out = [];

  // A) DOM: the "Selected SKUs" table has <td data-label="Vendor">...</td>
  document.querySelectorAll('td[data-label="Vendor"]').forEach(td=>{
    const t = (td.textContent || "").trim();
    if (t) out.push(t);
  });

  // B) Saved state (if available)
  try {
    const state = (typeof getSaved === "function") ? getSaved() : null;
    if (state?.cart?.length){
      for (const it of state.cart){
        const v = (it?.Vendor || it?.vendor || it?.vendorName || "").trim?.();
        if (v) out.push(v);
      }
    }
  } catch{}

  return out;
}

// Safe “money” parser used below
function unmoney(s){
  if (!s || !String(s).trim()) return null;
  return Number(String(s).replace(/[^0-9.-]/g,"")) || null;
}

// Utility
function nonEmpty(s){ return !!(s && String(s).trim()); }
function getSelectedLabel(sel){ return sel?.selectedOptions?.[0]?.textContent?.trim() || ""; }
function recIdArr(id){ return [String(id)]; }
function toNumberLoose(x){ const n = Number(x); return Number.isFinite(n) ? n : 0; }

async function handleSave(){
  const t0 = (performance.now ? performance.now() : Date.now());
  console.groupCollapsed("[Save] handleSave");
  try {
    const svc = new AirtableService();
    const fields = {};
    const suspicious = [];

    // Grab elements
    const customerSel   = document.getElementById("customerSelect");
    const branchSel     = document.getElementById("branchSelect");
    const fmSel         = document.getElementById("fieldManagerSelect");
    const neededBySel   = document.getElementById("neededBySelect");
    const subSel        = document.getElementById("subcontractorCompanySelect");
    const jobNameEl     = document.getElementById("jobName");
    const planNameEl    = document.getElementById("planName");
    const elevEl        = document.getElementById("elevation");
    const reasonSel     = document.getElementById("reasonSelect");
    const describeEl    = document.getElementById("pleaseDescribe");
    const descWorkEl    = document.getElementById("descriptionOfWork");   // <-- correct id
    const prefVendSel   = document.getElementById("preferredVendorSelect") 
                       || document.getElementById("vendorSelect");        // try both ids

                       // patch.js – just before create/update
const appMode = (window.APP_MODE || (window.APP && window.APP.key) || "vpo").toLowerCase();
if (appMode === "fillin") {
  await window.resolvePreferredVendorForFillIn(fields);
}
let preferredVendorId = "";

if (appMode === "fillin") {
  const vendorSelect = document.getElementById("subcontractorCompanySelect");
  const vendorRecId = getSelectedRecordId(vendorSelect); // works if value=recID
  if (vendorRecId) {
    preferredVendorId = vendorRecId;
  } else {
    // fallback: try to resolve by name
    const vendorName = selectedOptionText(vendorSelect);
    if (vendorName) {
      const svc = new AirtableService();
      const rec = await svc.findVendorByName(vendorName);
      preferredVendorId = rec?.id || "";
    }
  }
}

// include in your fields if present
if (preferredVendorId) {
  fields["Preferred Vendor"] = [preferredVendorId];  // linked record expects array
}

    // Customer Name
    if (customerSel) {
      const id = resolveRecIdFromSelect(customerSel, window.LINKED?.customersByName);
      const lbl = getSelectedLabel(customerSel);
      // If your Airtable field is linked: prefer recId
      if (id) fields["Customer Name"] = recIdArr(id);
      else if (nonEmpty(lbl)) fields["Customer Name"] = lbl; // if your field is plain text
      else suspicious.push("Customer Name (empty)");
    }

    // Branch (linked)
    if (branchSel) {
      const id = resolveRecIdFromSelect(branchSel, window.LINKED?.branchesByName);
      const lbl = getSelectedLabel(branchSel);
      if (id) fields["Branch"] = recIdArr(id);
      else suspicious.push(`Branch (not recId: ${branchSel.value || lbl})`);
    }

    // Field Manager (linked)
    if (fmSel) {
      const id = resolveRecIdFromSelect(fmSel, window.LINKED?.managersByName);
      const lbl = getSelectedLabel(fmSel);
      if (id) fields["Field Manager"] = recIdArr(id);
      else if (nonEmpty(lbl)) suspicious.push("Field Manager (label present but not recId)");
      else suspicious.push("Field Manager (empty)");
    }

    // Needed By (date)
    if (neededBySel && neededBySel.value) {
      fields["Needed By"] = neededBySel.value;
      if (!/^\d{4}-\d{2}-\d{2}/.test(neededBySel.value)) suspicious.push("Needed By (format?) " + neededBySel.value);
    }

    // Subcontractor (linked)
    if (subSel) {
      const id = resolveRecIdFromSelect(subSel, window.LINKED?.subcontractorsByName);
      const lbl = getSelectedLabel(subSel);
      if (id) fields["Subcontractor"] = recIdArr(id);
      else if (nonEmpty(lbl)) suspicious.push("Subcontractor (label present but not recId)");
    }

try {
  const vendorLabels = collectVendorLabels();
  const chosenLabel  = mostCommon(vendorLabels);
  if (chosenLabel) {
    const preferredTableId = (window.APP?.airtable?.PREFERRED_VENDOR_TABLE_ID) || "tblp77wpnsiIjJLGh";
    const venId = await resolveVendorRecordId(chosenLabel, svc); // forced to linked table
    if (venId) {
      // final guard: make sure this recId is indeed in the linked table
      const ok = await ensureIdInTable(svc, preferredTableId, venId);
      if (ok) {
        fields["Preferred Vendor"] = [venId];
      } else {
        console.warn('[Preferred Vendor] Resolved id is not in linked table; skipping to avoid 422', { chosenLabel, venId, preferredTableId });
      }
    } else {
      console.warn('[Preferred Vendor] No match in linked table for label:', chosenLabel);
    }
  }
} catch (e) {
  console.warn("[Preferred Vendor] auto-derive failed:", e);
}

    // ---------- Description of Work ----------
    const descWork = (descWorkEl?.value || "").trim();
    if (nonEmpty(descWork)) fields["Description of Work"] = descWork;

    // Optional “Please Describe”
    if (describeEl && nonEmpty(describeEl.value)) fields["Please Describe"] = describeEl.value.trim();

    // Free text fields
    if (jobNameEl && nonEmpty(jobNameEl.value)) fields["Job Name"] = jobNameEl.value.trim();
    if (planNameEl && nonEmpty(planNameEl.value)) fields["Plan Name"] = planNameEl.value.trim();
    if (elevEl && nonEmpty(elevEl.value)) fields["Elevation"] = elevEl.value.trim();
    if (reasonSel && nonEmpty(reasonSel.value)) fields["Reason For Fill In"] = reasonSel.value.trim();

    // ---------- Materials Needed ----------
    if (typeof buildMaterialsNeededText === "function") {
      try {
        const materials = buildMaterialsNeededText();
        if (typeof materials === "string") fields["Materials Needed"] = materials;
        else suspicious.push("Materials Needed (not a string)");
      } catch (e) {
        console.warn("[Save] buildMaterialsNeededText() threw:", e);
        suspicious.push("Materials Needed (builder error)");
      }
    }

    // Material Cost = Products Total
    try {
      const productTotalStr = document.getElementById("productTotal")?.textContent?.trim() || "";
      const productTotalVal = unmoney(productTotalStr);
      if (productTotalVal != null && Number.isFinite(productTotalVal)) {
        fields["Material Cost"] = Number(productTotalVal);
      } else {
        suspicious.push("Material Cost parse failed: " + productTotalStr);
      }
    } catch (e) {
      suspicious.push("Material Cost (parse error)");
    }

    // Price to Customer = Grand Total
    try {
      const grandTotalStr = document.getElementById("grandTotal")?.textContent?.trim() || "";
      const grandTotalVal = unmoney(grandTotalStr);
      if (grandTotalVal != null && Number.isFinite(grandTotalVal)) {
        fields["Price to Customer"] = Number(grandTotalVal);
      } else {
        suspicious.push("Price to Customer parse failed: " + grandTotalStr);
      }
    } catch (e) {
      suspicious.push("Price to Customer (parse error)");
    }

    // Labor Cost (if applicable)
    if (window.APP?.includeLabor) {
      try {
        const laborTotalStr = document.getElementById("laborTotal")?.textContent?.trim() || "";
        const laborTotalVal = unmoney(laborTotalStr);
        if (laborTotalVal != null && Number.isFinite(laborTotalVal)) {
          fields["Labor Cost"] = Number(laborTotalVal);
        } else {
          suspicious.push("Labor Cost parse failed: " + laborTotalStr);
        }
      } catch (e) {
        suspicious.push("Labor Cost (parse error)");
      }
    }

    // ---------- Debug table ----------
    try {
      console.table(Object.entries(fields).map(([k,v])=>({
        field:k,
        type: Array.isArray(v) ? "array" : typeof v,
        value: Array.isArray(v) ? v.join(",") : String(v).slice(0,150)
      })));
      if (suspicious.length) console.warn("[Save] Suspicious:", suspicious);
    } catch {}

    // ---------- Save: create (or update later if you add updateRecord) ----------
    setStatus && setStatus("Saving…");

    const existingId = getTargetRecordId();
    if (existingId) {
      console.warn("[Save] Existing record id present, but update method not implemented. Creating new row instead.");
    }

    const rec = await svc.createRecord(fields, { typecast: true });
    setCurrentRecordId(rec?.id);

    setStatus && setStatus("Saved ✓", "ok");
    console.info("[Save] Created record:", rec?.id);

  } catch (err) {
    console.error("[Save] Save failed:", err && err.stack ? err.stack : err);
    try {
      setStatus && setStatus("Error saving", "bad");
      const banner = document.getElementById("airtableBanner");
      if (banner && /Missing Airtable API Key/i.test(String(err))) banner.style.display = "block";
    } catch {}
  } finally {
    const ms = (performance.now ? performance.now() : Date.now()) - t0;
    console.info("[Save] handleSave finished in", Math.round(ms), "ms");
    try { const btn = document.getElementById("btnSave"); if (btn) setTimeout(()=>{ btn.disabled = false; }, 300); } catch {}
    console.groupEnd();
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Ensure the app runtime from app-config.js is applied first
    if (window.APP?.airtable && typeof setAirtableRuntimeConfig === "function") {
      setAirtableRuntimeConfig(window.APP.airtable);
    }

    // If we are in Fill-In mode, point the resolver to your Fill-In vendor link table
    const appMode = (window.APP_MODE || (window.APP && window.APP.key) || "vpo").toLowerCase();
    if (appMode === "fillin" && typeof setAirtableRuntimeConfig === "function") {
      setAirtableRuntimeConfig({
        PREFERRED_VENDOR_TABLE_ID: "tblLEYdDi0hfD9fT3", // <-- your Fill-In link table
        VENDORS_NAME_FIELDS: [
          "Name",
          "Vendor Name",
          "Company",
          "Company Name",
          "Preferred Vendor",
          "Preferred Vendor Name"
        ]
      });
    }
  } catch (e) {
    console.warn("[Fill-In vendor override] failed:", e);
  }
});

window.LINKED = window.LINKED || {
  customersByName: new Map(),
  branchesByName: new Map(),
  managersByName: new Map()
};

window.REC_ID_RE = window.REC_ID_RE || /^rec[a-zA-Z0-9]{14}$/;
function applyPairsToSelect(sel, pairs){
  if (!sel || !Array.isArray(pairs)) return;
  const curLabel = (sel.selectedOptions && sel.selectedOptions[0]?.textContent || sel.value || "").trim();

  // clear
  while (sel.firstChild) sel.removeChild(sel.firstChild);

  // placeholder
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = "— Select —";
  sel.appendChild(ph);

  // add id-valued options
  for (const { id, label } of pairs){
    if (!id || !window.REC_ID_RE.test(id)) continue;
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = String(label || "").trim();
    opt.setAttribute("data-recid", id);
    sel.appendChild(opt);
  }

  // reselect by label if possible
  if (curLabel) {
    for (const o of sel.options) {
      if ((o.textContent || "").trim() === curLabel) { o.selected = true; break; }
    }
  }
}

// rehydrate-linked-selects.js
async function rehydrateLinkedSelects(){
  const svc = new AirtableService();

  const branchSel   = document.getElementById("branchSelect");
  const fmSel       = document.getElementById("fieldManagerSelect");
  const customerSel = document.getElementById("customerSelect");

  // Only rehydrate if the select isn't already ID-valued
  const needsIdify = (sel) => {
    if (!sel) return false;
    const o = sel.options && sel.options[1]; // first non-placeholder
    return !!(o && !window.REC_ID_RE.test(o.value));
  };

  try {
    // Fetch curated id+label from source tables
    const fetches = [];
    if (needsIdify(branchSel))   fetches.push(svc.fetchBranchOptions());
    else                         fetches.push(Promise.resolve(null));

    if (needsIdify(fmSel))       fetches.push(svc.fetchFieldManagerOptions());
    else                         fetches.push(Promise.resolve(null));

    if (needsIdify(customerSel)) fetches.push(svc.fetchCustomerOptions());
    else                         fetches.push(Promise.resolve(null));

    const [br, fm, cu] = await Promise.all(fetches);

    if (br && branchSel)   applyPairsToSelect(branchSel,   (br.options || []).map(o => ({ id:o.id, label:o.label })));
    if (fm && fmSel)       applyPairsToSelect(fmSel,       (fm.options || []).map(o => ({ id:o.id, label:o.label })));
    if (cu && customerSel) applyPairsToSelect(customerSel, (cu.options || []).map(o => ({ id:o.id, label:o.label })));

    // Optional: keep quick lookup maps for other code paths
    window.maps = window.maps || { branch:{}, fieldMgr:{} , customer:{} };
    if (br) window.maps.branch   = { idToLabel: br.idToLabel,   labelToId: br.labelToId };
    if (fm) window.maps.fieldMgr = { idToLabel: fm.idToLabel,   labelToId: fm.labelToId };
    if (cu) window.maps.customer = { idToLabel: cu.idToLabel,   labelToId: cu.labelToId };

    console.info("[rehydrateLinkedSelects] Done.",
      { rehydrated: { branch: !!br, fieldManager: !!fm, customer: !!cu } });

  } catch (e) {
    console.warn("[rehydrateLinkedSelects] failed – leaving labels as-is", e);
  }
}

function clearAndSetPlaceholder(sel, placeholder="— Select —"){
  while (sel.firstChild) sel.removeChild(sel.firstChild);
  const opt = document.createElement("option");
  opt.value = "";
  opt.textContent = placeholder;
  sel.appendChild(opt);
}

function addOption(sel, { id, label, selected=false }){
  const opt = document.createElement("option");
  opt.value = id;               // IMPORTANT: value is the record ID
  opt.textContent = label;
  opt.setAttribute("data-recid", id); // redundant but nice for debugging
  if (selected) opt.selected = true;
  sel.appendChild(opt);
}

function populateLinkedSelect(sel, records, { nameField="Name", map } = {}){
  if (!sel || !Array.isArray(records)) return;

  clearAndSetPlaceholder(sel);

  const seen = new Set();
  for (const r of records){
    if (!r || !r.id || !r.fields) continue;
    const label = String(r.fields[nameField] ?? "").trim();
    if (!label) continue;

    addOption(sel, { id: r.id, label });

    if (map) {
      const key = label.toLowerCase();
      if (!seen.has(key)) { 
        map.set(key, r.id);
        seen.add(key);
      }
    }
  }
}

/** Convenience getters to build your maps + populate selects */
function initCustomersSelect(selectEl, customerRecords){
  populateLinkedSelect(selectEl, customerRecords, {
    nameField: "Customer Name",
    map: window.LINKED.customersByName
  });
}

function initBranchesSelect(selectEl, branchRecords){
  populateLinkedSelect(selectEl, branchRecords, {
    nameField: "Vanir Office", // or whatever your branch label field is
    map: window.LINKED.branchesByName
  });
}

function initManagersSelect(selectEl, managerRecords){
  populateLinkedSelect(selectEl, managerRecords, {
    nameField: "Full Name", // adjust to your schema
    map: window.LINKED.managersByName
  });
}

function resolveRecIdFromSelect(sel, nameToIdMap){
  if (!sel) return null;
  const val = (sel.value || "").trim();
  if (REC_ID_RE.test(val)) return val;                       // case 1: value is recId
  const opt = sel.selectedOptions && sel.selectedOptions[0];
  const dataRec = opt?.getAttribute?.("data-recid") || "";   // case 2: data-recid
  if (REC_ID_RE.test(dataRec)) return dataRec;
  const label = (opt?.textContent || "").trim();
  if (nameToIdMap && label) {
    const hit = nameToIdMap.get?.(label) || nameToIdMap[label]; // case 3: map by label
    if (REC_ID_RE.test(hit)) return hit;
  }
  return null;
}

// Export globals for reuse in handleSave.js
window.populateLinkedSelect = populateLinkedSelect;
window.initCustomersSelect = initCustomersSelect;
window.initBranchesSelect = initBranchesSelect;
window.initManagersSelect = initManagersSelect;
window.resolveRecIdFromSelect = resolveRecIdFromSelect;

    // Use { once:true } to avoid duplicate listeners; we reattach after each click.
    function attachOnce(){
      const btnEl = document.getElementById("saveAirtable");
      btnEl.addEventListener("click", function onClick(){
        btnEl.removeEventListener("click", onClick);
        handleSave().finally(attachOnce);
      }, { once: true });
    }
    attachOnce();
  })();
