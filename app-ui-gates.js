// app-ui-gates.js
(function () {
  function gateLaborVisibility() {
    var show = !!(window.APP && window.APP.includeLabor);
    var labor = document.getElementById("labor-list");
    if (labor) labor.style.display = show ? "" : "none";
  }
  function gateLabels() {
    // Example: rename headers or section names if Fill-In differs
    var title = document.getElementById("fillinTitle");
    if (title && window.APP) title.textContent = window.APP.uiTitle || title.textContent;
    var cartTitle = document.getElementById("cartTitle");
    if (cartTitle && window.APP) cartTitle.textContent = "Selected SKUs";
  }

  document.addEventListener("DOMContentLoaded", function () {
    gateLaborVisibility();
    gateLabels();
  });
})();
