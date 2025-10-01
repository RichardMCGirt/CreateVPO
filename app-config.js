// app-config.js
(function () {
  "use strict";

  // Store your PAT once (or set it in localStorage under "AIRTABLE_API_KEY")
  var PAT = localStorage.getItem("AIRTABLE_API_KEY") || "";

  window.APPS = {
    vpo: {
      key: "vpo",
      uiTitle: "VPO",
      includeLabor: true,
      airtable: {
        API_KEY: PAT,
        BASE_ID: "appQDdkj6ydqUaUkE",
        TABLE_ID: "tblO72Aw6qplOEAhR",
        VIEW_ID:  "viwf55KoUHJZfdEY6",
        SOURCES: {
          FIELD_MANAGER: { TABLE_ID: "tblj6Fp0rvN7QyjRv", VIEW_ID: "viwgHExXtj0VSlmbU",
            LABEL_CANDIDATES: ["Full Name","Name","Field Manager","Field Manager Name","Title"] },
          BRANCH:        { TABLE_ID: "tblD2gLfkTtJYIhmK", VIEW_ID: "viw8tjumtr3Er8SuR",
            LABEL_CANDIDATES: ["Vanir Office","Branch","Name","Division","Office"] },
          CUSTOMER:      { TABLE_ID: "tblQ7yvLoLKZlZ9yU", VIEW_ID: "Grid view",
            LABEL_CANDIDATES: ["Client Name","Client","Name"] },
          SUBCONTRACTOR: { TABLE_ID: "tblgsUP8po27WX7Hb", VIEW_ID: "Grid view",
            LABEL_CANDIDATES: ["Subcontractor Company Name","Company","Company Name","Name","Vendor","Vendor Name"] }
        }
      }
    },

    fillin: {
      key: "fillin",
      uiTitle: "Fill-In",
      includeLabor: false,
      airtable: {
        API_KEY: PAT,
        BASE_ID: "appeNSp44fJ8QYeY5",     // Fill-In base ✅
        TABLE_ID: "tblRp5bukUiw9tX9j",     // Fill-In main table ✅
        VIEW_ID:  "viwh9UWnGFNAoQwcT",     // Fill-In view ✅
        // Leave SOURCES empty for now so the app scans the Fill-In main view
        // (prevents 403s until you have the correct linked-table IDs in this base)
        SOURCES: { }
      }
    }
  };

  // convenience accessors some pages expect
  window.APP = window.APP || window.APPS.vpo;
  window.getAppConfig = function () { return window.APP; };

})();

