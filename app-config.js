// app-config.js
(function (global) {
  "use strict";
 try {
    if (!localStorage.getItem("patTGK9HVgF4n1zqK.cbc0a103ecf709818f4cd9a37e18ff5f68c7c17f893085497663b12f2c600054")) {
      localStorage.setItem("AIRTABLE_API_KEY", "patTGK9HVgF4n1zqK.cbc0a103ecf709818f4cd9a37e18ff5f68c7c17f893085497663b12f2c600054");
    }
  } catch (e) {
    console.warn("Could not persist AIRTABLE_API_KEY to localStorage:", e);
  }
  
  // Pick mode from ?app=vpo|fillin or <html data-app="...">
 const qs = new URLSearchParams(location.search);
  const fromQS   = (qs.get("app") || "").toLowerCase();
  const fromAttr = (document.documentElement.getAttribute("data-app") || "").toLowerCase();
  const saved    = (localStorage.getItem("vanir_app_mode") || "").toLowerCase();

  const MODE = (fromQS === "vpo" || fromQS === "fillin") ? fromQS
             : (fromAttr === "vpo" || fromAttr === "fillin") ? fromAttr
             : (saved === "vpo" || saved === "fillin") ? saved
             : "vpo";

  // Ensure the attribute is present for immediate gating on any page
  if (!fromAttr) {
    try { document.documentElement.setAttribute("data-app", MODE); } catch {}
  }

  // Expose helpers so pages can switch mode and navigate with it
  global.__setAppMode = function(next){
    const m = String(next||"").toLowerCase();
    if (m !== "vpo" && m !== "fillin") return;
    try { localStorage.setItem("vanir_app_mode", m); } catch {}
    const url = new URL(location.href);
    url.searchParams.set("app", m);
    location.href = url.toString(); // reload with explicit ?app=
  };

  global.APP_MODE = MODE;

  // Centralized per-app settings
  const APPS = {
    vpo: {
      key: "vpo",
      uiTitle: "VPO",
      includeLabor: true,
      airtable: {
        // Replace with your VPO base/table/view
        API_KEY: localStorage.getItem("AIRTABLE_API_KEY") || "",
        BASE_ID: "appQDdkj6ydqUaUkE",
        TABLE_ID: "tblO72Aw6qplOEAhR",
        VIEW_ID:  "viwf55KoUHJZfdEY6",

        // Linked-source tables (keep or trim as you need)
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
      includeLabor: false, // Fill-In hides Labor UI
      airtable: {
        // Replace with your Fill-In base/table/view
        API_KEY: localStorage.getItem("AIRTABLE_API_KEY") || "",
        BASE_ID: "appeNSp44fJ8QYeY5",
        TABLE_ID: "tblRp5bukUiw9tX9j",
        VIEW_ID:  "viwh9UWnGFNAoQwcT",

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
    }
  };

  const APP = APPS[MODE];
  global.APP_MODE = MODE;
  global.APP = APP;             // { key, uiTitle, includeLabor, airtable:{...} }
})(window);
