  // =========================
  // CONFIG: tweak if needed
  // =========================
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


// Refresh subcontractor list whenever Branch changes


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

function selectedOptionText(sel) {
  return sel?.selectedOptions?.[0]?.textContent?.trim() || "";
}

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


// Recognize Airtable record ids
const REC_ID_RE = /^rec[a-zA-Z0-9]{14}$/;

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
const descWorkEl    = document.getElementById("descriptionOfWork");

    // ---------- Linked/Plain fields ----------
    // Customer Name (if your base expects a linked field, ensure the <option value> is a recId)
    if (customerSel) {
      const val = (customerSel.value || "").trim();
      const lbl = getSelectedLabel(customerSel);
      if (REC_ID_RE.test(val)) fields["Customer Name"] = recIdArr(val);
      else if (nonEmpty(lbl))  fields["Customer Name"] = lbl; // fallback if your field is plain text
      else suspicious.push("Customer Name (empty)");
    }

    // Branch (linked)
    if (branchSel) {
      const val = (branchSel.value || "").trim();
      const lbl = getSelectedLabel(branchSel);
      if (REC_ID_RE.test(val)) fields["Branch"] = recIdArr(val);
      else suspicious.push(`Branch (not recId: ${val || lbl})`);
    }

    // Field Manager (linked)
    if (fmSel) {
      const val = (fmSel.value || "").trim();
      const lbl = getSelectedLabel(fmSel);
      if (REC_ID_RE.test(val)) fields["Field Manager"] = recIdArr(val);
      else if (nonEmpty(lbl)) suspicious.push("Field Manager (label present but not recId)");
      else suspicious.push("Field Manager (empty)");
    }

    // Needed By (date)
    if (neededBySel && neededBySel.value) {
      fields["Needed By"] = neededBySel.value;
      if (!/^\d{4}-\d{2}-\d{2}/.test(neededBySel.value)) {
        suspicious.push("Needed By (format?) " + neededBySel.value);
      }
    }

    // Subcontractor (linked)
    if (subSel) {
      const val = (subSel.value || "").trim();
      const lbl = getSelectedLabel(subSel);
      if (REC_ID_RE.test(val)) fields["Subcontractor"] = recIdArr(val);
      else if (nonEmpty(lbl)) suspicious.push("Subcontractor (label present but not recId)");
    }

    // ---------- Description of Work ----------
   const descWork = (descWorkEl?.value || "").trim();
if (nonEmpty(descWork)) fields["Description of Work"] = descWork;

    // Optionally “Please Describe”
    if (describeEl && nonEmpty(describeEl.value)) fields["Please Describe"] = describeEl.value.trim();

    // Free text
    if (jobNameEl && nonEmpty(jobNameEl.value)) fields["Job Name"] = jobNameEl.value.trim();
    if (planNameEl && nonEmpty(planNameEl.value)) fields["Plan Name"] = planNameEl.value.trim();
    if (elevEl && nonEmpty(elevEl.value)) fields["Elevation"] = elevEl.value.trim();
    if (reasonSel && nonEmpty(reasonSel.value)) fields["Reason For Fill In"] = reasonSel.value.trim();

    // ---------- Materials Needed (reuse your existing builder if you have it) ----------
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

    // ---------- Money fields from UI ----------
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

    // ---------- Log what we’re sending ----------
    try {
      console.table(Object.entries(fields).map(([k,v])=>({
        field:k,
        type: Array.isArray(v) ? "array" : typeof v,
        value: Array.isArray(v) ? v.join(",") : String(v).slice(0,150)
      })));
      if (suspicious.length) console.warn("[Save] Suspicious:", suspicious);
    } catch {}

    // ---------- Save: create if we don't already have an id ----------
    setStatus && setStatus("Saving…");

    const existingId = getTargetRecordId();
    if (existingId) {
      // You don't have an update/patch API in AirtableService right now.
      // If/when you add svc.updateRecord(recordId, fields), use it here.
      console.warn("[Save] Existing record id present, but update method not implemented. Creating a new row instead.");
    }

    // Create the record
    const rec = await svc.createRecord(fields, { typecast: true });
    setCurrentRecordId(rec?.id); // remember for future saves
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
    try {
      const btn = document.getElementById("btnSave");
      if (btn) setTimeout(()=>{ btn.disabled = false; }, 300);
    } catch {}
    console.groupEnd();
  }
}


// ===== linked-population.js =====
// Use this after you fetch the linked tables from Airtable.
// It both populates <select> options (value=recId) and builds global label→recId maps.

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
// save-guard.js
async function handleSaveGuarded(saveFn){
  // quick detector: are key selects ID-valued?
  const branchSel = document.getElementById("branchSelect");
  const fmSel     = document.getElementById("fieldManagerSelect");
  const custSel   = document.getElementById("customerSelect");
  const isIdVal = (sel) => {
    const o = sel && sel.options && sel.options[1];
    return !!(o && window.REC_ID_RE.test(o.value));
  };

  // if any are not ID-valued, try to rehydrate first
  if (!isIdVal(branchSel) || !isIdVal(fmSel) || !isIdVal(custSel)) {
    console.warn("[Save] Linked selects not ID-valued. Rehydrating before save…");
    await rehydrateLinkedSelects();
  }

  // now call your real save
  return saveFn();
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

/**
 * Populate a linked <select> with records from Airtable.
 * records: [{id, fields:{Name: "...", ...}}, ...]
 * nameField: which Airtable field to show as label (default "Name")
 * map: Map() to fill with label→id lookups (case-insensitive)
 */
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
      if (!seen.has(key)) { // keep first if duplicates
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

/**
 * If a <select> still uses labels as values (legacy), this resolves to a record id.
 * Tries, in order:
 *   1) value is already a recId
 *   2) selected <option data-recid>
 *   3) lookup by label via a provided Map
 */
function resolveRecIdFromSelect(sel, map){
  if (!sel) return "";
  const raw = (sel.value || "").trim();
  if (window.REC_ID_RE.test(raw)) return raw;

  const opt = sel.selectedOptions && sel.selectedOptions[0];
  const rid = (opt && opt.getAttribute("data-recid")) || "";
  if (window.REC_ID_RE.test(rid)) return rid;

  const label = (opt ? opt.textContent : raw).trim().toLowerCase();
  if (label && map && map.has(label)) return map.get(label);

  return "";
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
