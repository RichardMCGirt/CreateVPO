// skip-network-on-mode-switch.js
(function () {
  "use strict";

  try {
    // Did we *just* reload because of a mode switch?
    var ms = sessionStorage.getItem("vanir_mode_switch");
    var recentSwitch = false;
    if (ms) {
      try {
        var obj = JSON.parse(ms);
        if (obj && typeof obj.at === "number") {
          recentSwitch = (Date.now() - obj.at) < 15000;
        }
      } catch {}
    }
    if (!recentSwitch) return;

    // Tell database.js to skip its Google boot/fetch path
    window.__SKIP_BOOTSTRAP = true;

    // Keys used by database.js:
    var SS_KEY = "vanir_products_cache_v2_ss";
    var LS_KEY = "vanir_products_cache_v2";

    try {
      var raw = sessionStorage.getItem(SS_KEY) || localStorage.getItem(LS_KEY);
      if (raw) {
        var payload = JSON.parse(raw);
        if (payload && Array.isArray(payload.rows)) {
          window.ALL_ROWS = payload.rows.slice();
          window.FULLY_LOADED = true;
        }
      }
    } catch {}

    // If we *don’t* have cached rows, allow a normal fetch (don’t block the app)
    if (!Array.isArray(window.ALL_ROWS) || window.ALL_ROWS.length === 0) {
      window.__SKIP_BOOTSTRAP = false;
    }

    // Clean up the marker after a moment so later reloads behave normally
    setTimeout(function () {
      try { sessionStorage.removeItem("vanir_mode_switch"); } catch {}
    }, 5000);
  } catch {}
})();