(function (global) {
  "use strict";

  // --- Persist a PAT locally if missing (dev convenience) ---
  try {
    if (!localStorage.getItem("AIRTABLE_API_KEY")) {
      // Put your real PAT here if you want it auto-seeded:
       localStorage.setItem("AIRTABLE_API_KEY", "patTGK9HVgF4n1zqK.cbc0a103ecf709818f4cd9a37e18ff5f68c7c17f893085497663b12f2c600054");
    }
  } catch (e) {
    console.warn("[app-config] Could not access localStorage for AIRTABLE_API_KEY:", e);
  }

  // --- Mode resolution: ?app=vpo|fillin -> <html data-app="..."> -> saved -> default(vpo)
  const qs = new URLSearchParams(location.search);
  const fromQS   = (qs.get("app") || "").toLowerCase();
  const fromAttr = (document.documentElement.getAttribute("data-app") || "").toLowerCase();
  const saved    = (localStorage.getItem("vanir_app_mode") || "").toLowerCase();

  const MODE = (fromQS === "vpo" || fromQS === "fillin") ? fromQS
             : (fromAttr === "vpo" || fromAttr === "fillin") ? fromAttr
             : (saved === "vpo" || saved === "fillin") ? saved
             : "vpo";

  if (!fromAttr) {
    try { document.documentElement.setAttribute("data-app", MODE); } catch {}
  }

  // Allow other scripts (or a mode toggle) to switch modes
  global.__setAppMode = function(next){
    const m = String(next||"").toLowerCase();
    if (m !== "vpo" && m !== "fillin") return;
    try { localStorage.setItem("vanir_app_mode", m); } catch {}
    const url = new URL(location.href);
    url.searchParams.set("app", m);
    location.href = url.toString(); // reload with explicit ?app=
  };

  // ============= CENTRAL PER-APP SETTINGS =============
  const APPS = {
    vpo: {
      key: "vpo",
      uiTitle: "VPO",
      includeLabor: true,
      airtable: {
        API_KEY: localStorage.getItem("AIRTABLE_API_KEY") || "",
        BASE_ID: "appQDdkj6ydqUaUkE",
        TABLE_ID: "tblO72Aw6qplOEAhR",
        VIEW_ID:  "viwf55KoUHJZfdEY6",
        SOURCES: {
          FIELD_MANAGER: { TABLE_ID: "tblj6Fp0rvN7QyjRv", VIEW_ID: "viwgHExXtj0VSlmbU",
            LABEL_CANDIDATES: ["Full Name","Name","Field Manager","Field Manager Name","Title"] },
          BRANCH:        { TABLE_ID: "tblD2gLfkTtJYIhmK", VIEW_ID: "viw8tjumtr3Er8SuR",
            LABEL_CANDIDATES: ["Vanir Office","Branch","Name","Division","Office"] },
          CUSTOMER:      { TABLE_ID: "tblQ7yvLoLKZlZ9yU", VIEW_ID: "Grid view",
            LABEL_CANDIDATES: ["Client Name","Client","Name"] },
          SUBCONTRACTOR: { TABLE_ID: "tblgsUP8po27WX7Hb", VIEW_ID: "Grid view",
            LABEL_CANDIDATES: ["Subcontractor Company Name","Company","Company Name","Name","Vendor","Vendor Name"] }
        }
      }
    },

    fillin: {
  key: "fillin",
  uiTitle: "Fill-In",
  includeLabor: false,
  airtable: {
    API_KEY: localStorage.getItem("AIRTABLE_API_KEY") || "",
    BASE_ID: "appeNSp44fJ8QYeY5",
    TABLE_ID: "tblRp5bukUiw9tX9j",
    VIEW_ID:  "viwh9UWnGFNAoQwcT",
    // Leave empty until you have Fill-In’s own linked-table IDs
    SOURCES: { }                 // ← IMPORTANT
  }
}  };

  // --- Boot the live APP object and push its Airtable config to the service
  const APP = APPS[MODE] || APPS.vpo;
  global.APP_MODE = MODE;
  global.APP = APP;

  // Make it easy for others to read current config
  global.getAppConfig = function(){ return { mode: MODE, APP }; };

  // If airtable.service.js provided a runtime setter, use it
  if (typeof global.setAirtableRuntimeConfig === "function") {
    try { global.setAirtableRuntimeConfig(APP.airtable); } catch (e) {
      console.warn("[app-config] setAirtableRuntimeConfig failed", e);
    }
  } else {
    // Fallback: expose as AIRTABLE_CONFIG for direct reads
    try { global.AIRTABLE_CONFIG = APP.airtable; } catch {}
  }

  // --- Gate HTML chunks with [data-app-only="..."]
  function applyAppGates(){
    try {
      document.documentElement.setAttribute("data-app", MODE);
    } catch {}

    const chunks = document.querySelectorAll("[data-app-only]");
    chunks.forEach(el => {
      const only = (el.getAttribute("data-app-only") || "").toLowerCase();
      el.style.display = (only === MODE) ? "" : "none";
    });

    // Page titles / labels
    try {
      const h1 = document.querySelector(".page-title, #fillinTitle, #formTitle");
      if (h1 && APP.uiTitle) h1.textContent = APP.uiTitle;
    } catch {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyAppGates);
  } else {
    applyAppGates();
  }

})(window);
