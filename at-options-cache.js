// at-options-cache.js
(function (global) {
  "use strict";

  const TTL_MS = 60 * 60 * 1000; // 1 hour; raise if you want even fewer refetches

  function _key(baseId) { return `at_opts_${baseId || "unknown"}`; }

  function load(baseId) {
    try {
      const raw = sessionStorage.getItem(_key(baseId));
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || typeof obj.savedAt !== "number") return null;
      if (Date.now() - obj.savedAt > TTL_MS) return null;
      return obj.data || null;
    } catch { return null; }
  }

  function save(baseId, data) {
    try {
      sessionStorage.setItem(_key(baseId), JSON.stringify({
        savedAt: Date.now(),
        data
      }));
    } catch {}
  }

  function saveBranchSubs(baseId, branchLabel, pairs) {
    const cur = load(baseId) || {};
    cur.subcontractorsByBranch = cur.subcontractorsByBranch || {};
    cur.subcontractorsByBranch[branchLabel] = pairs;
    save(baseId, cur);
  }

  function getBranchSubs(baseId, branchLabel) {
    const cur = load(baseId);
    if (!cur) return null;
    return (cur.subcontractorsByBranch || {})[branchLabel] || null;
  }

  global.ATOPTS = { load, save, saveBranchSubs, getBranchSubs };
})(window);
