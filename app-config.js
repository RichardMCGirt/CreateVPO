// app-config.js
(function () {
  "use strict";

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
          BRANCH: { TABLE_ID: "tblD2gLfkTtJYIhmK", VIEW_ID: "viw8tjumtr3Er8SuR",
            LABEL_CANDIDATES: ["Vanir Office","Branch","Name","Division","Office"] },
          CUSTOMER: { TABLE_ID: "tblQ7yvLoLKZlZ9yU", VIEW_ID: "Grid view",
            LABEL_CANDIDATES: ["Customer","Customer Name","Client Name","Client","Name"] },
          // Optional for VPO:
          SUBCONTRACTOR: { TABLE_ID: "tblgsUP8po27WX7Hb", VIEW_ID: "Grid view",
            LABEL_CANDIDATES: ["Subcontractor Company Name","Company","Company Name","Name","Vendor","Vendor Name"] }
        }
      }
    },

    // ===== Fill-In app config (use curated SOURCES in the FILL-IN base) =====
    fillin: {
      key: "fillin",
      uiTitle: "Fill-In",
      includeLabor: false,
      airtable: {
        API_KEY: PAT,
        BASE_ID: "appeNSp44fJ8QYeY5",              // <-- Fill-In base (stays)
        TABLE_ID: "tblRp5bukUiw9tX9j",              // <-- Fill-In main table (not used for dropdowns)
        VIEW_ID:  "viwh9UWnGFNAoQwcT",              // <-- any view for the main table
        SOURCES: {
          // Replace TABLE_ID / VIEW_ID with your Fill-In base tables/views.
          // You may use table NAMES (e.g., "Field Managers") or the real "tblXXXXXXXXXXXXXX" id.
          FIELD_MANAGER: {
            TABLE_ID: "Field Managers",             // or e.g., "tblAAAAAAAAAAAAAAA"
            VIEW_ID:  "viwDKoeJ0MEWVMJTe",
            LABEL_CANDIDATES: ["Full Name","Name","Field Manager","Field Manager Name","Title"]
          },
          BRANCH: {
            TABLE_ID: "Vanir Offices",                   // or e.g., "tblBBBBBBBBBBBBBBB"
            VIEW_ID:  "viwhuabkWxRYif3Ci",
            LABEL_CANDIDATES: ["Vanir Office","Branch","Name","Division","Office Name"]
          },
          CUSTOMER: {
            TABLE_ID: "Customers",                  // or your actual table id/name
            VIEW_ID:  "viwIAfvUiBDWWr02r",                  // or your actual view id/name
            LABEL_CANDIDATES: ["Customer","Customer Name","Client Name","Client","Name"]
          }
          // If Fill-In also needs subcontractors from its own base, add:
          // ,SUBCONTRACTOR: {
          //   TABLE_ID: "Subcontractors",
          //   VIEW_ID:  "Grid view",
          //   LABEL_CANDIDATES: ["Subcontractor Company Name","Company","Company Name","Name","Vendor","Vendor Name"]
          // }
        }
      }
    }
  };

  // --- Persist a PAT locally if missing (dev convenience) ---
  try {
    if (!localStorage.getItem("AIRTABLE_API_KEY")) {
      localStorage.setItem("AIRTABLE_API_KEY", "YOUR_PERSONAL_ACCESS_TOKEN_HERE");
    }
  } catch (e) {
    console.warn("[app-config] Could not access localStorage for AIRTABLE_API_KEY:", e);
  }

  // --- Mode resolution: ?app=vpo|fillin -> <html data-app="..."> -> saved -> default(vpo)
  const qs = new URLSearchParams(location.search);
  const fromQS   = (qs.get("app") || "").toLowerCase();
  const fromAttr = (document.documentElement.getAttribute("data-app") || "").toLowerCase();
  const saved    = (localStorage.getItem("vanir_app_mode") || "").toLowerCase();
  const mode     = fromQS || fromAttr || saved || "vpo";

  window.APP = window.APPS[mode] || window.APPS.vpo;

  // Set <html data-app="...">
  try { document.documentElement.setAttribute("data-app", window.APP.key); } catch {}

  // Page titles / labels
  try {
    const h1 = document.querySelector(".page-title, #fillinTitle, #formTitle");
    if (h1 && APP.uiTitle) h1.textContent = APP.uiTitle;
  } catch {}

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {});
  }
})();
